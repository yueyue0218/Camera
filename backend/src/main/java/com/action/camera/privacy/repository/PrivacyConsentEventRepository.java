package com.action.camera.privacy.repository;
import com.action.camera.privacy.domain.PrivacyConsentEvent;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PrivacyConsentEventRepository extends JpaRepository<PrivacyConsentEvent, Long> {}
