package com.action.camera.servicepackage;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.service.ConversationService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.event.OrderPaidEvent;
import com.action.camera.schedule.service.ScheduleService;
import com.action.camera.servicepackage.controller.ServicePackageController;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.dto.CreateServicePackageRequest;
import com.action.camera.servicepackage.dto.CreateServicePackageResult;
import com.action.camera.servicepackage.dto.ReserveServicePackageRequest;
import com.action.camera.servicepackage.dto.ReserveServicePackageResult;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.dto.ServicePackageDetailDto;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.servicepackage.service.ServicePackageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServicePackageFlowTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long SERVICE_ID = 9101L;
    private static final Long CONVERSATION_ID = 9002L;
    private static final Long SCHEDULE_HOLD_ID = 7001L;
    private static final LocalDate AVAILABLE_DATE = LocalDate.of(2026, 7, 1);

    @Mock
    private ServicePackageRepository servicePackageRepository;

    @Mock
    private ScheduleService scheduleService;

    @Mock
    private ConversationService conversationService;

    private ServicePackageService servicePackageService;

    @BeforeEach
    void setUp() {
        servicePackageService = new ServicePackageService(
                servicePackageRepository,
                scheduleService,
                conversationService
        );
    }

    @Test
    void providerCanPublishOnlineAvailableServicePackage() {
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> {
            ServicePackage servicePackage = invocation.getArgument(0);
            servicePackage.setId(SERVICE_ID);
            return servicePackage;
        });

        CreateServicePackageResult result =
                servicePackageService.createServicePackage(provider(), createRequest());

        assertThat(result.getServiceId()).isEqualTo(SERVICE_ID);
        assertThat(result.getStatus()).isEqualTo(ServicePackageStatus.ONLINE.name());
        assertThat(result.getIsAvailable()).isTrue();

        ArgumentCaptor<ServicePackage> captor = ArgumentCaptor.forClass(ServicePackage.class);
        verify(servicePackageRepository).save(captor.capture());
        ServicePackage saved = captor.getValue();
        assertThat(saved.getProviderId()).isEqualTo(PROVIDER_ID);
        assertThat(saved.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        assertThat(saved.getIsAvailable()).isTrue();
        assertThat(saved.getTitle()).isEqualTo("Graduation portrait package");
    }

    @Test
    void customerCannotPublishServicePackage() {
        assertThatThrownBy(() -> servicePackageService.createServicePackage(customer(), createRequest()))
                .isInstanceOf(BusinessException.class);

        verify(servicePackageRepository, never()).save(any(ServicePackage.class));
    }

    @Test
    void serviceHallReturnsOnlyOnlineServicesIncludingUnavailable() {
        ServicePackage onlineAvailable = servicePackage(1L, ServicePackageStatus.ONLINE, true);
        ServicePackage onlineUnavailable = servicePackage(2L, ServicePackageStatus.ONLINE, false);
        ServicePackage offline = servicePackage(3L, ServicePackageStatus.OFFLINE, false);
        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE))
                .thenReturn(List.of(onlineAvailable, onlineUnavailable, offline));

        PageResult<ServicePackageCardDto> page =
                servicePackageService.listServices(1, 10, null, null, null, null, null, null, null);

        assertThat(serviceIds(page)).containsExactlyInAnyOrder(1L, 2L);
        assertThat(page.getRecords())
                .filteredOn(card -> card.getServiceId().equals(2L))
                .singleElement()
                .satisfies(card -> assertThat(card.getIsAvailable()).isFalse());
        assertThat(serviceIds(page)).doesNotContain(3L);
    }

    @Test
    void serviceHallFiltersByCitySceneStylePriceAndAvailableDateWithoutDroppingUnavailableOnlineCards() {
        ServicePackage njAvailable = servicePackage(1L, ServicePackageStatus.ONLINE, true);
        ServicePackage njUnavailable = servicePackage(2L, ServicePackageStatus.ONLINE, false);
        ServicePackage sh = servicePackage(3L, ServicePackageStatus.ONLINE, true);
        sh.setCityCode("SH");

        ServicePackage graduationAvailable = servicePackage(4L, ServicePackageStatus.ONLINE, true);
        ServicePackage graduationUnavailable = servicePackage(5L, ServicePackageStatus.ONLINE, false);
        ServicePackage portrait = servicePackage(6L, ServicePackageStatus.ONLINE, true);
        portrait.setScene("PORTRAIT");

        ServicePackage naturalAvailable = servicePackage(7L, ServicePackageStatus.ONLINE, true);
        ServicePackage naturalUnavailable = servicePackage(8L, ServicePackageStatus.ONLINE, false);
        ServicePackage studio = servicePackage(9L, ServicePackageStatus.ONLINE, true);
        studio.setStyleTags(List.of("studio"));

        ServicePackage priceAvailable = servicePackage(10L, ServicePackageStatus.ONLINE, true);
        ServicePackage priceUnavailable = servicePackage(11L, ServicePackageStatus.ONLINE, false);
        ServicePackage expensive = servicePackage(12L, ServicePackageStatus.ONLINE, true);
        expensive.setBasePriceCent(99000L);

        ServicePackage dateAvailable = servicePackage(13L, ServicePackageStatus.ONLINE, true);
        ServicePackage dateUnavailable = servicePackage(14L, ServicePackageStatus.ONLINE, false);
        ServicePackage otherDate = servicePackage(15L, ServicePackageStatus.ONLINE, true);
        otherDate.setAvailableDates(List.of(LocalDate.of(2026, 7, 2)));

        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE))
                .thenReturn(List.of(njAvailable, njUnavailable, sh))
                .thenReturn(List.of(graduationAvailable, graduationUnavailable, portrait))
                .thenReturn(List.of(naturalAvailable, naturalUnavailable, studio))
                .thenReturn(List.of(priceAvailable, priceUnavailable, expensive))
                .thenReturn(List.of(dateAvailable, dateUnavailable, otherDate));

        assertThat(serviceIds(servicePackageService.listServices(
                1, 10, "NJ", null, null, null, null, null, null)))
                .containsExactlyInAnyOrder(1L, 2L);
        assertThat(serviceIds(servicePackageService.listServices(
                1, 10, null, "GRADUATION", null, null, null, null, null)))
                .containsExactlyInAnyOrder(4L, 5L);
        assertThat(serviceIds(servicePackageService.listServices(
                1, 10, null, null, "natural", null, null, null, null)))
                .containsExactlyInAnyOrder(7L, 8L);
        assertThat(serviceIds(servicePackageService.listServices(
                1, 10, null, null, null, 30000L, 50000L, null, null)))
                .containsExactlyInAnyOrder(10L, 11L);
        assertThat(serviceIds(servicePackageService.listServices(
                1, 10, null, null, null, null, null, AVAILABLE_DATE, null)))
                .containsExactlyInAnyOrder(13L, 14L);
    }

    @Test
    void customerCanViewOnlineServicePackageDetail() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));

        ServicePackageDetailDto detail = servicePackageService.getServiceDetail(SERVICE_ID);

        assertThat(detail.getServiceId()).isEqualTo(SERVICE_ID);
        assertThat(detail.getProviderId()).isEqualTo(PROVIDER_ID);
        assertThat(detail.getTitle()).isEqualTo("Graduation portrait package");
        assertThat(detail.getCityCode()).isEqualTo("NJ");
        assertThat(detail.getServiceArea()).isEqualTo("NJU campus");
        assertThat(detail.getScene()).isEqualTo("GRADUATION");
        assertThat(detail.getStyleTags()).containsExactly("natural", "campus");
        assertThat(detail.getBasePriceCent()).isEqualTo(39900L);
        assertThat(detail.getDurationMinutes()).isEqualTo(120);
        assertThat(detail.getOriginalCount()).isEqualTo(30);
        assertThat(detail.getRefinedCount()).isEqualTo(9);
        assertThat(detail.getDeliveryDays()).isEqualTo(7);
        assertThat(detail.getAvailableDates()).containsExactly(AVAILABLE_DATE);
        assertThat(detail.getPortfolioIds()).containsExactly(11L, 12L);
        assertThat(detail.getDescription()).isEqualTo("Outdoor graduation portraits.");
        assertThat(detail.getStatus()).isEqualTo(ServicePackageStatus.ONLINE.name());
        assertThat(detail.getIsAvailable()).isTrue();
    }

    @Test
    void customerReserveTemporarilyHoldsScheduleCreatesConversationAndKeepsPackageOnline() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));
        when(scheduleService.createTemporaryHold(PROVIDER_ID, SERVICE_ID, AVAILABLE_DATE))
                .thenReturn(SCHEDULE_HOLD_ID);
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(conversationService.createConversationWithInitialMessage(any(CreateConversationCommand.class)))
                .thenReturn(new CreateConversationResult(CONVERSATION_ID));

        ReserveServicePackageResult result = servicePackageService.reserveServicePackage(
                SERVICE_ID,
                customer(),
                reserveRequest("Hello, I want to reserve this package.")
        );

        assertThat(result.getServiceId()).isEqualTo(SERVICE_ID);
        assertThat(result.getConversationId()).isEqualTo(CONVERSATION_ID);
        assertThat(result.getScheduleHoldId()).isEqualTo(SCHEDULE_HOLD_ID);
        assertThat(result.getStatus()).isEqualTo(ServicePackageStatus.ONLINE.name());
        assertThat(result.getIsAvailable()).isFalse();
        assertThat(servicePackage.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        assertThat(servicePackage.getIsAvailable()).isFalse();
        assertThat(servicePackage.getTemporaryScheduleHoldId()).isEqualTo(SCHEDULE_HOLD_ID);

        verify(scheduleService).createTemporaryHold(PROVIDER_ID, SERVICE_ID, AVAILABLE_DATE);
        ArgumentCaptor<CreateConversationCommand> commandCaptor =
                ArgumentCaptor.forClass(CreateConversationCommand.class);
        verify(conversationService).createConversationWithInitialMessage(commandCaptor.capture());
        CreateConversationCommand command = commandCaptor.getValue();
        assertThat(command.getCustomerId()).isEqualTo(CUSTOMER_ID);
        assertThat(command.getProviderId()).isEqualTo(PROVIDER_ID);
        assertThat(command.getInitiatorId()).isEqualTo(CUSTOMER_ID);
        assertThat(command.getSourceType()).isEqualTo(ConversationService.SOURCE_TYPE_SERVICE_PACKAGE);
        assertThat(command.getSourceId()).isEqualTo(SERVICE_ID);
        assertThat(command.getInitialMessage()).isEqualTo("Hello, I want to reserve this package.");
    }

    @Test
    void unavailableOnlineServiceCannotBeReservedAgainButStillAppearsInHall() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, false);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));

        assertThatThrownBy(() -> servicePackageService.reserveServicePackage(
                SERVICE_ID,
                customer(),
                reserveRequest("Try again.")
        )).isInstanceOf(BusinessException.class);

        verify(scheduleService, never()).createTemporaryHold(any(), any(), any());
        verify(conversationService, never()).createConversationWithInitialMessage(any());

        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE)).thenReturn(List.of(servicePackage));
        PageResult<ServicePackageCardDto> page =
                servicePackageService.listServices(1, 10, null, null, null, null, null, null, null);

        assertThat(serviceIds(page)).containsExactly(SERVICE_ID);
        assertThat(page.getRecords().get(0).getIsAvailable()).isFalse();
    }

    @Test
    void offlineServiceCannotBeReserved() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.OFFLINE, false);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));

        assertThatThrownBy(() -> servicePackageService.reserveServicePackage(
                SERVICE_ID,
                customer(),
                reserveRequest("Try offline.")
        )).isInstanceOf(BusinessException.class);

        verify(scheduleService, never()).createTemporaryHold(any(), any(), any());
        verify(conversationService, never()).createConversationWithInitialMessage(any());
    }

    @Test
    void unavailableSelectedDateCannotReserveOrFlipAvailability() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));
        ReserveServicePackageRequest request = reserveRequest("Wrong date.");
        request.setSelectedDate(LocalDate.of(2026, 7, 2));

        assertThatThrownBy(() -> servicePackageService.reserveServicePackage(SERVICE_ID, customer(), request))
                .isInstanceOf(BusinessException.class);

        assertThat(servicePackage.getIsAvailable()).isTrue();
        assertThat(servicePackage.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        verify(scheduleService, never()).createTemporaryHold(any(), any(), any());
        verify(conversationService, never()).createConversationWithInitialMessage(any());
    }

    @Test
    void paidServicePackageOrderMarksPackageOfflineAndRemovesItFromDefaultHall() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, false);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> invocation.getArgument(0));

        servicePackageService.handleOrderPaid(new OrderPaidEvent(servicePackageOrder()));

        assertThat(servicePackage.getStatus()).isEqualTo(ServicePackageStatus.OFFLINE);
        assertThat(servicePackage.getIsAvailable()).isFalse();

        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE)).thenReturn(List.of(servicePackage));
        PageResult<ServicePackageCardDto> page =
                servicePackageService.listServices(1, 10, null, null, null, null, null, null, null);
        assertThat(page.getRecords()).isEmpty();
    }

    @Test
    void controllerDoesNotOwnConversationScheduleRepositoryOrPaymentWorkflows() {
        List<String> controllerFieldTypes = Arrays.stream(ServicePackageController.class.getDeclaredFields())
                .map(field -> field.getType().getSimpleName())
                .toList();
        assertThat(controllerFieldTypes)
                .contains("ServicePackageService")
                .doesNotContain(
                        "ConversationService",
                        "ScheduleService",
                        "ServicePackageRepository",
                        "OrderService",
                        "PaymentService"
                );

        List<String> serviceFieldTypes = Arrays.stream(ServicePackageService.class.getDeclaredFields())
                .map(Field::getType)
                .map(Class::getSimpleName)
                .toList();
        assertThat(serviceFieldTypes)
                .contains("ServicePackageRepository", "ScheduleService", "ConversationService")
                .doesNotContain("OrderService", "PaymentService", "ProviderProfileService", "ProviderProfileMapper");
    }

    @Test
    void servicePackageIsIndependentDomainModelNotProviderProfile() {
        assertThat(ServicePackage.class.getSimpleName()).isEqualTo("ServicePackage");
        assertThat(ServicePackageRepository.class.getSimpleName()).isEqualTo("ServicePackageRepository");
        assertThat(Arrays.stream(ServicePackage.class.getDeclaredFields())
                .map(Field::getName)
                .toList())
                .contains("providerId", "status", "isAvailable", "availableDates", "portfolioIds")
                .doesNotContain("providerProfileId");
    }

    private List<Long> serviceIds(PageResult<ServicePackageCardDto> page) {
        return page.getRecords().stream()
                .map(ServicePackageCardDto::getServiceId)
                .toList();
    }

    private CurrentUser customer() {
        return new CurrentUser(CUSTOMER_ID, UserRole.CUSTOMER);
    }

    private CurrentUser provider() {
        return new CurrentUser(PROVIDER_ID, UserRole.PROVIDER);
    }

    private CreateServicePackageRequest createRequest() {
        CreateServicePackageRequest request = new CreateServicePackageRequest();
        request.setTitle("Graduation portrait package");
        request.setCityCode("NJ");
        request.setServiceArea("NJU campus");
        request.setScene("GRADUATION");
        request.setStyleTags(List.of("Natural", "Campus"));
        request.setBasePriceCent(39900L);
        request.setDurationMinutes(120);
        request.setOriginalCount(30);
        request.setRefinedCount(9);
        request.setDeliveryDays(7);
        request.setAvailableDates(List.of(AVAILABLE_DATE));
        request.setPortfolioIds(List.of(11L, 12L));
        request.setDescription("Outdoor graduation portraits.");
        return request;
    }

    private ReserveServicePackageRequest reserveRequest(String initialMessage) {
        ReserveServicePackageRequest request = new ReserveServicePackageRequest();
        request.setSelectedDate(AVAILABLE_DATE);
        request.setInitialMessage(initialMessage);
        return request;
    }

    private ServicePackage servicePackage(Long id, ServicePackageStatus status, Boolean isAvailable) {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setId(id);
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
        LocalDateTime timestamp = LocalDateTime.of(2026, 7, 1, 10, 0).plusMinutes(id);
        servicePackage.setCreatedAt(timestamp);
        servicePackage.setUpdatedAt(timestamp);
        return servicePackage;
    }

    private Order servicePackageOrder() {
        Order order = new Order();
        order.setId(8101L);
        order.setSourceType(ConversationService.SOURCE_TYPE_SERVICE_PACKAGE);
        order.setSourceId(SERVICE_ID);
        order.setServicePackageId(SERVICE_ID);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_ID);
        return order;
    }
}
