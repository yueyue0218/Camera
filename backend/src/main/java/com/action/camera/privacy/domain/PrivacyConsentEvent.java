package com.action.camera.privacy.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Table(name="privacy_consent_events", indexes=@Index(name="idx_privacy_consent_event_user",columnList="user_id,occurred_at")) @Getter @Setter
public class PrivacyConsentEvent {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="user_id",nullable=false) private Long userId;
    @Column(name="consent_type",nullable=false,length=40) private String consentType;
    @Column(nullable=false,length=20) private String status;
    @Column(name="privacy_policy_version",nullable=false,length=40) private String privacyPolicyVersion;
    @Column(name="cross_border_consent_version",nullable=false,length=40) private String crossBorderConsentVersion;
    @Column(name="installation_id",nullable=false,length=128) private String installationId;
    @Column(name="accepted_at_epoch_ms",nullable=false) private Long acceptedAtEpochMs;
    @Column(name="occurred_at",nullable=false) private LocalDateTime occurredAt;
}
