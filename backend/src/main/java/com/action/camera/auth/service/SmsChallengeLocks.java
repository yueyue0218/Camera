package com.action.camera.auth.service;
import com.action.camera.auth.repository.SmsChallengeLockRepository;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
@Component
public class SmsChallengeLocks {
    private final SmsChallengeLockRepository repository;
    public SmsChallengeLocks(SmsChallengeLockRepository repository) { this.repository=repository; }
    public void acquire(String... scopes) {
        Arrays.stream(scopes).map(SmsChallengeLocks::key).distinct().sorted().forEach(k -> {
            repository.ensure(k); repository.lock(k);
        });
    }
    private static String key(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
