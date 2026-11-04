package com.action.camera.auth;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.*;
import com.action.camera.auth.dto.*;
import com.action.camera.auth.repository.*;
import com.action.camera.auth.service.*;
import com.action.camera.auth.sms.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

@SpringBootTest(properties={
    "spring.datasource.url=jdbc:h2:mem:secure_challenge;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.sql.init.mode=always",
    "camera.integration.runtime-ddl-enabled=false"
})
@ActiveProfiles("integration")
class DefaultSchemeChallengeSecurityTest {
    static final String PHONE="13800138000", IP="203.0.113.31", DEVICE="secure-test";
    @Autowired PhoneSmsService sms;
    @Autowired SmsChallengeRepository rows;
    @Autowired SmsProperties properties;
    @Autowired SmsCodeHasher hasher;
    @Autowired PlatformTransactionManager txManager;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired com.action.camera.account.service.SelfAccountClosureService closure;
    @Autowired com.action.camera.repository.UserRepository users;
    @MockBean com.action.camera.account.repository.AccountCancellationCleanupRepository cleanup;
    // Even a sender exposing the legacy cloud interface must never be asked to verify.
    @MockBean(extraInterfaces=SmsCloudVerifier.class) SmsSender sender;
    final List<SmsMessage> sent = new CopyOnWriteArrayList<>();

    @BeforeEach void setup() {
        rows.deleteAll(); reset(sender,cleanup); sent.clear();
        properties.setResendCooldown(Duration.ofSeconds(60)); properties.setCodeTtl(Duration.ofMinutes(5));
        properties.setMaxAttempts(5); properties.setPhoneHourlyLimit(100); properties.setPhoneDailyLimit(100);
        properties.setIpHourlyLimit(100); properties.setIpDailyLimit(100);
        properties.setDeviceHourlyLimit(100); properties.setDeviceDailyLimit(100);
        when(sender.send(any())).thenAnswer(i -> { sent.add(i.getArgument(0)); return new SmsDeliveryReceipt("receipt"); });
    }
    SmsChallengeResponse login() { return sms.createChallenge(PHONE,SmsPurpose.LOGIN,IP,DEVICE,null,null,"LOGIN"); }
    SmsChallengeResponse reauth(long user,String session) { return sms.createChallenge(PHONE,SmsPurpose.REAUTH,IP,DEVICE,user,session,"ACCOUNT_CLOSURE"); }
    String code() { return sent.get(sent.size()-1).code(); }
    String consume(SmsChallengeResponse c,String code) { return sms.consumeChallenge(c.challengeId(),PHONE,SmsPurpose.LOGIN,code,null,null,"LOGIN"); }
    SmsChallenge row(SmsChallengeResponse c) { return rows.findAll().stream().filter(r -> c.challengeId().equals(r.getChallengeId())).findFirst().orElseThrow(); }
    void age(SmsChallengeResponse c) { jdbc.update("UPDATE sms_challenges SET created_at=? WHERE challenge_id=?", LocalDateTime.now().minusSeconds(61), c.challengeId()); }

    @Test void exactSentCodeIsBoundAndNoPlaintextPersists() {
        var c=login(); var r=row(c);
        assertThat(code()).matches("[0-9]{6}");
        assertThat(r.getCodeHash()).startsWith("$2").doesNotContain(code());
        assertThat(hasher.matches(r,code())).isTrue();
        assertThat(sent.get(0).toString()).doesNotContain(code(),PHONE);
        r.setOperation("ACCOUNT_CLOSURE"); assertThat(hasher.matches(r,code())).isFalse();
    }
    @Test void loginCannotAuthorizeReauthOrAnotherChallenge() {
        var l=login(); String loginCode=code(); var r=reauth(7,"sessionA");
        assertThatThrownBy(() -> sms.consumeChallenge(l.challengeId(),PHONE,SmsPurpose.REAUTH,loginCode,7L,"sessionA","ACCOUNT_CLOSURE"))
            .isInstanceOf(SmsCodeInvalidException.class);
        // Distinct challenges have independent hashes even with an identical numeric code.
        assertThat(row(l).getCodeHash()).isNotEqualTo(row(r).getCodeHash());
        if (!loginCode.equals(code())) {
            assertThatThrownBy(() -> sms.consumeChallenge(r.challengeId(),PHONE,SmsPurpose.REAUTH,loginCode,7L,"sessionA","ACCOUNT_CLOSURE"))
                .isInstanceOf(SmsCodeInvalidException.class);
        }
        assertThat(row(r).getConsumedAt()).isNull();
    }
    @Test void reauthBindsAccountSessionOperationAndPhone() {
        var c=reauth(7,"sessionA"); String value=code();
        assertThatThrownBy(() -> sms.consumeChallenge(c.challengeId(),PHONE,SmsPurpose.REAUTH,value,8L,"sessionA","ACCOUNT_CLOSURE")).isInstanceOf(SmsCodeInvalidException.class);
        assertThatThrownBy(() -> sms.consumeChallenge(c.challengeId(),PHONE,SmsPurpose.REAUTH,value,7L,"sessionB","ACCOUNT_CLOSURE")).isInstanceOf(SmsCodeInvalidException.class);
        assertThatThrownBy(() -> sms.consumeChallenge(c.challengeId(),PHONE,SmsPurpose.REAUTH,value,7L,"sessionA","CHANGE_PHONE")).isInstanceOf(SmsCodeInvalidException.class);
        assertThatThrownBy(() -> sms.consumeChallenge(c.challengeId(),"13900139000",SmsPurpose.REAUTH,value,7L,"sessionA","ACCOUNT_CLOSURE")).isInstanceOf(SmsCodeInvalidException.class);
        assertThat(sms.consumeChallenge(c.challengeId(),PHONE,SmsPurpose.REAUTH,value,7L,"sessionA","ACCOUNT_CLOSURE")).isEqualTo("+86"+PHONE);
    }
    @Test void replacementInvalidatesOldChallenge() {
        var old=login(); String previous=code(); age(old); var replacement=login(); String current=code();
        assertThat(row(old).getInvalidatedAt()).isNotNull();
        assertThatThrownBy(() -> consume(old,previous)).isInstanceOf(SmsCodeInvalidException.class);
        assertThat(consume(replacement,current)).isEqualTo("+86"+PHONE);
    }
    @Test void consumedCodeCannotReplay() {
        var c=login(); String value=code(); consume(c,value);
        assertThatThrownBy(() -> consume(c,value)).isInstanceOf(SmsCodeInvalidException.class);
    }
    @Test void concurrentConsumptionSucceedsExactlyOnce() throws Exception {
        var c=login(); String value=code(); var start=new CountDownLatch(1); var pool=Executors.newFixedThreadPool(6);
        try {
            List<Future<Boolean>> futures=new ArrayList<>();
            for(int i=0;i<6;i++) futures.add(pool.submit(() -> { start.await(); try { consume(c,value); return true; } catch(SmsCodeInvalidException e) { return false; } }));
            start.countDown(); int success=0; for(var f:futures) if(f.get(20,TimeUnit.SECONDS)) success++;
            assertThat(success).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void concurrentFirstSendsAdmitAtMostOne() throws Exception {
        var start=new CountDownLatch(1); var pool=Executors.newFixedThreadPool(4);
        try {
            List<Future<Boolean>> futures=new ArrayList<>();
            for(int i=0;i<4;i++) futures.add(pool.submit(() -> { start.await(); try { login(); return true; } catch(com.action.camera.common.exception.BusinessException e) { return false; } }));
            start.countDown(); int success=0; for(var f:futures) if(f.get(20,TimeUnit.SECONDS)) success++;
            assertThat(success).isEqualTo(1); assertThat(sent).hasSize(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void failedReplacementLeavesNeitherOldNorNewUsable() {
        var old=login(); String previous=code(); age(old);
        when(sender.send(any())).thenThrow(new SmsDeliveryException("provider unavailable"));
        assertThatThrownBy(this::login).isInstanceOf(SmsSendFailedException.class);
        assertThat(row(old).getInvalidatedAt()).isNotNull();
        var failed=rows.findAll().stream().filter(r -> r.getDeliveryStatus()==SmsDeliveryStatus.FAILED).findFirst().orElseThrow();
        assertThatThrownBy(() -> consume(old,previous)).isInstanceOf(SmsCodeInvalidException.class);
        assertThatThrownBy(() -> sms.consumeChallenge(failed.getChallengeId(),PHONE,SmsPurpose.LOGIN,previous,null,null,"LOGIN")).isInstanceOf(SmsCodeInvalidException.class);
    }
    @Test void businessRollbackDoesNotRestoreConsumedReauth() {
        var c=reauth(7,"sessionA"); String value=code(); var transaction=new TransactionTemplate(txManager);
        assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
            sms.consumeChallenge(c.challengeId(),PHONE,SmsPurpose.REAUTH,value,7L,"sessionA","ACCOUNT_CLOSURE");
            throw new IllegalStateException("sensitive operation failed after verification");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(row(c).getConsumedAt()).isNotNull();
        assertThatThrownBy(() -> sms.consumeChallenge(c.challengeId(),PHONE,SmsPurpose.REAUTH,value,7L,"sessionA","ACCOUNT_CLOSURE")).isInstanceOf(SmsCodeInvalidException.class);
    }
    @Test void wrongAttemptsSurviveCallerRollbackAndExhaustBudget() {
        properties.setMaxAttempts(2); var c=login(); String value=code(); String wrong=value.equals("000000")?"111111":"000000";
        var transaction=new TransactionTemplate(txManager);
        for(int i=0;i<2;i++) assertThatThrownBy(() -> transaction.executeWithoutResult(s -> consume(c,wrong))).isInstanceOf(SmsCodeInvalidException.class);
        assertThat(row(c).getAttemptCount()).isEqualTo(2);
        assertThatThrownBy(() -> consume(c,value)).isInstanceOf(SmsCodeInvalidException.class);
    }
    @Test void expiredAndLegacyChallengesAreRejected() {
        var c=login(); var r=row(c); r.setExpiresAt(LocalDateTime.now().minusSeconds(1)); rows.saveAndFlush(r);
        assertThatThrownBy(() -> consume(c,code())).isInstanceOf(SmsCodeInvalidException.class);
        assertThatThrownBy(() -> sms.consumeChallenge(null,PHONE,SmsPurpose.LOGIN,code(),null,null,"LOGIN")).isInstanceOf(SmsCodeInvalidException.class);
        assertThatThrownBy(() -> sms.verifyCode(PHONE,SmsPurpose.LOGIN,code())).isInstanceOf(SmsCodeInvalidException.class);
    }
    @Test void cooldownAndPhoneIpDeviceLimitsRemain() {
        var c=login(); assertThatThrownBy(this::login).isInstanceOf(com.action.camera.common.exception.BusinessException.class);
        age(c); properties.setPhoneHourlyLimit(1);
        assertThatThrownBy(this::login).isInstanceOf(com.action.camera.common.exception.BusinessException.class);
        properties.setPhoneHourlyLimit(100); properties.setIpHourlyLimit(1);
        assertThatThrownBy(() -> sms.createChallenge("13900139000",SmsPurpose.LOGIN,IP,"other",null,null,"LOGIN")).isInstanceOf(com.action.camera.common.exception.BusinessException.class);
        properties.setIpHourlyLimit(100); properties.setDeviceHourlyLimit(1);
        assertThatThrownBy(() -> sms.createChallenge("13900139000",SmsPurpose.LOGIN,"203.0.113.32",DEVICE,null,null,"LOGIN")).isInstanceOf(com.action.camera.common.exception.BusinessException.class);
    }
    @Test void cloudVerifierIsNeverCalled() {
        var c=login(); consume(c,code());
        verify((SmsCloudVerifier)sender,never()).verifyCode(anyString(),anyString());
        verify((SmsCloudVerifier)sender,never()).verifyCode(anyString(),any(),anyString());
    }
    @Test void actualClosureCleanupFailureCannotRestoreCode() {
        var user=new com.action.camera.domain.User();
        user.setNickname("challenge-security"); user.setStatus("ACTIVE"); user.setCurrentRole("CUSTOMER");
        var binding=reauth(7,"setup");
        user.setMobileHash(row(binding).getPhoneHash());
        users.saveAndFlush(user); rows.deleteAll();
        com.action.camera.common.UserContext.setSessionId("closureSession");
        try {
            var c=closure.sendCode(user.getId(),new com.action.camera.privacy.dto.PrivacyDtos.ClosureCode(PHONE,DEVICE),IP);
            String value=code();
            doThrow(new IllegalStateException("cleanup failure")).when(cleanup).cleanupUserData(anyLong(),anyString(),any());
            assertThatThrownBy(() -> closure.close(user.getId(),new com.action.camera.privacy.dto.PrivacyDtos.ClosureConfirm(PHONE,value,true,c.challengeId())))
                .isInstanceOf(IllegalStateException.class);
            assertThat(row(c).getConsumedAt()).isNotNull();
            assertThat(users.findById(user.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
            assertThatThrownBy(() -> closure.close(user.getId(),new com.action.camera.privacy.dto.PrivacyDtos.ClosureConfirm(PHONE,value,true,c.challengeId())))
                .isInstanceOf(SmsCodeInvalidException.class);
        } finally {
            com.action.camera.common.UserContext.clear(); users.deleteById(user.getId());
        }
    }
}
