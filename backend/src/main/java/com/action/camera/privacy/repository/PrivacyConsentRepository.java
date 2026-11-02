package com.action.camera.privacy.repository;
import com.action.camera.privacy.domain.PrivacyConsent;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PrivacyConsentRepository extends JpaRepository<PrivacyConsent, Long> {}
