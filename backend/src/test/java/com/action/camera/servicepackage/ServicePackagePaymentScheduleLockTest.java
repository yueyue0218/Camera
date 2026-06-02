package com.action.camera.servicepackage;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.message.service.ConversationService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.event.OrderPaidEvent;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.schedule.entity.Schedule;
import com.action.camera.schedule.enums.ScheduleStatus;
import com.action.camera.schedule.repository.ScheduleRepository;
import com.action.camera.schedule.service.ScheduleService;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.servicepackage.service.ServicePackageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockReset;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:service_package_payment_schedule_lock_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class ServicePackagePaymentScheduleLockTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long OTHER_CUSTOMER_ID = 1002L;
    private static final Long PROVIDER_ID = 2001L;
    private static final LocalDate AVAILABLE_DATE = LocalDate.of(2026, 7, 1);
    private static final LocalDateTime SCHEDULE_START = LocalDateTime.of(2026, 7, 1, 9, 0);
    private static final LocalDateTime SCHEDULE_END = LocalDateTime.of(2026, 7, 1, 12, 0);
    private static final LocalDateTime ORDER_START = LocalDateTime.of(2026, 7, 1, 10, 0);
    private static final LocalDateTime ORDER_END = LocalDateTime.of(2026, 7, 1, 11, 0);

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private ServicePackageService servicePackageService;

    @SpyBean(reset = MockReset.BEFORE)
    private ScheduleService scheduleService;

    @Autowired
    private ServicePackageRepository servicePackageRepository;

    @Autowired
    private ScheduleRepository scheduleRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MessageRepository messageRepository;

    @BeforeEach
    void cleanDatabase() {
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
        orderRepository.deleteAll();
        scheduleRepository.deleteAll();
        servicePackageRepository.deleteAll();
    }

    @Test
    void providerPublishesServicePackageAndFieldsRoundTripThroughRepositoryListAndDetail() {
        ResponseEntity<Map> createResponse = rest.exchange(
                "/services",
                HttpMethod.POST,
                providerEntity(createServicePackageBody()),
                Map.class);

        assertThat(createResponse.getBody()).isNotNull();
        assertThat(createResponse.getBody().get("code")).isEqualTo(200);
        Long serviceId = numberValue(data(createResponse), "serviceId");

        ServicePackage savedPackage = servicePackageRepository.findById(serviceId).orElseThrow();
        assertThat(savedPackage.getProviderId()).isEqualTo(PROVIDER_ID);
        assertThat(savedPackage.getServiceArea()).isEqualTo("NJU campus");
        assertThat(savedPackage.getStyleTags()).containsExactly("natural", "campus");
        assertThat(savedPackage.getAvailableDates()).containsExactly(AVAILABLE_DATE);
        assertThat(savedPackage.getPortfolioIds()).containsExactly(11L, 12L);
        assertThat(savedPackage.getIsAvailable()).isTrue();
        assertThat(savedPackage.getTemporaryScheduleHoldId()).isNull();

        ResponseEntity<Map> detailResponse = rest.getForEntity("/services/" + serviceId, Map.class);
        assertThat(detailResponse.getBody()).isNotNull();
        assertThat(detailResponse.getBody().get("code")).isEqualTo(200);
        Map<String, Object> detail = data(detailResponse);
        assertThat(numberValue(detail, "providerId")).isEqualTo(PROVIDER_ID);
        assertThat(detail.get("serviceArea")).isEqualTo("NJU campus");
        assertThat(detail.get("isAvailable")).isEqualTo(true);

        ResponseEntity<Map> hallResponse = rest.getForEntity("/services", Map.class);
        Map<String, Object> hallCard = serviceCards(hallResponse).stream()
                .filter(card -> numberValue(card, "serviceId").equals(serviceId))
                .findFirst()
                .orElseThrow();
        assertThat(hallCard.get("isAvailable")).isEqualTo(true);
        assertThat(hallCard.get("styleTags")).isEqualTo(List.of("natural", "campus"));
        assertThat(hallCard.get("portfolioIds")).isEqualTo(List.of(11, 12));
    }

    @Test
    void paidServicePackageOrderBooksAvailableScheduleAndRemovesPackageFromHall() {
        Schedule schedule = scheduleRepository.saveAndFlush(availableSchedule());
        ServicePackage servicePackage = servicePackageRepository.saveAndFlush(
                servicePackage(ServicePackageStatus.ONLINE, false));
        Order order = orderRepository.saveAndFlush(paidServicePackageOrder(servicePackage.getId()));
        order.setSourceType(ConversationService.SOURCE_TYPE_SERVICE_PACKAGE);
        order.setSourceId(servicePackage.getId());
        OrderPaidEvent event = new OrderPaidEvent(order);

        scheduleService.handleOrderPaid(event);
        servicePackageService.handleOrderPaid(event);

        Schedule lockedSchedule = scheduleRepository.findById(schedule.getId()).orElseThrow();
        assertThat(lockedSchedule.getStatus()).isEqualTo(ScheduleStatus.BOOKED);
        assertThat(lockedSchedule.getLockedByOrderId()).isEqualTo(order.getId());
        assertThat(lockedSchedule.getLockExpireTime()).isNull();

        ServicePackage offlinePackage = servicePackageRepository.findById(servicePackage.getId()).orElseThrow();
        assertThat(offlinePackage.getStatus()).isEqualTo(ServicePackageStatus.OFFLINE);
        assertThat(offlinePackage.getIsAvailable()).isFalse();

        ResponseEntity<Map> hallResponse = rest.getForEntity("/services", Map.class);
        assertThat(hallResponse.getBody()).isNotNull();
        assertThat(hallResponse.getBody().get("code")).isEqualTo(200);
        assertThat(serviceIds(hallResponse)).doesNotContain(servicePackage.getId());
    }

    @Test
    void paidOrderCannotOverrideScheduleBookedByAnotherOrder() {
        Schedule schedule = availableSchedule();
        schedule.setStatus(ScheduleStatus.BOOKED);
        schedule.setLockedByOrderId(8801L);
        Schedule bookedSchedule = scheduleRepository.saveAndFlush(schedule);
        ServicePackage servicePackage = servicePackageRepository.saveAndFlush(
                servicePackage(ServicePackageStatus.ONLINE, false));
        Order order = orderRepository.saveAndFlush(paidServicePackageOrder(servicePackage.getId()));
        order.setSourceType(ConversationService.SOURCE_TYPE_SERVICE_PACKAGE);
        order.setSourceId(servicePackage.getId());
        OrderPaidEvent event = new OrderPaidEvent(order);

        assertThatThrownBy(() -> scheduleService.handleOrderPaid(event))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATUS_CONFLICT));

        Schedule unchangedSchedule = scheduleRepository.findById(bookedSchedule.getId()).orElseThrow();
        assertThat(unchangedSchedule.getStatus()).isEqualTo(ScheduleStatus.BOOKED);
        assertThat(unchangedSchedule.getLockedByOrderId()).isEqualTo(8801L);
        assertThat(unchangedSchedule.getLockedByOrderId()).isNotEqualTo(order.getId());
    }

    @Test
    void reserveMarksPackageUnavailableKeepsItOnlineInHallAndRejectsSecondReserve() {
        Schedule schedule = scheduleRepository.saveAndFlush(availableSchedule());
        ServicePackage servicePackage = servicePackageRepository.saveAndFlush(
                servicePackage(ServicePackageStatus.ONLINE, true));

        ResponseEntity<Map> firstReserve = rest.exchange(
                "/services/" + servicePackage.getId() + "/reserve",
                HttpMethod.POST,
                customerEntity(CUSTOMER_ID, reserveBody()),
                Map.class);

        assertThat(firstReserve.getBody()).isNotNull();
        assertThat(firstReserve.getBody().get("code")).isEqualTo(200);
        Map<String, Object> firstReserveData = data(firstReserve);
        Long conversationId = numberValue(firstReserveData, "conversationId");
        assertThat(conversationId).isNotNull();
        assertThat(numberValue(firstReserveData, "scheduleHoldId")).isEqualTo(schedule.getId());
        assertThat(firstReserveData.get("status")).isEqualTo(ServicePackageStatus.ONLINE.name());
        assertThat(firstReserveData.get("isAvailable")).isEqualTo(false);

        ServicePackage reservedPackage = servicePackageRepository.findById(servicePackage.getId()).orElseThrow();
        assertThat(reservedPackage.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        assertThat(reservedPackage.getIsAvailable()).isFalse();
        assertThat(reservedPackage.getTemporaryScheduleHoldId()).isEqualTo(schedule.getId());

        Schedule heldSchedule = scheduleRepository.findById(schedule.getId()).orElseThrow();
        assertThat(heldSchedule.getStatus()).isEqualTo(ScheduleStatus.HELD);
        assertThat(conversationRepository.findById(conversationId)).isPresent();
        assertThat(conversationRepository.count()).isEqualTo(1);
        assertThat(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)).hasSize(1);

        ResponseEntity<Map> hallResponse = rest.getForEntity("/services", Map.class);
        assertThat(serviceIds(hallResponse)).contains(servicePackage.getId());
        Map<String, Object> hallCard = serviceCards(hallResponse).stream()
                .filter(card -> numberValue(card, "serviceId").equals(servicePackage.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(hallCard.get("isAvailable")).isEqualTo(false);

        ResponseEntity<Map> secondReserve = rest.exchange(
                "/services/" + servicePackage.getId() + "/reserve",
                HttpMethod.POST,
                customerEntity(OTHER_CUSTOMER_ID, reserveBody()),
                Map.class);

        assertThat(secondReserve.getBody()).isNotNull();
        assertThat(secondReserve.getBody().get("code")).isEqualTo(ErrorCode.STATUS_CONFLICT.getCode());
        ServicePackage stillReservedPackage = servicePackageRepository.findById(servicePackage.getId()).orElseThrow();
        assertThat(stillReservedPackage.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        assertThat(stillReservedPackage.getIsAvailable()).isFalse();
        assertThat(conversationRepository.count()).isEqualTo(1);

        verify(scheduleService, times(1))
                .createTemporaryHold(PROVIDER_ID, servicePackage.getId(), AVAILABLE_DATE);
    }

    private Schedule availableSchedule() {
        Schedule schedule = new Schedule();
        schedule.setProviderUserId(PROVIDER_ID);
        schedule.setScheduleDate(AVAILABLE_DATE);
        schedule.setTimeSlot("MORNING");
        schedule.setCityCode("NJ");
        schedule.setLocationHint("NJU campus");
        schedule.setStartTime(SCHEDULE_START);
        schedule.setEndTime(SCHEDULE_END);
        schedule.setStatus(ScheduleStatus.AVAILABLE);
        schedule.setLockedByOrderId(null);
        schedule.setLockExpireTime(null);
        return schedule;
    }

    private ServicePackage servicePackage(ServicePackageStatus status, Boolean isAvailable) {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setProviderId(PROVIDER_ID);
        servicePackage.setTitle("Graduation portrait package");
        servicePackage.setCityCode("NJ");
        servicePackage.setServiceArea("NJU campus");
        servicePackage.setScene("GRADUATION");
        servicePackage.setStyleTags(List.of("natural", "campus"));
        servicePackage.setBasePriceCent(39900L);
        servicePackage.setDurationMinutes(120);
        servicePackage.setOriginalCount(30);
        servicePackage.setRefinedCount(9);
        servicePackage.setDeliveryDays(7);
        servicePackage.setAvailableDates(List.of(AVAILABLE_DATE));
        servicePackage.setPortfolioIds(List.of(11L, 12L));
        servicePackage.setDescription("Outdoor graduation portraits.");
        servicePackage.setStatus(status);
        servicePackage.setIsAvailable(isAvailable);
        servicePackage.setCreatedAt(LocalDateTime.of(2026, 6, 1, 10, 0));
        servicePackage.setUpdatedAt(LocalDateTime.of(2026, 6, 1, 10, 0));
        return servicePackage;
    }

    private Order paidServicePackageOrder(Long servicePackageId) {
        Order order = new Order();
        order.setOrderNo("O" + DateTimeFormatter.ofPattern("yyyyMMddHHmmss")
                .format(LocalDateTime.now()) + UUID.randomUUID().toString().substring(0, 8));
        order.setQuoteId(5101L);
        order.setConversationId(5201L);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_ID);
        order.setServicePackageId(servicePackageId);
        order.setStatus(OrderStatus.PAID_PENDING_SHOOT);
        order.setEscrowStatus(EscrowStatus.NOT_PAID);
        order.setTotalAmountCent(39900L);
        order.setShootStartTime(ORDER_START);
        order.setShootEndTime(ORDER_END);
        order.setShootLocation("NJU campus");
        order.setDeliveryDeadline(ORDER_END.plusDays(7));
        order.setQuoteSnapshotJson("{}");
        order.setSafetyNoticeConfirmed(true);
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        return order;
    }

    private HttpEntity<String> customerEntity(Long customerId, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", customerId.toString());
        headers.set("X-User-Role", "CUSTOMER");
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<String> providerEntity(String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", PROVIDER_ID.toString());
        headers.set("X-User-Role", "PROVIDER");
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private String createServicePackageBody() {
        return """
                {
                  "title":"Graduation portrait package",
                  "cityCode":"NJ",
                  "serviceArea":"NJU campus",
                  "scene":"GRADUATION",
                  "styleTags":["Natural","Campus"],
                  "basePriceCent":39900,
                  "durationMinutes":120,
                  "originalCount":30,
                  "refinedCount":9,
                  "deliveryDays":7,
                  "availableDates":["%s"],
                  "portfolioIds":[11,12],
                  "description":"Outdoor graduation portraits."
                }
                """.formatted(AVAILABLE_DATE);
    }

    private String reserveBody() {
        return "{\"selectedDate\":\"" + AVAILABLE_DATE + "\",\"initialMessage\":\"Please reserve this package.\"}";
    }

    private List<Long> serviceIds(ResponseEntity<Map> response) {
        return serviceCards(response).stream()
                .map(card -> numberValue(card, "serviceId"))
                .toList();
    }

    private List<Map<String, Object>> serviceCards(ResponseEntity<Map> response) {
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = data(response);
        return (List<Map<String, Object>>) data.get("records");
    }

    private Map<String, Object> data(ResponseEntity<Map> response) {
        return (Map<String, Object>) response.getBody().get("data");
    }

    private Long numberValue(Map<String, Object> values, String key) {
        return ((Number) values.get(key)).longValue();
    }
}
