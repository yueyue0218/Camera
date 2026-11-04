package com.action.camera.auth;

import com.action.camera.auth.config.SessionProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.dto.SmsChallengeResponse;
import com.action.camera.auth.service.*;
import com.action.camera.controller.AuthController;
import com.action.camera.common.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.MediaType;
import java.time.LocalDateTime;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DefaultSchemeChallengeApiTest {
    static final String ID="12345678-1234-1234-1234-123456789abc";
    PhoneSmsService sms; PhoneAuthenticationService auth; MockMvc mvc;
    @BeforeEach void setup() {
        sms=mock(PhoneSmsService.class); auth=mock(PhoneAuthenticationService.class);
        mvc=MockMvcBuilders.standaloneSetup(new AuthController(sms,auth,mock(AuthSessionService.class),new RefreshCookieService(new SessionProperties())))
            .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @Test void sendReturnsChallengeWithoutSecrets() throws Exception {
        when(sms.createChallenge(anyString(),eq(SmsPurpose.LOGIN),anyString(),anyString(),isNull(),isNull(),eq("LOGIN")))
            .thenReturn(new SmsChallengeResponse(ID,LocalDateTime.of(2026,11,3,12,0)));
        mvc.perform(post("/auth/sms/send").contentType(MediaType.APPLICATION_JSON)
            .content("{\"phone\":\"13800138000\",\"purpose\":\"LOGIN\",\"deviceId\":\"browser\"}"))
            .andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.challengeId").value(ID))
            .andExpect(jsonPath("$.data.code").doesNotExist()).andExpect(jsonPath("$.data.codeHash").doesNotExist());
    }
    @Test void bothLoginRoutesRejectMissingChallengeBeforeAuthentication() throws Exception {
        for(String path:new String[]{"/auth/sms/verify","/auth/native/sms/verify"}) {
            mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"purpose\":\"LOGIN\",\"code\":\"123456\",\"deviceId\":\"browser\"}"))
                .andExpect(jsonPath("$.code").value(40001));
        }
        verifyNoInteractions(auth);
    }
    @Test void suppliedChallengeIsForwardedToAuthentication() throws Exception {
        when(auth.verifyAndLogin(eq(ID),anyString(),eq(SmsPurpose.LOGIN),anyString(),anyString(),any()))
            .thenThrow(new SmsCodeInvalidException());
        mvc.perform(post("/auth/native/sms/verify").contentType(MediaType.APPLICATION_JSON)
            .content("{\"challengeId\":\""+ID+"\",\"phone\":\"13800138000\",\"purpose\":\"LOGIN\",\"code\":\"123456\",\"deviceId\":\"browser\"}"))
            .andExpect(jsonPath("$.code").value(40002));
        verify(auth).verifyAndLogin(ID,"13800138000",SmsPurpose.LOGIN,"123456","browser",null);
    }
}
