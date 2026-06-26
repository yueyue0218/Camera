package com.action.camera.message.service;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MessagePresenceService {

    private static final Duration ACTIVE_TTL = Duration.ofSeconds(15);

    private final Map<Long, PresenceState> presenceByUserId = new ConcurrentHashMap<>();

    public void reportPresence(Long userId, Long conversationId, boolean active) {
        if (userId == null) {
            return;
        }
        if (!active) {
            presenceByUserId.remove(userId);
            return;
        }
        presenceByUserId.put(userId, new PresenceState(conversationId, LocalDateTime.now()));
    }

    public boolean shouldCreateMessageNotification(Long userId, Long conversationId) {
        if (userId == null) {
            return true;
        }
        PresenceState state = presenceByUserId.get(userId);
        if (state == null) {
            return true;
        }
        if (state.isExpired()) {
            presenceByUserId.remove(userId, state);
            return true;
        }
        return false;
    }

    private record PresenceState(Long conversationId, LocalDateTime updatedAt) {
        boolean isExpired() {
            return updatedAt == null || updatedAt.plus(ACTIVE_TTL).isBefore(LocalDateTime.now());
        }
    }
}
