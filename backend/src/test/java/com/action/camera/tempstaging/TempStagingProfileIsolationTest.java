package com.action.camera.tempstaging;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TempStagingProfileIsolationTest {

    @Test
    void temporaryBeansAreProfileScoped() {
        assertTempStagingOnly(TempStagingAuthController.class);
        assertTempStagingOnly(TempStagingLoginService.class);
        assertTempStagingOnly(TempStagingLoginRateLimiter.class);
        assertTempStagingOnly(TempStagingMailConfig.class);
        assertTempStagingOnly(TempStagingWebConfig.class);
        assertTempStagingOnly(TempStagingStartupGate.class);
    }

    @Test
    void temporaryMailSenderAlwaysDeniesSending() {
        var sender = new TempStagingMailConfig().tempStagingDenyingMailSender();

        assertThrows(MailSendException.class, () -> sender.send(new SimpleMailMessage()));
    }

    private void assertTempStagingOnly(Class<?> type) {
        Profile profile = type.getAnnotation(Profile.class);
        assertArrayEquals(new String[]{"temp-staging"}, profile.value(), type.getName());
    }
}
