package com.action.camera.integration;

import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.UserContext;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
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
class AdminUserRestrictionIntegrationTest {

    private static final String PASSWORD = "test123456";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private UserRoleBindingRepository userRoleBindingRepository;
    @Autowired
    private AuditRecordRepository auditRecordRepository;
    @Autowired
    private ObjectMapper objectMapper;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        UserContext.clear();
        auditRecordRepository.deleteAll();
        userRoleBindingRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void disablingUserImmediatelyInvalidatesOldJwtAndRestoreAllowsNewLogin() throws Exception {
        User admin = createUser("241882001", "admin", "ADMIN", "ACTIVE");
        User target = createUser("241882002", "target", "CUSTOMER", "ACTIVE");
        String oldToken = login("241882002", "CUSTOMER");

        mockMvc.perform(get("/notifications").header(HttpHeaders.AUTHORIZATION, bearer(oldToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        mockMvc.perform(patch("/admin/users/{id}/status", target.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(jwtUtil.generateToken(admin.getId())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISABLED\",\"reason\":\"account abuse\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("DISABLED"));

        mockMvc.perform(get("/notifications").header(HttpHeaders.AUTHORIZATION, bearer(oldToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40101));
        assertThat(UserContext.getUserId()).isNull();
        assertThat(UserContext.getCurrentRole()).isNull();
        assertThat(UserContext.isAdmin()).isFalse();

        mockMvc.perform(post("/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("241882002", "CUSTOMER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40001));

        mockMvc.perform(patch("/admin/users/{id}/status", target.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(jwtUtil.generateToken(admin.getId())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACTIVE\",\"reason\":\"appeal accepted\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        String newToken = login("241882002", "CUSTOMER");
        mockMvc.perform(get("/notifications").header(HttpHeaders.AUTHORIZATION, bearer(newToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        assertThat(auditRecordRepository.findAll())
                .extracting("auditResult")
                .containsExactly("DISABLE", "ENABLE");
    }

    @Test
    void administratorCannotDisableSelfThroughHttp() throws Exception {
        User admin = createUser("241882003", "admin-self", "ADMIN", "ACTIVE");
        createUser("241882004", "backup-admin", "ADMIN", "ACTIVE");

        mockMvc.perform(patch("/admin/users/{id}/status", admin.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(jwtUtil.generateToken(admin.getId())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISABLED\",\"reason\":\"self disable\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40301));

        assertThat(userRepository.findById(admin.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(auditRecordRepository.count()).isZero();
    }

    @Test
    void administratorCannotDisableLastActiveAdministratorThroughHttp() throws Exception {
        User lastAdmin = createUser("241882005", "last-admin", "ADMIN", "ACTIVE");

        mockMvc.perform(patch("/admin/users/{id}/status", lastAdmin.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(jwtUtil.generateToken(lastAdmin.getId())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISABLED\",\"reason\":\"rotation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40301));

        assertThat(userRepository.findById(lastAdmin.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(auditRecordRepository.count()).isZero();
    }

    private String login(String studentNo, String role) throws Exception {
        String body = mockMvc.perform(post("/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody(studentNo, role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode json = objectMapper.readTree(body);
        return json.path("data").path("token").asText();
    }

    private User createUser(String studentNo, String nickname, String role, String userStatus) {
        User user = new User();
        user.setStudentNo(studentNo);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setNickname(nickname);
        user.setSchool("南京大学");
        user.setCurrentRole(role);
        user.setStatus(userStatus);
        return userRepository.saveAndFlush(user);
    }

    private String loginBody(String studentNo, String role) {
        return "{\"studentNo\":\"" + studentNo + "\",\"password\":\"" + PASSWORD
                + "\",\"role\":\"" + role + "\"}";
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
