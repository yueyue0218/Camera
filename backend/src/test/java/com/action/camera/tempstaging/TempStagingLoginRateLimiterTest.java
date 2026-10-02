package com.action.camera.tempstaging;

import com.action.camera.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TempStagingLoginRateLimiterTest {

    @Test
    void blocksAccountAfterFiveFailures() {
        TempStagingLoginRateLimiter limiter = new TempStagingLoginRateLimiter(
                Clock.fixed(Instant.parse("2026-09-18T00:00:00Z"), ZoneOffset.UTC));
        for (int index = 0; index < 5; index++) {
            limiter.recordFailure(101L, "203.0.113.10");
        }

        assertThrows(BusinessException.class, () -> limiter.check(101L, "203.0.113.11"));
        assertDoesNotThrow(() -> limiter.check(202L, "203.0.113.11"));
    }

    @Test
    void blocksIpAcrossAccountsAfterTwentyFailures() {
        TempStagingLoginRateLimiter limiter = new TempStagingLoginRateLimiter(
                Clock.fixed(Instant.parse("2026-09-18T00:00:00Z"), ZoneOffset.UTC));
        for (long userId = 1; userId <= 20; userId++) {
            limiter.recordFailure(userId, "203.0.113.10");
        }

        assertThrows(BusinessException.class, () -> limiter.check(101L, "203.0.113.10"));
    }
}
