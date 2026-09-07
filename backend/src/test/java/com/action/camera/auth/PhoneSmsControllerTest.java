package com.action.camera.auth;

import com.action.camera.auth.config.SessionProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.service.AuthSessionService;
import com.action.camera.auth.service.PhoneAuthenticationService;
import com.action.camera.auth.service.PhoneSmsService;
import com.action.camera.auth.service.RefreshCookieService;
import com.action.camera.auth.service.SessionAuthenticationResult;
import com.action.camera.common.exception.GlobalExceptionHandler;
import com.action.camera.controller.AuthController;
import com.action.camera.dto.LoginResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Duration;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PhoneSmsControllerTest {

    private PhoneSmsService phoneSmsService;
    private PhoneAuthenticationService phoneAuthenticationService;
    private AuthSessionService sessionService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        phoneSmsService = mock(PhoneSmsService.class);
        phoneAuthenticationService = mock(PhoneAuthenticationService.class);
        sessionService = mock(AuthSessionService.class);
        SessionProperties properties = new SessionProperties();
        AuthController controller = new AuthController(
                phoneSmsService, phoneAuthenticationService, sessionService, new RefreshCookieService(properties));
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void sendEndpointUsesServerObservedIpAndReturnsGenericSuccess() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.post("/auth/sms/send")
                        .with(request -> {
                            request.setRemoteAddr("203.0.113.25");
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "phone": "13800138000",
                                  "purpose": "LOGIN",
                                  "deviceId": "browser-device-b2"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data").doesNotExist());

        verify(phoneSmsService).sendCode(
                "13800138000", SmsPurpose.LOGIN, "203.0.113.25", "browser-device-b2");
    }

    @Test
    void publicSendEndpointRejectsNonLoginPurpose() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.post("/auth/sms/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "phone": "13800138000",
                                  "purpose": "CHANGE_PHONE",
                                  "deviceId": "browser-device-b2"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40001));

        verify(phoneSmsService, never()).sendCode(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void verifyEndpointKeepsRefreshTokenOutOfBodyAndSetsSecureCookie() throws Exception {
        when(phoneAuthenticationService.verifyAndLogin(
                anyString(), any(SmsPurpose.class), anyString(), anyString(), any()))
                .thenReturn(new SessionAuthenticationResult(
                        new LoginResponse("access-token", 42L, "新用户", "CUSTOMER", false),
                        "raw-refresh-token",
                        "camera_refresh",
                        Duration.ofDays(30)));

        mockMvc.perform(MockMvcRequestBuilders.post("/auth/sms/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "phone": "13800138000",
                                  "purpose": "LOGIN",
                                  "code": "123456",
                                  "deviceId": "browser-device-b2",
                                  "deviceName": "Chrome on Windows"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.token").value("access-token"))
                .andExpect(jsonPath("$.data.userId").value(42))
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
                .andExpect(header().string("Set-Cookie", containsString("camera_refresh=raw-refresh-token")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/auth/refresh")))
                .andExpect(header().string("Set-Cookie", containsString("Secure")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Lax")));

        verify(phoneAuthenticationService).verifyAndLogin(
                "13800138000", SmsPurpose.LOGIN, "123456", "browser-device-b2", "Chrome on Windows");
    }

    @Test
    void verifyEndpointRejectsInvalidCodeShapeBeforeCallingService() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.post("/auth/sms/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "phone": "13800138000",
                                  "purpose": "LOGIN",
                                  "code": "1234",
                                  "deviceId": "browser-device-b2"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40001));

        verify(phoneAuthenticationService, never()).verifyAndLogin(
                anyString(), any(), anyString(), anyString(), any());
    }
}
