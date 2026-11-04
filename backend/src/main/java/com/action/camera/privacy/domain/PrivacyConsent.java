package com.action.camera.privacy.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

/** Current account decision; immutable history is stored in privacy_consent_events. */
@Entity @Table(name="privacy_consents") @Getter @Setter
public class PrivacyConsent {
    @Id @Column(name="user_id") private Long userId;
    @Column(name="consent_type",nullable=false,length=40) private String consentType = "CROSS_BORDER_HK";
    @Column(nullable=false,length=20) private String status;
    @Column(name="privacy_policy_version",nullable=false,length=40) private String privacyPolicyVersion;
    @Column(name="cross_border_consent_version",nullable=false,length=40) private String crossBorderConsentVersion;
    @Column(name="installation_id",nullable=false,length=128) private String installationId;
    @Column(name="accepted_at_epoch_ms",nullable=false) private Long acceptedAtEpochMs;
    @Column(name="occurred_at",nullable=false) private LocalDateTime occurredAt;
}
