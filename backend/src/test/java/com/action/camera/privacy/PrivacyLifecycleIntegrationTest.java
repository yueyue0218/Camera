package com.action.camera.privacy;

import com.action.camera.account.service.SelfAccountClosureService;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.service.*;
import com.action.camera.common.*;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.*;
import com.action.camera.repository.*;
import com.action.camera.privacy.dto.PrivacyDtos.*;
import com.action.camera.privacy.repository.*;
import com.action.camera.privacy.service.*;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.repository.MomentPostRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.http.client.factory=simple", "spring.datasource.url=jdbc:h2:mem:privacy_lifecycle;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1"})
@ActiveProfiles("smoke") @AutoConfigureMockMvc @Timeout(30)
class PrivacyLifecycleIntegrationTest {
    private static final AtomicInteger PHONE_SEQUENCE=new AtomicInteger(2000);
    @Autowired UserRepository users;
    @Autowired UserRoleBindingRepository bindings;
    @Autowired AuthSessionService sessions;
    @Autowired PhoneIdentityCodec codec;
    @Autowired PrivacyConsentService consent;
    @Autowired PrivacyConsentEventRepository events;
    @Autowired PrivacyRightService rights;
    @Autowired SelfAccountClosureService closure;
    @Autowired FileRepository files;
    @Autowired MomentPostRepository moments;
    @Autowired MockMvc mvc;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;
    @MockBean PhoneSmsService sms;
    @SpyBean PrivacyProcessingRestrictionRepository restrictions;
    @SpyBean com.action.camera.account.repository.AccountCancellationCleanupRepository cleanup;
    private User user;
    private String phone;
    private SessionAuthenticationResult session;

    @BeforeEach void setup() {
        reset(restrictions,sms,cleanup);
        phone="+861380013"+PHONE_SEQUENCE.incrementAndGet();
        var identity=codec.encode(phone);
        user=new User(); user.setNickname("privacy owner"); user.setStatus("ACTIVE"); user.setCurrentRole("CUSTOMER");
        user.setMobileHash(identity.hash()); user.setMobileCipher(identity.cipher()); user.setMobileMasked(identity.masked());
        user=users.saveAndFlush(user);
        UserRoleBinding binding=new UserRoleBinding(); binding.setUserId(user.getId()); binding.setRole("CUSTOMER");
        binding.setGrantedAt(LocalDateTime.now()); bindings.saveAndFlush(binding);
        session=sessions.issue(user,"CUSTOMER",false,"test-installation","Test device");
    }
    private String bearer() { return "Bearer "+session.response().getToken(); }
    private ConsentUpdate decision(String status,long time) {
        return new ConsentUpdate(status,PrivacyConsentService.VERSION,PrivacyConsentService.VERSION,"test-installation",time);
    }
    private void grant() { consent.update(user.getId(),decision("GRANTED",System.currentTimeMillis()-100)); }

    @Test void grantPersistsAndWithdrawalBlocksAllClientsButKeepsRightsAndRefreshAvailable() throws Exception {
        mvc.perform(get("/notifications").header("Authorization",bearer()).header("X-Portra-Consent-Version",PrivacyConsentService.VERSION))
                .andExpect(jsonPath("$.code").value(40302));
        grant();
        assertThat(consent.current(user.getId()).status()).isEqualTo("GRANTED");
        consent.update(user.getId(),decision("WITHDRAWN",System.currentTimeMillis()-100));
        assertThat(consent.current(user.getId()).status()).isEqualTo("WITHDRAWN");
        mvc.perform(get("/notifications").header("Authorization",bearer())).andExpect(jsonPath("$.code").value(40302));
        mvc.perform(get("/privacy/rights").header("Authorization",bearer())).andExpect(jsonPath("$.code").value(200));
        assertThat(sessions.refresh(session.refreshToken()).response().getUserId()).isEqualTo(user.getId());
        assertThat(events.findAll().stream().filter(e->e.getUserId().equals(user.getId()))).hasSize(2);
    }
    @Test void withdrawalRestrictsPublicImagesAndMomentsWithoutDeletingTheAccount() throws Exception {
        grant();
        FileRecord f=new FileRecord(); f.setUploaderId(user.getId()); f.setFileKey("privacy-"+user.getId());
        f.setOriginalName("private.jpg"); f.setMimeType("image/jpeg"); f.setFileSize(10L); f.setBizType("AVATAR"); f.setVisibility("PUBLIC");
        f=files.saveAndFlush(f);
        var post=moments.saveAndFlush(new MomentPost(user.getId(),"CUSTOMER","private title","private content",List.of(),List.of()));
        consent.update(user.getId(),decision("WITHDRAWN",System.currentTimeMillis()-100));
        assertThat(files.findById(f.getId()).orElseThrow().getVisibility()).isEqualTo("PRIVATE");
        assertThat(moments.findById(post.getId()).orElseThrow().getModerationStatus().name()).isEqualTo("HIDDEN");
        assertThat(users.findById(user.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        mvc.perform(get("/users/"+user.getId()+"/public-profile")).andExpect(jsonPath("$.code").value(40401));
        mvc.perform(get("/moments/profile").param("authorId",user.getId().toString()).param("authorRole","CUSTOMER"))
                .andExpect(jsonPath("$.data.records").isEmpty());
    }
    @Test void lateDatabaseFailureRollsBackWithdrawalAndPublicRestrictions() {
        grant();
        doAnswer(invocation->{invocation.callRealMethod(); throw new IllegalStateException("simulated database outage");})
                .when(restrictions).restrict(eq(user.getId()),any());
        assertThatThrownBy(()->consent.update(user.getId(),decision("WITHDRAWN",System.currentTimeMillis()-100)))
                .isInstanceOf(org.springframework.dao.DataAccessException.class).hasRootCauseInstanceOf(IllegalStateException.class);
        assertThat(consent.current(user.getId()).status()).isEqualTo("GRANTED");
        assertThat(events.findAll().stream().filter(e->e.getUserId().equals(user.getId()))).hasSize(1);
    }
    @Test void oldCachedGrantCannotOverwriteWithdrawalAndExplicitNewGrantCan() {
        long accepted=System.currentTimeMillis()-500;
        consent.update(user.getId(),decision("GRANTED",accepted));
        var withdrawn=consent.update(user.getId(),decision("WITHDRAWN",accepted));
        assertThatThrownBy(()->consent.update(user.getId(),decision("GRANTED",accepted)))
                .isInstanceOf(BusinessException.class);
        assertThat(consent.update(user.getId(),decision("GRANTED",withdrawn.acceptedAtEpochMs()+1)).status()).isEqualTo("GRANTED");
    }
    @Test void rightsAreDurableIdempotentPrivateAndCannotBeMarkedDeletedOnSubmission() throws Exception {
        var input=new RightCreate("DELETE","请删除非必要资料","privacy_request_key_000001");
        var first=rights.submit(user.getId(),input);
        var second=rights.submit(user.getId(),input);
        assertThat(first.status()).isEqualTo("SUBMITTED"); assertThat(second.id()).isEqualTo(first.id());
        assertThat(rights.mine(user.getId(),1,20).getRecords()).extracting(RightView::id).containsExactly(first.id());
        assertThat(rights.mine(user.getId()+999999,1,20).getRecords()).isEmpty();
        mvc.perform(get("/admin/privacy-rights").header("Authorization",bearer())).andExpect(jsonPath("$.code").value(40301));
        assertThatThrownBy(()->rights.submit(user.getId(),new RightCreate("COPY","different",input.idempotencyKey())))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->rights.mine(user.getId(),0,20)).isInstanceOf(BusinessException.class);
    }
    @Test void administratorCanReceiveProcessVerifyAndReturnActualFeedback() throws Exception {
        User admin=new User(); admin.setNickname("privacy operator"); admin.setCurrentRole("ADMIN"); admin.setStatus("ACTIVE");
        admin=users.saveAndFlush(admin);
        UserRoleBinding adminBinding=new UserRoleBinding(); adminBinding.setUserId(admin.getId());
        adminBinding.setRole("ADMIN"); adminBinding.setGrantedAt(LocalDateTime.now()); bindings.saveAndFlush(adminBinding);
        String operator="Bearer "+sessions.issue(admin,"ADMIN",true,"operator-installation","Operator").response().getToken();
        var request=rights.submit(user.getId(),new RightCreate("DELETE","请核对删除范围","operator_delete_key_000001"));
        String path="/admin/privacy-rights/"+request.id();
        mvc.perform(get("/admin/privacy-rights").header("Authorization",operator).param("status","SUBMITTED"))
                .andExpect(jsonPath("$.code").value(200));
        mvc.perform(patch(path).header("Authorization",operator).contentType("application/json")
                .content(mapper.writeValueAsString(new RightUpdate("COMPLETED","不可跳过受理",true,"已核验"))))
                .andExpect(jsonPath("$.code").value(40901));
        mvc.perform(patch(path).header("Authorization",operator).contentType("application/json")
                .content(mapper.writeValueAsString(new RightUpdate("PROCESSING","已受理，核验身份及范围",null,null))))
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));
        mvc.perform(patch(path).header("Authorization",operator).contentType("application/json")
                .content(mapper.writeValueAsString(new RightUpdate("COMPLETED","不能省略身份核验",false,null))))
                .andExpect(jsonPath("$.code").value(40001));
        mvc.perform(patch(path).header("Authorization",operator).contentType("application/json")
                .content(mapper.writeValueAsString(new RightUpdate("COMPLETED","非必要资料已人工核对处理，约拍证据受限保留",true,"工单TEST-1：本人身份核验，已核对非必要资料与他人权益边界"))))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
        assertThat(rights.mine(user.getId(),1,20).getRecords()).filteredOn(r->r.id().equals(request.id()))
                .extracting(RightView::resolutionNote).containsExactly("非必要资料已人工核对处理，约拍证据受限保留");
        var refused=rights.submit(user.getId(),new RightCreate("COPY","复制账号资料","operator_copy_key_00000001"));
        mvc.perform(patch("/admin/privacy-rights/"+refused.id()).header("Authorization",operator).contentType("application/json")
                .content(mapper.writeValueAsString(new RightUpdate("REJECTED","本次核验资料不足，请通过受保护渠道补充核验",null,null))))
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.resolutionNote").value("本次核验资料不足，请通过受保护渠道补充核验"));
    }
    @Test void successfulClosureAnonymizesAndRevokesAccessAndRefreshCredentials() throws Exception {
        when(sms.verifyCode(phone,SmsPurpose.REAUTH,"123456")).thenReturn(phone);
        var result=closure.close(user.getId(),new ClosureConfirm(phone,"123456",true));
        assertThat(result.status()).isEqualTo("CLOSED");
        User deleted=users.findById(user.getId()).orElseThrow();
        assertThat(deleted.getStatus()).isEqualTo("DELETED"); assertThat(deleted.getMobileCipher()).isNull();
        assertThat(deleted.getMobileHash()).isNull(); assertThat(deleted.getNickname()).startsWith("已注销用户");
        assertThatThrownBy(()->sessions.refresh(session.refreshToken())).isInstanceOf(BusinessException.class);
        mvc.perform(get("/privacy/rights").header("Authorization",bearer())).andExpect(jsonPath("$.code").value(40101));
        assertThat(bindings.existsByUserIdAndRole(user.getId(),"CUSTOMER")).isFalse();
    }
    @Test void unfinishedAppointmentsAndDatabaseFailureNeverReportClosureSuccess() {
        doReturn(1L).when(cleanup).countBlockingOrders(user.getId());
        assertThatThrownBy(()->closure.close(user.getId(),new ClosureConfirm(phone,"123456",true)))
                .isInstanceOf(BusinessException.class);
        verify(sms,never()).verifyCode(anyString(),any(),anyString());
        reset(cleanup);
        when(sms.verifyCode(phone,SmsPurpose.REAUTH,"123456")).thenReturn(phone);
        doAnswer(invocation->{invocation.callRealMethod(); throw new IllegalStateException("cleanup failed");})
                .when(cleanup).cleanupUserData(eq(user.getId()),anyString(),any());
        assertThatThrownBy(()->closure.close(user.getId(),new ClosureConfirm(phone,"123456",true)))
                .isInstanceOf(org.springframework.dao.DataAccessException.class).hasRootCauseInstanceOf(IllegalStateException.class);
        assertThat(users.findById(user.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(bindings.existsByUserIdAndRole(user.getId(),"CUSTOMER")).isTrue();
        assertThat(sessions.refresh(session.refreshToken()).response().getUserId()).isEqualTo(user.getId());
    }
    @Test void invalidSmsAndUnconfirmedClosureNeverTerminateAccount() {
        assertThatThrownBy(()->closure.close(user.getId(),new ClosureConfirm(phone,"123456",false)))
                .isInstanceOf(BusinessException.class);
        when(sms.verifyCode(phone,SmsPurpose.REAUTH,"000000")).thenThrow(new SmsCodeInvalidException());
        assertThatThrownBy(()->closure.close(user.getId(),new ClosureConfirm(phone,"000000",true)))
                .isInstanceOf(SmsCodeInvalidException.class);
        assertThat(users.findById(user.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(sessions.refresh(session.refreshToken()).response().getUserId()).isEqualTo(user.getId());
    }
}
