package com.action.camera.common;

import com.action.camera.auth.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * JWT 工具：登录成功后发"通行证"，访问时验"通行证"。
 */
@Component
public class JwtUtil {

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtUtil(JwtProperties properties) {
        this.properties = properties;
        byte[] secretBytes = properties.getSecret() == null
                ? new byte[0]
                : properties.getSecret().getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 bytes");
        }
        this.key = Keys.hmacShaKeyFor(secretBytes);
    }

    /** 生成 token，把用户 id 装进去 */
    public String generateToken(Long userId) {
        return generateToken(userId, null);
    }

    public String generateToken(Long userId, String sessionId) {
        Instant now = Instant.now();
        Instant expiry = now.plus(properties.getAccessTtl());
        var builder = Jwts.builder()
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry));
        if (sessionId != null && !sessionId.isBlank()) {
            builder.claim("sid", sessionId);
        }
        return builder.signWith(key).compact();
    }

    public long getExpireSeconds() {
        return properties.getAccessTtl().toSeconds();
    }

    /** 从 token 解析出用户 id；无效或过期会抛异常 */
    public Long parseUserId(String token) {
        Claims claims = parseClaims(token);
        return claims.getSubject() == null
                ? null
                : Long.valueOf(claims.getSubject());
    }

    public String parseSessionId(String token) {
        return parseClaims(token).get("sid", String.class);
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
