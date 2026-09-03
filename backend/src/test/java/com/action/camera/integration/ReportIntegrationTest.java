package com.action.camera.integration;

import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.UserContext;
import com.action.camera.domain.User;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@AutoConfigureMockMvc
@ActiveProfiles("smoke")
@TestPropertySource(properties =
        "spring.datasource.url=jdbc:h2:mem:report_integration_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1")
class ReportIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired ReportRepository reportRepository;
    @Autowired AuditRecordRepository auditRecordRepository;

    private User reporter;
    private User target;
    private User admin;

    @BeforeEach
    void setUp() {
        UserContext.clear();
        auditRecordRepository.deleteAll();
        reportRepository.deleteAll();
        userRepository.deleteAll();
        reporter = createUser("reporter", "CUSTOMER");
        target = createUser("target", "CUSTOMER");
        admin = createUser("admin", "ADMIN");
    }

    @Test
    void reporterAndAdminCanCompleteAuditedIgnoreWorkflow() throws Exception {
        String createBody = mockMvc.perform(post("/reports")
                        .header(HttpHeaders.AUTHORIZATION, bearer(reporter))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"USER\",\"targetId\":" + target.getId()
                                + ",\"reason\":\"harassment\",\"description\":\"messages\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        Number reportIdValue = com.jayway.jsonpath.JsonPath.read(createBody, "$.data.reportId");
        Long reportId = reportIdValue.longValue();

        mockMvc.perform(get("/reports/my")
                        .header(HttpHeaders.AUTHORIZATION, bearer(reporter)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].reportId").value(reportId));

        mockMvc.perform(get("/admin/reports")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].reportId").value(reportId));

        mockMvc.perform(get("/admin/reports/{reportId}", reportId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));

        mockMvc.perform(patch("/admin/reports/{reportId}/resolve", reportId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resolution\":\"IGNORE\",\"adminComment\":\"not actionable\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"))
                .andExpect(jsonPath("$.data.resolution").value("IGNORE"));

        assertThat(auditRecordRepository.findTop10ByAuditTypeAndTargetIdOrderByCreatedAtDesc(
                "REPORT", reportId)).extracting("auditResult", "remark")
                .containsExactly(org.assertj.core.groups.Tuple.tuple(
                        "RESOLVE", "IGNORE: not actionable"));
    }

    @Test
    void ordinaryUserCannotUseAdminReportEndpoints() throws Exception {
        mockMvc.perform(get("/admin/reports")
                        .header(HttpHeaders.AUTHORIZATION, bearer(reporter)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40301));
    }

    private User createUser(String nickname, String role) {
        User user = new User();
        user.setNickname(nickname);
        user.setCurrentRole(role);
        user.setStatus("ACTIVE");
        return userRepository.saveAndFlush(user);
    }

    private String bearer(User user) {
        return "Bearer " + jwtUtil.generateToken(user.getId());
    }
}
