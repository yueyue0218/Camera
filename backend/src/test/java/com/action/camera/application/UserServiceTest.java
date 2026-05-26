package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.dto.LoginResponse;
import com.action.camera.dto.UserProfileResponse;
import com.action.camera.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;

@SpringBootTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
    "spring.jpa.properties.hibernate.globally_quoted_identifiers=true",
    "jwt.secret=test-secret-key-for-unit-testing-purposes-only"
})
class UserServiceTest {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private VerificationCodeService codeService;

    @MockBean
    private JavaMailSender javaMailSender;

    private static final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("注册-正常：有效邮箱+验证码+密码+昵称 → 用户存入 DB，密码已 BCrypt 加密")
    void register_success() {
        doNothing().when(codeService).verify(anyString(), anyString());

        userService.register(
                "241880166@smail.nju.edu.cn", "123456", "test123456", "测试用户");

        User saved = userRepository.findByStudentNo("241880166").orElseThrow();
        assertThat(saved.getNickname()).isEqualTo("测试用户");
        assertThat(saved.getSchool()).isEqualTo("南京大学");
        assertThat(saved.getStatus()).isEqualTo("ACTIVE");
        assertThat(saved.getPasswordHash()).isNotEqualTo("test123456");
        assertThat(encoder.matches("test123456", saved.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("注册-异常：学号已注册 → 抛出 BusinessException（该学号已注册）")
    void register_duplicateStudentNo() {
        doNothing().when(codeService).verify(anyString(), anyString());
        userService.register(
                "241880166@smail.nju.edu.cn", "123456", "test123456", "用户一");

        assertThatThrownBy(() ->
            userService.register(
                    "241880166@smail.nju.edu.cn", "654321", "password2", "用户二")
        ).isInstanceOf(BusinessException.class)
         .hasMessageContaining("该学号已注册");
    }

    @Test
    @DisplayName("注册-异常：验证码错误 → 抛出 BusinessException（验证码错误）")
    void register_wrongCode() {
        doThrow(new BusinessException(ErrorCode.VALIDATION_ERROR, "验证码错误"))
                .when(codeService).verify(anyString(), anyString());

        assertThatThrownBy(() ->
            userService.register(
                    "241880166@smail.nju.edu.cn", "000000", "test123456", "测试用户")
        ).isInstanceOf(BusinessException.class)
         .hasMessageContaining("验证码错误");
    }

    @Test
    @DisplayName("登录-正常：正确学号+密码 → 返回非空 token 和正确昵称")
    void login_success() {
        createTestUser("241880166", "test123456", "ACTIVE");

        LoginResponse response = userService.login("241880166", "test123456");

        assertThat(response.getToken()).isNotBlank();
        assertThat(response.getUserId()).isNotNull();
        assertThat(response.getNickname()).isEqualTo("测试用户");
    }

    @Test
    @DisplayName("登录-异常：学号不存在 → 抛出 BusinessException（学号或密码错误）")
    void login_studentNoNotFound() {
        assertThatThrownBy(() -> userService.login("999999999", "test123456"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("学号或密码错误");
    }

    @Test
    @DisplayName("登录-异常：密码错误 → 抛出 BusinessException（学号或密码错误）")
    void login_wrongPassword() {
        createTestUser("241880166", "test123456", "ACTIVE");

        assertThatThrownBy(() -> userService.login("241880166", "wrongpassword"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("学号或密码错误");
    }

    @Test
    @DisplayName("登录-异常：账号已禁用 → 抛出 BusinessException（账号已被禁用）")
    void login_accountDisabled() {
        createTestUser("241880166", "test123456", "BANNED");

        assertThatThrownBy(() -> userService.login("241880166", "test123456"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("账号已被禁用");
    }

    @Test
    @DisplayName("查个人资料-正常：有效 userId → 返回完整信息")
    void getMyProfile_success() {
        User user = createTestUser("241880166", "test123456", "ACTIVE");

        UserProfileResponse profile = userService.getMyProfile(user.getId());

        assertThat(profile.getNickname()).isEqualTo("测试用户");
        assertThat(profile.getStudentNo()).isEqualTo("241880166");
        assertThat(profile.getSchool()).isEqualTo("南京大学");
        assertThat(profile.getCreditScore()).isNotNull();
    }

    @Test
    @DisplayName("查个人资料-异常：userId 不存在 → 抛出 BusinessException（用户不存在）")
    void getMyProfile_notFound() {
        assertThatThrownBy(() -> userService.getMyProfile(99999L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("用户不存在");
    }

    private User createTestUser(String studentNo, String password, String status) {
        User user = new User();
        user.setStudentNo(studentNo);
        user.setPasswordHash(encoder.encode(password));
        user.setNickname("测试用户");
        user.setSchool("南京大学");
        user.setStatus(status);
        return userRepository.save(user);
    }
}
