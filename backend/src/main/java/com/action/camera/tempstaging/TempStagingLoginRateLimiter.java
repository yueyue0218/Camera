package com.action.camera.tempstaging;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Profile("temp-staging")
public class TempStagingLoginRateLimiter {

    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int ACCOUNT_FAILURE_LIMIT = 5;
    private static final int IP_FAILURE_LIMIT = 20;

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
    private final Clock clock;

    public TempStagingLoginRateLimiter() {
        this(Clock.systemUTC());
    }

    TempStagingLoginRateLimiter(Clock clock) {
        this.clock = clock;
    }

    public void check(Long userId, String ipAddress) {
        if (count(accountKey(userId)) >= ACCOUNT_FAILURE_LIMIT || count(ipKey(ipAddress)) >= IP_FAILURE_LIMIT) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "临时测试登录尝试过多，请稍后再试");
        }
    }

    public void recordFailure(Long userId, String ipAddress) {
        add(accountKey(userId));
        add(ipKey(ipAddress));
    }

    public void recordSuccess(Long userId) {
        failures.remove(accountKey(userId));
    }

    private int count(String key) {
        Deque<Instant> values = failures.get(key);
        if (values == null) {
            return 0;
        }
        synchronized (values) {
            evictExpired(values);
            if (values.isEmpty()) {
                failures.remove(key, values);
                return 0;
            }
            return values.size();
        }
    }

    private void add(String key) {
        Deque<Instant> values = failures.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (values) {
            evictExpired(values);
            values.addLast(clock.instant());
        }
    }

    private void evictExpired(Deque<Instant> values) {
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!values.isEmpty() && !values.peekFirst().isAfter(cutoff)) {
            values.removeFirst();
        }
    }

    private String accountKey(Long userId) {
        return "account:" + (userId == null ? "missing" : userId);
    }

    private String ipKey(String ipAddress) {
        return "ip:" + ipAddress;
    }
}
