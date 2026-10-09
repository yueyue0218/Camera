package com.action.camera.integration;

import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.admin.service.AdminAuditService;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import static org.mockito.Mockito.doThrow;
import static org.mockito.ArgumentMatchers.*;
import com.action.camera.auth.service.AuthSessionService;
import com.action.camera.common.UserContext;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.support.TestAuthTokens;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@AutoConfigureMockMvc
@ActiveProfiles("smoke")
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:report_closure_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1")
class ReportClosureIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TestAuthTokens tokens;
    @Autowired AuthSessionService sessions;
    @Autowired UserRepository users;
    @Autowired DemandRepository demands;
    @Autowired ServicePackageRepository services;
    @Autowired ReportRepository reports;
    @Autowired AuditRecordRepository audits;
    @MockitoSpyBean AdminAuditService auditService;

    User reporter, owner, admin;
    String reporterToken, ownerToken, adminToken;

    @BeforeEach
    void setup() {
        UserContext.clear();
        reports.deleteAll();
        audits.deleteAll();
        demands.deleteAll();
        services.deleteAll();
        users.deleteAll();
        reporter = user("reporter", "CUSTOMER");
        owner = user("owner", "PROVIDER");
        admin = user("admin", "ADMIN");
        reporterToken = tokens.generateToken(reporter.getId());
        ownerToken = tokens.generateToken(owner.getId());
        adminToken = tokens.generateToken(admin.getId());
    }

    @ParameterizedTest
    @ValueSource(strings = {"DEMAND", "SERVICE_PACKAGE"})
    void reportTakeDownPreventsPublicReadAndInteractionAndRestoreReturnsContent(String type) throws Exception {
        long id = target(type);
        String interactionToken = type.equals("DEMAND") ? tokens.generateToken(user("responder", "PROVIDER").getId()) : reporterToken;
        interact(type, id, interactionToken, 200);
        long reportId = create(type, id);
        request(get("/admin/reports").header(HttpHeaders.AUTHORIZATION, bearer(adminToken)), 200);
        JsonNode detail = request(get("/admin/reports/" + reportId).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)), 200);
        assertThat(detail.path("data").path("targetId").asLong()).isEqualTo(id);
        resolve(reportId, "TAKE_DOWN", adminToken, 200);
        String path = publicPath(type, id);
        request(get(path), 40401);
        request(get(path).header(HttpHeaders.AUTHORIZATION, bearer(reporterToken)), 40401);
        request(get(path).header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)), 200);
        String listPath = type.equals("DEMAND") ? "/demands" : "/service-packages";
        String idField = type.equals("DEMAND") ? "demandId" : "serviceId";
        mvc.perform(get(listPath)).andExpect(jsonPath("$.data.records[*]." + idField, not(hasItem((int) id))));
        interact(type, id, interactionToken, 40901);
        request(patch("/admin/hall-items/" + type + "/" + id + "/restore")
                .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"appeal accepted\"}"), 200);
        request(get(path), 200);
        mvc.perform(get(listPath)).andExpect(jsonPath("$.data.records[*]." + idField, hasItem((int) id)));
        if (type.equals("DEMAND")) assertThat(demands.findById(id).orElseThrow().getStatus()).isEqualTo(DemandStatus.OPEN);
        else assertThat(services.findById(id).orElseThrow().getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        var saved = reports.findById(reportId).orElseThrow();
        assertThat(saved.getAdminId()).isEqualTo(admin.getId());
        assertThat(saved.getResolvedAt()).isNotNull();
        assertThat(audits.findAll()).hasSize(3);
    }

    @Test
    void reportUserRestrictionRejectsExistingAccessAndRefreshAndCanBeLifted() throws Exception {
        var oldSession = sessions.issue(owner, "PROVIDER", false, "closure-test", "JUnit");
        long reportId = create("USER", owner.getId());
        resolve(reportId, "RESTRICT_USER", adminToken, 200);
        request(get("/reports/my").header(HttpHeaders.AUTHORIZATION, bearer(oldSession.response().getToken())), 40101);
        assertThatThrownBy(() -> sessions.refresh(oldSession.refreshToken()))
                .isInstanceOf(com.action.camera.common.exception.BusinessException.class);
        assertThat(users.findById(owner.getId()).orElseThrow().getStatus()).isEqualTo("DISABLED");
        request(patch("/admin/users/" + owner.getId() + "/status").header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\",\"reason\":\"appeal accepted\"}"), 200);
        request(get("/reports/my").header(HttpHeaders.AUTHORIZATION, bearer(tokens.generateToken(owner.getId()))), 200);
        assertThat(audits.findAll()).hasSize(3);
    }

    @ParameterizedTest
    @ValueSource(strings = {"USER", "DEMAND", "SERVICE_PACKAGE"})
    void ignoredReportLeavesTargetUnchangedAndReleasesPendingDuplicateKey(String type) throws Exception {
        long id = type.equals("USER") ? owner.getId() : target(type);
        long reportId = create(type, id);
        createExpect(type, id, reporterToken, "reason", null, 40902);
        assertThat(reports.count()).isEqualTo(1);
        resolve(reportId, "IGNORE", adminToken, 200);
        if (type.equals("USER")) assertThat(users.findById(id).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        else request(get(publicPath(type, id)), 200);
        long second = create(type, id);
        assertThat(second).isNotEqualTo(reportId);
        assertThat(audits.findAll()).hasSize(1);
    }

    @Test
    void validationRejectsUnauthenticatedInvalidTypeMissingOwnTargetsAndOversizeFields() throws Exception {
        long demandId = target("DEMAND");
        long serviceId = target("SERVICE_PACKAGE");
        createExpect("USER", owner.getId(), null, "reason", null, 40101);
        createExpect("INVALID", owner.getId(), reporterToken, "reason", null, 40001);
        for (String type : List.of("USER", "DEMAND", "SERVICE_PACKAGE")) {
            createExpect(type, Long.MAX_VALUE, reporterToken, "reason", null, 40401);
        }
        createExpect("USER", reporter.getId(), reporterToken, "reason", null, 40001);
        createExpect("DEMAND", demandId, ownerToken, "reason", null, 40001);
        createExpect("SERVICE_PACKAGE", serviceId, ownerToken, "reason", null, 40001);
        createExpect("USER", owner.getId(), reporterToken, "   ", null, 40001);
        createExpect("USER", owner.getId(), reporterToken, "x".repeat(501), null, 40001);
        createExpect("USER", owner.getId(), reporterToken, "reason", "x".repeat(1001), 40001);
        assertThat(reports.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"DEMAND", "SERVICE_PACKAGE"})
    void hiddenTargetCannotBeReportedAndFailedResolutionRollsBackReportAndAudit(String type) throws Exception {
        long id = target(type);
        long reportId = create(type, id);
        request(patch("/admin/hall-items/" + type + "/" + id + "/take-down")
                .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"already hidden\"}"), 200);
        createExpect(type, id, reporterToken, "reason", null, 40401);
        resolve(reportId, "TAKE_DOWN", adminToken, 40901);
        assertThat(reports.findById(reportId).orElseThrow().getStatus().name()).isEqualTo("PENDING");
        assertThat(audits.findAll()).hasSize(1);
    }

    @Test
    void ordinaryUserCannotReadOrResolveAndCannotChooseAnUnrelatedTarget() throws Exception {
        long id = target("DEMAND");
        long other = target("DEMAND");
        long reportId = create("DEMAND", id);
        for (String path : List.of("/admin/reports", "/admin/reports/" + reportId))
            request(get(path).header(HttpHeaders.AUTHORIZATION, bearer(reporterToken)), 40301);
        resolve(reportId, "TAKE_DOWN", reporterToken, 40301);
        request(patch("/admin/reports/" + reportId + "/resolve").header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"resolution\":\"TAKE_DOWN\",\"adminComment\":\"reviewed\",\"targetId\":" + other + "}"), 200);
        request(get("/demands/" + id), 40401);
        request(get("/demands/" + other), 200);
    }

    @Test
    void concurrentResolutionProducesOneAuditAndOneStateConflict() throws Exception {
        long reportId = create("USER", owner.getId());
        List<Integer> codes = race(() -> resolve(reportId, "IGNORE", adminToken, null).path("code").asInt());
        assertThat(codes).containsExactlyInAnyOrder(200, 40901);
        assertThat(audits.findAll()).hasSize(1);
        resolve(reportId, "IGNORE", adminToken, 40901);
    }

    @Test
    void concurrentDuplicateCreationSavesOnePendingReport() throws Exception {
        List<Integer> codes = race(() -> createExpect("USER", owner.getId(), reporterToken, "reason", null, null).path("code").asInt());
        assertThat(codes).containsExactlyInAnyOrder(200, 40902);
        assertThat(reports.count()).isEqualTo(1);
    }

    @Test
    void administratorCannotRestrictSelfViaReportAndResolutionMismatchDoesNotMutate() throws Exception {
        long id = create("USER", admin.getId());
        resolve(id, "RESTRICT_USER", adminToken, 40301);
        resolve(id, "TAKE_DOWN", adminToken, 40001);
        assertThat(users.findById(admin.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(reports.findById(id).orElseThrow().getStatus().name()).isEqualTo("PENDING");
        assertThat(audits.count()).isZero();
    }


    @ParameterizedTest
    @ValueSource(strings = {"DEMAND", "SERVICE_PACKAGE"})
    void auditFailureAfterTargetWriteRollsBackTargetReportAndContentAudit(String type) throws Exception {
        long id = target(type);
        long reportId = create(type, id);
        // The real target mutation and content audit run; only the later report audit fails.
        doThrow(new IllegalStateException("injected report audit persistence failure"))
                .when(auditService).record(eq("REPORT"), eq(reportId), eq(admin.getId()), eq("RESOLVE"), anyString());
        resolve(reportId, "TAKE_DOWN", adminToken, 50001);
        request(get(publicPath(type, id)), 200);
        assertThat(reports.findById(reportId).orElseThrow().getStatus().name()).isEqualTo("PENDING");
        assertThat(audits.count()).isZero();
    }

    private List<Integer> race(Callable<Integer> operation) throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            Callable<Integer> task = () -> { start.await(); return operation.call(); };
            var one = executor.submit(task);
            var two = executor.submit(task);
            start.countDown();
            return List.of(one.get(20, TimeUnit.SECONDS), two.get(20, TimeUnit.SECONDS));
        } finally { executor.shutdownNow(); }
    }

    long target(String type) {
        if (type.equals("DEMAND")) {
            LocalDateTime now = LocalDateTime.now();
            return demands.saveAndFlush(new Demand(owner.getId(), "PORTRAIT", List.of("natural"), null,
                    "afternoon", "flexible", List.of("NEAR_1_MONTH"), "NJ", "campus", 10000, 20000,
                    "closure demand", List.of(), now, now.plusDays(30))).getId();
        }
        var item = new ServicePackage();
        item.setProviderId(owner.getId());
        item.setTitle("closure service");
        item.setCityCode("NJ");
        item.setServiceArea("campus");
        item.setScene("PORTRAIT");
        item.setBasePriceCent(10000L);
        item.setDurationMinutes(60);
        item.setOriginalCount(20);
        item.setRefinedCount(5);
        item.setDeliveryDays(7);
        item.setTimeDescription("flexible");
        item.setTimeTags(List.of("NEAR_1_MONTH"));
        item.setStatus(ServicePackageStatus.ONLINE);
        item.setIsAvailable(true);
        item.setCreatedAt(LocalDateTime.now());
        item.setUpdatedAt(LocalDateTime.now());
        return services.saveAndFlush(item).getId();
    }

    private User user(String nickname, String role) {
        var user = new User();
        user.setNickname(nickname);
        user.setCurrentRole(role);
        user.setStatus("ACTIVE");
        return users.saveAndFlush(user);
    }
    private void interact(String type, long id, String token, int expected) throws Exception {
        String path = publicPath(type, id) + (type.equals("DEMAND") ? "/responses" : "/interest");
        request(post(path).header(HttpHeaders.AUTHORIZATION, bearer(token)).contentType(MediaType.APPLICATION_JSON)
                .content(type.equals("DEMAND") ? "{\"message\":\"available\",\"expectedPriceCent\":15000}" : "{}"), expected);
    }
    private String publicPath(String type, long id) { return (type.equals("DEMAND") ? "/demands/" : "/service-packages/") + id; }
    private String bearer(String token) { return "Bearer " + token; }
    long create(String type, long id) throws Exception {
        return createExpect(type, id, reporterToken, "reason", "details", 200).path("data").path("reportId").asLong();
    }
    JsonNode createExpect(String type, long id, String token, String reason, String description, Integer expected) throws Exception {
        var body = new java.util.LinkedHashMap<String, Object>();
        body.put("targetType", type); body.put("targetId", id); body.put("reason", reason); body.put("description", description);
        var req = post("/reports").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (token != null) req.header(HttpHeaders.AUTHORIZATION, bearer(token));
        return request(req, expected);
    }
    JsonNode resolve(long id, String resolution, String token, Integer expected) throws Exception {
        return request(patch("/admin/reports/" + id + "/resolve").header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                        Map.of("resolution", resolution, "adminComment", "reviewed"))), expected);
    }
    private JsonNode request(MockHttpServletRequestBuilder req, Integer expected) throws Exception {
        var result = mvc.perform(req).andExpect(status().isOk());
        if (expected != null) result.andExpect(jsonPath("$.code").value(expected));
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
