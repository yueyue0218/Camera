package com.action.camera.servicepackage;

import com.action.camera.common.JwtUtil;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:service_package_showcase_contract_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class ServicePackageShowcaseContractTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long OTHER_CUSTOMER_ID = 1002L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long OTHER_PROVIDER_ID = 2002L;
    private static final LocalDate AVAILABLE_DATE = LocalDate.of(2026, 7, 1);

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ServicePackageRepository servicePackageRepository;

    @Autowired
    private ServicePackageInterestRepository interestRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MessageRepository messageRepository;

    @BeforeEach
    void cleanDatabase() {
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
        interestRepository.deleteAll();
        servicePackageRepository.deleteAll();
        jdbc.execute("DELETE FROM users WHERE id IN (1001, 1002, 2001, 2002)");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (1001, 'customer', 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (1002, 'other customer', 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (2001, 'provider', 'PROVIDER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (2002, 'other provider', 'PROVIDER', 'ACTIVE', 80.00, NOW(), NOW())");
    }

    @Test
    void publishListAndDetailExposeShowcaseTimeAndPhotographerContractFields() {
        Long serviceId = createServicePackage();

        ServicePackage saved = servicePackageRepository.findById(serviceId).orElseThrow();
        assertThat(saved.getImages()).containsExactly("https://cdn.example/cover.jpg", "https://cdn.example/detail.jpg");
        assertThat(saved.getPriceRange()).isEqualTo("399-599");
        assertThat(saved.getTimeDescription()).isEqualTo("七月上旬周末可约");
        assertThat(saved.getTimeTags()).containsExactly("NEAR_7_DAYS");

        ResponseEntity<Map> hallResponse = rest.getForEntity("/service-packages?timeTag=NEAR_7_DAYS", Map.class);
        Map<String, Object> card = serviceCards(hallResponse).stream()
                .filter(item -> numberValue(item, "serviceId").equals(serviceId))
                .findFirst()
                .orElseThrow();
        assertThat(card.get("photographerId")).isEqualTo(PROVIDER_ID.intValue());
        assertThat(card.get("coverImage")).isEqualTo("https://cdn.example/cover.jpg");
        assertThat(card.get("priceRange")).isEqualTo("399-599");
        assertThat(card.get("timeDescription")).isEqualTo("七月上旬周末可约");
        assertThat(card.get("timeTags")).isEqualTo(List.of("NEAR_7_DAYS"));
        assertThat(card.get("createdAt")).isNotNull();
        assertThat(card.get("updatedAt")).isNotNull();

        ResponseEntity<Map> legacyHallResponse = rest.getForEntity("/services?timeTag=NEAR_7_DAYS", Map.class);
        Map<String, Object> legacyCard = serviceCards(legacyHallResponse).stream()
                .filter(item -> numberValue(item, "serviceId").equals(serviceId))
                .findFirst()
                .orElseThrow();
        assertThat(legacyCard.get("createdAt")).isNotNull();
        assertThat(legacyCard.get("updatedAt")).isNotNull();

        ResponseEntity<Map> excludedResponse = rest.getForEntity("/service-packages?timeTag=NEAR_3_DAYS", Map.class);
        assertThat(serviceIds(excludedResponse)).doesNotContain(serviceId);

        ResponseEntity<Map> detailResponse = rest.getForEntity("/service-packages/" + serviceId, Map.class);
        Map<String, Object> detail = data(detailResponse);
        assertThat(detail.get("photographerId")).isEqualTo(PROVIDER_ID.intValue());
        assertThat(detail.get("images")).isEqualTo(List.of("https://cdn.example/cover.jpg", "https://cdn.example/detail.jpg"));
        assertThat(detail.get("styleTags")).isEqualTo(List.of("natural", "campus"));
        assertThat(detail.get("description")).isEqualTo("Outdoor graduation portraits.");
        assertThat(detail.get("timeDescription")).isEqualTo("七月上旬周末可约");
        assertThat(detail.get("timeTags")).isEqualTo(List.of("NEAR_7_DAYS"));
    }

    @Test
    void customerInterestIsIdempotentCancelableAndListSupportsTimeTagFilter() {
        Long serviceId = createServicePackage();

        ResponseEntity<Map> first = rest.exchange(
                "/service-packages/" + serviceId + "/interest",
                HttpMethod.POST,
                customerEntity(CUSTOMER_ID, null),
                Map.class);
        ResponseEntity<Map> second = rest.exchange(
                "/service-packages/" + serviceId + "/interest",
                HttpMethod.POST,
                customerEntity(CUSTOMER_ID, null),
                Map.class);

        assertThat(first.getBody().get("code")).isEqualTo(200);
        assertThat(second.getBody().get("code")).isEqualTo(200);
        assertThat(interestRepository.count()).isEqualTo(1);

        ResponseEntity<Map> ownList = rest.exchange(
                "/me/service-package-interests?timeTag=NEAR_7_DAYS",
                HttpMethod.GET,
                customerEntity(CUSTOMER_ID, null),
                Map.class);
        assertThat(serviceIds(ownList)).contains(serviceId);

        ResponseEntity<Map> otherList = rest.exchange(
                "/me/service-package-interests?timeTag=NEAR_7_DAYS",
                HttpMethod.GET,
                customerEntity(OTHER_CUSTOMER_ID, null),
                Map.class);
        assertThat(serviceIds(otherList)).doesNotContain(serviceId);

        rest.exchange(
                "/service-packages/" + serviceId + "/interest",
                HttpMethod.DELETE,
                customerEntity(CUSTOMER_ID, null),
                Map.class);
        rest.exchange(
                "/service-packages/" + serviceId + "/interest",
                HttpMethod.DELETE,
                customerEntity(CUSTOMER_ID, null),
                Map.class);
        assertThat(interestRepository.count()).isZero();
    }

    @Test
    void startChatUsesConversationModuleWithoutChangingPackageStatusOrAvailability() {
        Long serviceId = createServicePackage();
        long conversationsBefore = conversationRepository.count();

        ResponseEntity<Map> first = rest.exchange(
                "/service-packages/" + serviceId + "/start-chat",
                HttpMethod.POST,
                customerEntity(CUSTOMER_ID, "{\"initialMessage\":\"现在想聊一下这组橱窗\"}"),
                Map.class);
        ResponseEntity<Map> second = rest.exchange(
                "/service-packages/" + serviceId + "/start-chat",
                HttpMethod.POST,
                customerEntity(CUSTOMER_ID, "{\"initialMessage\":\"再次打开\"}"),
                Map.class);

        assertThat(first.getBody().get("code")).isEqualTo(200);
        assertThat(second.getBody().get("code")).isEqualTo(200);
        Long conversationId = numberValue(data(first), "conversationId");
        assertThat(numberValue(data(second), "conversationId")).isEqualTo(conversationId);
        assertThat(conversationRepository.count()).isEqualTo(conversationsBefore + 1);
        assertThat(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)).hasSize(1);

        ServicePackage saved = servicePackageRepository.findById(serviceId).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        assertThat(saved.getIsAvailable()).isTrue();
    }

    @Test
    void photographerCanEditAndOfflineOwnPackageWithoutOrderOrPayment() throws InterruptedException {
        Long serviceId = createServicePackage();
        ServicePackage beforeUpdate = servicePackageRepository.findById(serviceId).orElseThrow();
        assertThat(beforeUpdate.getCreatedAt()).isNotNull();
        assertThat(beforeUpdate.getUpdatedAt()).isNotNull();
        Thread.sleep(25);

        ResponseEntity<Map> updateResponse = rest.exchange(
                "/service-packages/" + serviceId,
                HttpMethod.PUT,
                providerEntity("""
                        {
                          "title":"Updated portrait window",
                          "timeDescription":"近三天可约",
                          "timeTags":["NEAR_3_DAYS"]
                        }
                        """),
                Map.class);
        assertThat(updateResponse.getBody().get("code")).isEqualTo(200);
        ServicePackage updated = servicePackageRepository.findById(serviceId).orElseThrow();
        assertThat(updated.getTitle()).isEqualTo("Updated portrait window");
        assertThat(updated.getTimeDescription()).isEqualTo("近三天可约");
        assertThat(updated.getTimeTags()).containsExactly("NEAR_3_DAYS");
        assertThat(updated.getCreatedAt()).isEqualTo(beforeUpdate.getCreatedAt());
        assertThat(updated.getUpdatedAt()).isAfter(beforeUpdate.getUpdatedAt());

        ResponseEntity<Map> offlineResponse = rest.exchange(
                "/service-packages/" + serviceId + "/offline",
                HttpMethod.PATCH,
                providerEntity(null),
                Map.class);
        assertThat(offlineResponse.getBody().get("code")).isEqualTo(200);
        assertThat(servicePackageRepository.findById(serviceId).orElseThrow().getStatus())
                .isEqualTo(ServicePackageStatus.OFFLINE);
        assertThat(serviceIds(rest.getForEntity("/service-packages", Map.class))).doesNotContain(serviceId);

        ResponseEntity<Map> anonymousDetail = rest.getForEntity("/service-packages/" + serviceId, Map.class);
        ResponseEntity<Map> nonOwnerDetail = rest.exchange(
                "/service-packages/" + serviceId,
                HttpMethod.GET,
                bearerEntity(CUSTOMER_ID),
                Map.class);
        ResponseEntity<Map> ownerDetail = rest.exchange(
                "/service-packages/" + serviceId,
                HttpMethod.GET,
                bearerEntity(PROVIDER_ID),
                Map.class);
        ResponseEntity<Map> legacyOwnerDetail = rest.exchange(
                "/services/" + serviceId,
                HttpMethod.GET,
                bearerEntity(PROVIDER_ID),
                Map.class);
        ResponseEntity<Map> forgedHeaderDetail = rest.exchange(
                "/service-packages/" + serviceId,
                HttpMethod.GET,
                providerEntity(null),
                Map.class);
        assertThat(anonymousDetail.getBody().get("code")).isEqualTo(40401);
        assertThat(nonOwnerDetail.getBody().get("code")).isEqualTo(40401);
        assertThat(ownerDetail.getBody().get("code")).isEqualTo(200);
        assertThat(data(ownerDetail).get("status")).isEqualTo(ServicePackageStatus.OFFLINE.name());
        assertThat(legacyOwnerDetail.getBody().get("code")).isEqualTo(200);
        assertThat(forgedHeaderDetail.getBody().get("code")).isEqualTo(40401);
    }

    @Test
    void providerHistoryReturnsOwnOnlineAndOfflinePackagesExceptHidden() throws Exception {
        Long offlineServiceId = createServicePackage();
        rest.exchange(
                "/service-packages/" + offlineServiceId + "/offline",
                HttpMethod.PATCH,
                providerEntity(null),
                Map.class);
        Thread.sleep(25);
        Long onlineServiceId = createServicePackage();
        Thread.sleep(25);
        Long hiddenServiceId = createServicePackage();
        rest.exchange(
                "/service-packages/" + hiddenServiceId,
                HttpMethod.DELETE,
                providerEntity(null),
                Map.class);
        createServicePackageFor(OTHER_PROVIDER_ID);

        ResponseEntity<Map> historyResponse = rest.exchange(
                "/service-packages/me/history",
                HttpMethod.GET,
                providerEntity(null),
                Map.class);
        ResponseEntity<Map> legacyHistoryResponse = rest.exchange(
                "/services/me/history",
                HttpMethod.GET,
                providerEntity(null),
                Map.class);

        List<Map<String, Object>> history = (List<Map<String, Object>>) historyResponse.getBody().get("data");
        assertThat(historyResponse.getBody().get("code")).isEqualTo(200);
        assertThat(history).extracting(item -> numberValue(item, "serviceId"))
                .containsExactly(onlineServiceId, offlineServiceId);
        assertThat(history).extracting(item -> item.get("status"))
                .containsExactly(ServicePackageStatus.ONLINE.name(), ServicePackageStatus.OFFLINE.name());
        assertThat(((List<Map<String, Object>>) legacyHistoryResponse.getBody().get("data")))
                .extracting(item -> numberValue(item, "serviceId"))
                .containsExactly(onlineServiceId, offlineServiceId);
        assertThat(servicePackageRepository.findById(hiddenServiceId).orElseThrow().getHiddenByProvider()).isTrue();
        assertThat(serviceIds(rest.getForEntity("/service-packages", Map.class))).doesNotContain(offlineServiceId);
    }

    private Long createServicePackage() {
        return createServicePackageFor(PROVIDER_ID);
    }

    private Long createServicePackageFor(Long providerId) {
        ResponseEntity<Map> createResponse = rest.exchange(
                "/service-packages",
                HttpMethod.POST,
                providerEntity(providerId, createServicePackageBody()),
                Map.class);
        assertThat(createResponse.getBody()).isNotNull();
        assertThat(createResponse.getBody().get("code")).isEqualTo(200);
        return numberValue(data(createResponse), "serviceId");
    }

    private HttpEntity<String> customerEntity(Long customerId, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", customerId.toString());
        headers.set("X-User-Role", "CUSTOMER");
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<String> providerEntity(String body) {
        return providerEntity(PROVIDER_ID, body);
    }

    private HttpEntity<String> providerEntity(Long providerId, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", providerId.toString());
        headers.set("X-User-Role", "PROVIDER");
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<String> bearerEntity(Long userId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtUtil.generateToken(userId));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(null, headers);
    }

    private String createServicePackageBody() {
        return """
                {
                  "title":"Graduation portrait package",
                  "cityCode":"NJ",
                  "serviceArea":"NJU campus",
                  "scene":"GRADUATION",
                  "styleTags":["Natural","Campus"],
                  "images":["https://cdn.example/cover.jpg","https://cdn.example/detail.jpg"],
                  "basePriceCent":39900,
                  "priceRange":"399-599",
                  "durationMinutes":120,
                  "originalCount":30,
                  "refinedCount":9,
                  "deliveryDays":7,
                  "availableDates":["%s"],
                  "portfolioIds":[11,12],
                  "description":"Outdoor graduation portraits.",
                  "timeDescription":"七月上旬周末可约",
                  "timeTags":["NEAR_7_DAYS"]
                }
                """.formatted(AVAILABLE_DATE);
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
