package com.action.camera.auth.domain;
import jakarta.persistence.*;
/** Shared locks cover first sends as well as resends across application instances. */
@Entity @Table(name="sms_challenge_locks")
public class SmsChallengeLock {
    @Id @Column(name="lock_key", length=64) private String lockKey;
}
