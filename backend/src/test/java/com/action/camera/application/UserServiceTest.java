package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.domain.UserRoleBinding;
import com.action.camera.dto.LoginResponse;
import com.action.camera.dto.UpdateProfileRequest;
import com.action.camera.dto.UserBriefResponse;
import com.action.camera.dto.UserProfileResponse;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
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
    "spring.datasource.url=jdbc:h2:mem:user_service_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
    "jwt.secret=test-secret-key-for-unit-testing-purposes-only"
})
class UserServiceTest {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserRoleBindingRepository userRoleBindingRepository;

    @MockBean
    private VerificationCodeService codeService;

    @MockBean
    private JavaMailSender javaMailSender;

    @MockBean
    private IpLocationService ipLocationService;

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        userRoleBindingRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("register saves a new user with encrypted password")
    void register_success() {
        doNothing().when(codeService).verify(anyString(), anyString());

        userService.register(
                "241880166@smail.nju.edu.cn", "123456", "test123456", "Test User", "CUSTOMER");

        User saved = userRepository.findByStudentNo("241880166").orElseThrow();
        assertThat(saved.getNickname()).isEqualTo("Test User");
        assertThat(saved.getSchool()).isEqualTo("南京大学");
        assertThat(saved.getStatus()).isEqualTo("ACTIVE");
        assertThat(saved.getCreditScore()).isEqualByComparingTo("80.00");
        assertThat(saved.getPasswordHash()).isNotEqualTo("test123456");
        assertThat(ENCODER.matches("test123456", saved.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("register rejects duplicate student number")
    void register_duplicateStudentNo() {
        doNothing().when(codeService).verify(anyString(), anyString());
        userService.register(
                "241880166@smail.nju.edu.cn", "123456", "test123456", "User One", "CUSTOMER");

        assertThatThrownBy(() ->
                userService.register(
                        "241880166@smail.nju.edu.cn", "654321", "password2", "User Two", "CUSTOMER"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("该学号已注册");
    }

    @Test
    @DisplayName("register rejects wrong verification code")
    void register_wrongCode() {
        doThrow(new BusinessException(ErrorCode.VALIDATION_ERROR, "验证码错误"))
                .when(codeService).verify(anyString(), anyString());

        assertThatThrownBy(() ->
                userService.register(
                        "241880166@smail.nju.edu.cn", "000000", "test123456", "Test User", "CUSTOMER"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("验证码错误");
    }

    @Test
    @DisplayName("login returns token for valid credentials")
    void login_success() {
        createTestUser("241880166", "test123456", "ACTIVE");

        LoginResponse response = userService.login("241880166", "test123456", "CUSTOMER", null);

        assertThat(response.getToken()).isNotBlank();
        assertThat(response.getUserId()).isNotNull();
        assertThat(response.getNickname()).isEqualTo("Test User");
        assertThat(response.getRole()).isEqualTo("CUSTOMER");
        assertThat(response.isAdminCapable()).isFalse();
    }

    @Test
    @DisplayName("login rejects unknown student number")
    void login_studentNoNotFound() {
        assertThatThrownBy(() -> userService.login("999999999", "test123456", "CUSTOMER", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("学号或密码错误");
    }

    @Test
    @DisplayName("login rejects wrong password")
    void login_wrongPassword() {
        createTestUser("241880166", "test123456", "ACTIVE");

        assertThatThrownBy(() -> userService.login("241880166", "wrongpassword", "CUSTOMER", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("学号或密码错误");
    }

    @Test
    @DisplayName("login rejects disabled account")
    void login_accountDisabled() {
        createTestUser("241880166", "test123456", "BANNED");

        assertThatThrownBy(() -> userService.login("241880166", "test123456", "CUSTOMER", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("账号已被禁用");
    }

    @Test
    @DisplayName("login cannot escalate a normal user to admin")
    void login_customerCannotEscalateToAdmin() {
        User user = createTestUser("241880168", "test123456", "ACTIVE");

        assertThatThrownBy(() -> userService.login("241880168", "test123456", "ADMIN", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("管理员账号需通过专用入口登录");

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getCurrentRole()).isEqualTo("CUSTOMER");
    }

    @Test
    @DisplayName("login cannot rewrite an existing admin account role")
    void login_adminAccountCannotUseCommonRoleEntry() {
        User admin = createTestUser("241880169", "test123456", "ACTIVE", "ADMIN");

        assertThatThrownBy(() -> userService.login("241880169", "test123456", "CUSTOMER", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("管理员账号需通过专用入口登录");

        User reloaded = userRepository.findById(admin.getId()).orElseThrow();
        assertThat(reloaded.getCurrentRole()).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("admin login returns token for active admin account")
    void adminLogin_success() {
        User admin = createTestUser("241880170", "test123456", "ACTIVE", "ADMIN");

        LoginResponse response = userService.adminLogin("241880170", "test123456");

        assertThat(response.getToken()).isNotBlank();
        assertThat(response.getUserId()).isEqualTo(admin.getId());
        assertThat(response.getRole()).isEqualTo("ADMIN");
        assertThat(response.isAdminCapable()).isTrue();
    }

    @Test
    @DisplayName("admin login rejects non-admin account")
    void adminLogin_rejectsNonAdminAccount() {
        createTestUser("241880171", "test123456", "ACTIVE", "CUSTOMER");

        assertThatThrownBy(() -> userService.adminLogin("241880171", "test123456"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("当前账号没有管理员权限");
    }

    @Test
    @DisplayName("provider account with admin binding can still use normal provider login")
    void login_providerWithAdminBindingKeepsProviderRole() {
        User user = createTestUser("241880172", "test123456", "ACTIVE", "PROVIDER");
        grantAdminBinding(user.getId());

        LoginResponse response = userService.login("241880172", "test123456", "PROVIDER", null);

        assertThat(response.getRole()).isEqualTo("PROVIDER");
        assertThat(response.isAdminCapable()).isTrue();
        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getCurrentRole()).isEqualTo("PROVIDER");
    }

    @Test
    @DisplayName("provider account with admin binding can use admin login")
    void adminLogin_providerWithAdminBindingSucceeds() {
        User user = createTestUser("241880173", "test123456", "ACTIVE", "PROVIDER");
        grantAdminBinding(user.getId());

        LoginResponse response = userService.adminLogin("241880173", "test123456");

        assertThat(response.getToken()).isNotBlank();
        assertThat(response.getUserId()).isEqualTo(user.getId());
        assertThat(response.getRole()).isEqualTo("ADMIN");
        assertThat(response.isAdminCapable()).isTrue();
    }

    @Test
    @DisplayName("getMyProfile returns persisted user profile")
    void getMyProfile_success() {
        User user = createTestUser("241880166", "test123456", "ACTIVE");

        UserProfileResponse profile = userService.getMyProfile(user.getId());

        assertThat(profile.getNickname()).isEqualTo("Test User");
        assertThat(profile.getStudentNo()).isEqualTo("241880166");
        assertThat(profile.getSchool()).isEqualTo("南京大学");
        assertThat(profile.getCreditScore()).isNull();
    }

    @Test
    @DisplayName("getMyProfile rejects unknown user")
    void getMyProfile_notFound() {
        assertThatThrownBy(() -> userService.getMyProfile(99999L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("用户不存在");
    }

    @Test
    @DisplayName("customer brief returns latest avatar after profile update")
    void updateCustomerAvatar_returnsLatestAvatarInBrief() {
        User user = createTestUser("241880166", "test123456", "ACTIVE");
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setRole("CUSTOMER");
        request.setAvatarFileId(501L);

        userService.updateMyProfile(user.getId(), request);

        UserBriefResponse brief = userService.getUserBrief(user.getId());
        UserProfileResponse profile = userService.getMyProfile(user.getId());
        assertThat(brief.getAvatarFileId()).isEqualTo(501L);
        assertThat(profile.getCustomerAvatarFileId()).isEqualTo(501L);
    }

    @Test
    @DisplayName("provider brief returns latest avatar after profile update")
    void updateProviderAvatar_returnsLatestAvatarInBrief() {
        User user = createTestUser("241880167", "test123456", "ACTIVE");
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setRole("PROVIDER");
        request.setAvatarFileId(777L);

        userService.updateMyProfile(user.getId(), request);

        UserBriefResponse brief = userService.getUserBrief(user.getId());
        UserProfileResponse profile = userService.getMyProfile(user.getId());
        assertThat(brief.getAvatarFileId()).isEqualTo(777L);
        assertThat(profile.getProviderAvatarFileId()).isEqualTo(777L);
    }

    private User createTestUser(String studentNo, String password, String status) {
        return createTestUser(studentNo, password, status, "CUSTOMER");
    }

    private User createTestUser(String studentNo, String password, String status, String currentRole) {
        User user = new User();
        user.setStudentNo(studentNo);
        user.setPasswordHash(ENCODER.encode(password));
        user.setNickname("Test User");
        user.setSchool("南京大学");
        user.setStatus(status);
        user.setCurrentRole(currentRole);
        return userRepository.save(user);
    }

    private void grantAdminBinding(Long userId) {
        UserRoleBinding binding = new UserRoleBinding();
        binding.setUserId(userId);
        binding.setRole("ADMIN");
        userRoleBindingRepository.save(binding);
    }
}
