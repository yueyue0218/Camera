package com.action.camera.integration;

import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.common.JwtUtil;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@AutoConfigureMockMvc
@ActiveProfiles("smoke")
class AdminHallModerationIntegrationTest {

    private static final Long ADMIN_ID = 92201L;
    private static final Long CUSTOMER_ID = 92202L;
    private static final Long PROVIDER_ID = 92203L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private ServicePackageRepository servicePackageRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private AuditRecordRepository auditRecordRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        reportRepository.deleteAll();
        auditRecordRepository.deleteAll();
        demandRepository.deleteAll();
        servicePackageRepository.deleteAll();
        jdbcTemplate.update("DELETE FROM users WHERE id IN (?, ?, ?)", ADMIN_ID, CUSTOMER_ID, PROVIDER_ID);
        insertUser(ADMIN_ID, "admin-integration", "ADMIN");
        insertUser(CUSTOMER_ID, "customer-integration", "CUSTOMER");
        insertUser(PROVIDER_ID, "provider-integration", "PROVIDER");
    }

    @Test
    void ordinaryUserGetsForbiddenFromAdminHallList() throws Exception {
        mockMvc.perform(get("/admin/hall-items")
                        .header(HttpHeaders.AUTHORIZATION, bearer(CUSTOMER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40301));
    }

    @Test
    void adminTakeDownRemovesDemandFromGetDemandsWithoutClosingIt() throws Exception {
        Demand demand = saveDemand();

        mockMvc.perform(patch("/admin/hall-items/DEMAND/{id}/take-down", demand.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"policy violation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.businessStatus").value("OPEN"))
                .andExpect(jsonPath("$.data.moderationStatus").value("HIDDEN"));

        mockMvc.perform(get("/demands"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[*].demandId", not(hasItem(demand.getId().intValue()))));
        org.assertj.core.api.Assertions.assertThat(
                        demandRepository.findById(demand.getId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.OPEN);
    }

    @Test
    void adminRestoreReturnsDemandToGetDemands() throws Exception {
        Demand demand = saveDemand();
        demand.takeDown(ADMIN_ID, "initial review", LocalDateTime.of(2026, 9, 1, 10, 0));
        demandRepository.saveAndFlush(demand);

        mockMvc.perform(patch("/admin/hall-items/DEMAND/{id}/restore", demand.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"appeal accepted\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.businessStatus").value("OPEN"))
                .andExpect(jsonPath("$.data.moderationStatus").value("VISIBLE"));

        mockMvc.perform(get("/demands"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[*].demandId", hasItem(demand.getId().intValue())));
    }

    @Test
    void adminTakeDownRemovesServiceFromBothPublicAliasesWithoutOffliningIt() throws Exception {
        ServicePackage servicePackage = saveService();

        mockMvc.perform(patch("/admin/hall-items/SERVICE_PACKAGE/{id}/take-down", servicePackage.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"misleading service\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.businessStatus").value("ONLINE"))
                .andExpect(jsonPath("$.data.moderationStatus").value("HIDDEN"));

        for (String alias : List.of("/services", "/service-packages")) {
            mockMvc.perform(get(alias))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.records[*].serviceId",
                            not(hasItem(servicePackage.getId().intValue()))));
        }
        org.assertj.core.api.Assertions.assertThat(
                        servicePackageRepository.findById(servicePackage.getId()).orElseThrow().getStatus())
                .isEqualTo(ServicePackageStatus.ONLINE);
    }

    private Demand saveDemand() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 9, 1, 9, 0);
        return demandRepository.saveAndFlush(new Demand(
                CUSTOMER_ID,
                "PORTRAIT",
                List.of("natural"),
                LocalDate.of(2026, 9, 10),
                "14:00-16:00",
                "weekday afternoons",
                List.of("NEAR_1_MONTH"),
                "NJ",
                "NJU campus",
                20000,
                40000,
                "integration demand",
                List.of(),
                createdAt,
                createdAt.plusDays(30)));
    }

    private ServicePackage saveService() {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setProviderId(PROVIDER_ID);
        servicePackage.setTitle("Integration service");
        servicePackage.setCityCode("NJ");
        servicePackage.setServiceArea("NJU campus");
        servicePackage.setScene("PORTRAIT");
        servicePackage.setStyleTags(List.of("natural"));
        servicePackage.setImages(List.of("https://cdn.example/cover.jpg"));
        servicePackage.setBasePriceCent(39900L);
        servicePackage.setDurationMinutes(120);
        servicePackage.setOriginalCount(30);
        servicePackage.setRefinedCount(9);
        servicePackage.setDeliveryDays(7);
        servicePackage.setAvailableDates(List.of(LocalDate.of(2026, 9, 10)));
        servicePackage.setPortfolioIds(List.of());
        servicePackage.setDescription("integration service");
        servicePackage.setTimeDescription("weekday afternoons");
        servicePackage.setTimeTags(List.of("NEAR_1_MONTH"));
        servicePackage.setStatus(ServicePackageStatus.ONLINE);
        servicePackage.setIsAvailable(true);
        servicePackage.setCreatedAt(LocalDateTime.of(2026, 9, 1, 9, 0));
        servicePackage.setUpdatedAt(LocalDateTime.of(2026, 9, 1, 9, 0));
        return servicePackageRepository.saveAndFlush(servicePackage);
    }

    private String bearer(Long userId) {
        return "Bearer " + jwtUtil.generateToken(userId);
    }

    private void insertUser(Long id, String nickname, String role) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                """, id, nickname, role);
    }
}
