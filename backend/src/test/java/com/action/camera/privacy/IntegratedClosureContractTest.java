package com.action.camera.privacy;

import com.action.camera.account.domain.AccountCancellationRequest;
import com.action.camera.account.repository.*;
import com.action.camera.account.service.SelfAccountClosureService;
import com.action.camera.admin.service.AdminPermissionService;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.dto.SmsChallengeResponse;
import com.action.camera.auth.service.*;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.GlobalExceptionHandler;
import com.action.camera.domain.User;
import com.action.camera.privacy.controller.PrivacyController;
import com.action.camera.privacy.service.*;
import com.action.camera.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** HTTP JSON -> production closure service contract; no database, cloud, or HTTP server. */
class IntegratedClosureContractTest {
    static final String ID="12345678-1234-4123-8123-123456789abc";
    PhoneSmsService sms; AccountCancellationCleanupRepository cleanup; MockMvc mvc;
    @BeforeEach void setup() {
        sms=mock(PhoneSmsService.class); cleanup=mock(AccountCancellationCleanupRepository.class);
        var users=mock(UserRepository.class); var codec=mock(PhoneIdentityCodec.class);
        var requests=mock(AccountCancellationRequestRepository.class);
        User user=new User(); user.setId(41L); user.setStatus("ACTIVE"); user.setMobileHash("fixture-hash");
        when(users.findById(41L)).thenReturn(Optional.of(user));
        when(users.findByIdForUpdate(41L)).thenReturn(Optional.of(user));
        when(codec.lookupHash("+8613800138000")).thenReturn("fixture-hash");
        when(requests.findByUserIdForUpdate(41L)).thenReturn(Optional.empty());
        var closure=new SelfAccountClosureService(users,sms,codec,new PhoneNumberNormalizer(),requests,cleanup,mock(AdminPermissionService.class));
        mvc=MockMvcBuilders.standaloneSetup(new PrivacyController(mock(PrivacyConsentService.class),mock(PrivacyRightService.class),closure))
            .setControllerAdvice(new GlobalExceptionHandler()).build();
        UserContext.setUserId(41L); UserContext.setSessionId("fixture-session");
    }
    @AfterEach void clear(){UserContext.clear();}
    @Test void sendBindsAuthenticatedAccountSessionAndOperation() throws Exception {
        when(sms.createChallenge(eq("+8613800138000"),eq(SmsPurpose.REAUTH),anyString(),eq("device"),eq(41L),eq("fixture-session"),eq("ACCOUNT_CLOSURE")))
            .thenReturn(new SmsChallengeResponse(ID,LocalDateTime.of(2026,11,4,12,0)));
        mvc.perform(post("/privacy/account-closure/code").contentType(MediaType.APPLICATION_JSON)
            .content("{\"phone\":\"13800138000\",\"deviceId\":\"device\"}"))
            .andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.challengeId").value(ID));
        verify(sms).createChallenge("+8613800138000",SmsPurpose.REAUTH,"127.0.0.1","device",41L,"fixture-session","ACCOUNT_CLOSURE");
    }
    @Test void legacyClosureJsonWithoutChallengeIsRejectedBeforeCleanup() throws Exception {
        mvc.perform(post("/privacy/account-closure").contentType(MediaType.APPLICATION_JSON)
            .content("{\"phone\":\"13800138000\",\"code\":\"123456\",\"confirmed\":true}"))
            .andExpect(jsonPath("$.code").value(40001));
        verifyNoInteractions(sms,cleanup);
    }
    @Test void challengeFromClientReachesConsumptionWithServerOwnedBindings() throws Exception {
        mvc.perform(post("/privacy/account-closure").contentType(MediaType.APPLICATION_JSON)
            .content("{\"phone\":\"13800138000\",\"code\":\"123456\",\"confirmed\":true,\"challengeId\":\""+ID+"\",\"userId\":99,\"sessionId\":\"attacker\"}"))
            .andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.status").value("CLOSED"));
        var order=inOrder(sms,cleanup);
        order.verify(sms).consumeChallenge(ID,"+8613800138000",SmsPurpose.REAUTH,"123456",41L,"fixture-session","ACCOUNT_CLOSURE");
        order.verify(cleanup).cleanupUserData(eq(41L),eq("fixture-hash"),any());
    }
}
