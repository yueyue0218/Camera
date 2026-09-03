package com.action.camera.integration;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.common.JwtUtil;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.repository.MomentPostRepository;
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

import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@AutoConfigureMockMvc
@ActiveProfiles("smoke")
class AdminMomentModerationIntegrationTest {

    private static final Long ADMIN_ID = 92401L;
    private static final Long AUTHOR_ID = 92402L;
    private static final Long VIEWER_ID = 92403L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private MomentPostRepository momentPostRepository;

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
        momentPostRepository.deleteAll();
        jdbcTemplate.update("DELETE FROM users WHERE id IN (?, ?, ?)", ADMIN_ID, AUTHOR_ID, VIEWER_ID);
        insertUser(ADMIN_ID, "admin-moment-http", "ADMIN");
        insertUser(AUTHOR_ID, "author-moment-http", "CUSTOMER");
        insertUser(VIEWER_ID, "viewer-moment-http", "PROVIDER");
    }

    @Test
    void adminMomentRoutesModerateWithoutChangingPublishedState() throws Exception {
        MomentPost moment = saveMoment();

        mockMvc.perform(get("/admin/moments")
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records[*].momentId", hasItem(moment.getId().intValue())));

        mockMvc.perform(get("/moments")
                        .header(HttpHeaders.AUTHORIZATION, bearer(VIEWER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].momentId", hasItem(moment.getId().intValue())));
        mockMvc.perform(get("/users/{id}/public-profile", AUTHOR_ID)
                        .param("role", "CUSTOMER")
                        .header(HttpHeaders.AUTHORIZATION, bearer(VIEWER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.momentCount").value(1));

        mockMvc.perform(patch("/admin/moments/{id}/take-down", moment.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"policy violation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.businessStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.moderationStatus").value("HIDDEN"));

        MomentPost hidden = momentPostRepository.findById(moment.getId()).orElseThrow();
        assertThat(hidden.getStatus()).isEqualTo(MomentStatus.PUBLISHED);
        assertThat(hidden.getDeletedAt()).isNull();
        assertThat(hidden.getModerationStatus()).isEqualTo(ModerationStatus.HIDDEN);

        mockMvc.perform(get("/moments")
                        .header(HttpHeaders.AUTHORIZATION, bearer(VIEWER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].momentId", not(hasItem(moment.getId().intValue()))));
        mockMvc.perform(get("/moments/{id}", moment.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(VIEWER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40401));
        mockMvc.perform(get("/moments/{id}", moment.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(AUTHOR_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.moderation.status").value("HIDDEN"));
        mockMvc.perform(get("/users/{id}/public-profile", AUTHOR_ID)
                        .param("role", "CUSTOMER")
                        .header(HttpHeaders.AUTHORIZATION, bearer(VIEWER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.momentCount").value(0));

        mockMvc.perform(patch("/admin/moments/{id}/restore", moment.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"appeal accepted\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.businessStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.moderationStatus").value("VISIBLE"));

        mockMvc.perform(get("/moments/{id}", moment.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(VIEWER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        assertThat(auditRecordRepository.findAll())
                .extracting("auditType", "targetId", "auditResult")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("MOMENT", moment.getId(), "TAKE_DOWN"),
                        org.assertj.core.groups.Tuple.tuple("MOMENT", moment.getId(), "RESTORE"));
    }

    private MomentPost saveMoment() {
        MomentPost moment = new MomentPost();
        moment.setAuthorId(AUTHOR_ID);
        moment.setAuthorRole("CUSTOMER");
        moment.setTitle("Integration moment");
        moment.setContent("Integration content");
        moment.setStatus(MomentStatus.PUBLISHED);
        moment.setCreatedAt(LocalDateTime.of(2026, 9, 1, 9, 0));
        moment.setUpdatedAt(LocalDateTime.of(2026, 9, 1, 9, 0));
        moment.replaceImages(List.of("integration-image"));
        return momentPostRepository.saveAndFlush(moment);
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
