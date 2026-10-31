package com.action.camera.privacy.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.privacy.domain.*;
import com.action.camera.privacy.repository.*;
import com.action.camera.privacy.dto.PrivacyDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;

@Service
public class PrivacyConsentService {
    public static final String VERSION = "2026-10-29-v1";
    private final PrivacyConsentRepository consents;
    private final PrivacyConsentEventRepository events;
    private final UserRepository users;
    private final PrivacyProcessingRestrictionRepository restrictions;
    public PrivacyConsentService(PrivacyConsentRepository consents,PrivacyConsentEventRepository events,UserRepository users,PrivacyProcessingRestrictionRepository restrictions) {
        this.consents=consents; this.events=events; this.users=users; this.restrictions=restrictions;
    }
    @Transactional(readOnly=true)
    public ConsentView current(Long userId) {
        return consents.findById(userId).map(this::view).orElseGet(() ->
                new ConsentView("NOT_RECORDED","CROSS_BORDER_HK",null,null,null,null,null,userId));
    }
    @Transactional
    public ConsentView update(Long userId,ConsentUpdate input) {
        User user=users.findByIdForUpdate(userId).filter(u -> "ACTIVE".equals(u.getStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (input==null || !("GRANTED".equals(input.status()) || "WITHDRAWN".equals(input.status()))
                || input.installationId()==null || input.installationId().isBlank() || input.installationId().length()>128
                || input.acceptedAtEpochMs()==null || input.acceptedAtEpochMs()<=0
                || input.acceptedAtEpochMs()>System.currentTimeMillis()+300_000L) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,"授权信息无效");
        }
        boolean granting="GRANTED".equals(input.status());
        if (granting && (!VERSION.equals(input.privacyPolicyVersion()) || !VERSION.equals(input.crossBorderConsentVersion()))) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,"请阅读当前版本并重新单独同意");
        }
        PrivacyConsent state=consents.findById(user.getId()).orElse(null);
        if (state!=null && state.getStatus().equals(input.status())
                && (!granting || (VERSION.equals(state.getPrivacyPolicyVersion()) && VERSION.equals(state.getCrossBorderConsentVersion())))) {
            return view(state);
        }
        if (state!=null && "WITHDRAWN".equals(state.getStatus()) && granting
                && input.acceptedAtEpochMs()<=state.getAcceptedAtEpochMs()) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,"此前授权已撤回，请重新阅读并单独确认");
        }
        if (state==null) { state=new PrivacyConsent(); state.setUserId(user.getId()); }
        state.setStatus(input.status());
        state.setPrivacyPolicyVersion(granting ? VERSION : nonblank(input.privacyPolicyVersion()));
        state.setCrossBorderConsentVersion(granting ? VERSION : nonblank(input.crossBorderConsentVersion()));
        state.setInstallationId(input.installationId().trim());
        // A withdrawal becomes the replay barrier for grants issued earlier on any device.
        state.setAcceptedAtEpochMs(granting ? input.acceptedAtEpochMs() : System.currentTimeMillis());
        state.setOccurredAt(LocalDateTime.now());
        if (!granting) restrictions.restrict(user.getId(),state.getOccurredAt());
        consents.saveAndFlush(state);
        PrivacyConsentEvent event=new PrivacyConsentEvent();
        event.setUserId(state.getUserId()); event.setConsentType(state.getConsentType());
        event.setStatus(state.getStatus()); event.setPrivacyPolicyVersion(state.getPrivacyPolicyVersion());
        event.setCrossBorderConsentVersion(state.getCrossBorderConsentVersion());
        event.setInstallationId(state.getInstallationId()); event.setAcceptedAtEpochMs(state.getAcceptedAtEpochMs());
        event.setOccurredAt(state.getOccurredAt()); events.saveAndFlush(event);
        return view(state);
    }
    @Transactional(readOnly=true)
    public void requireBusinessConsent(Long userId, boolean harmonyClient) {
        PrivacyConsent state=consents.findById(userId).orElse(null);
        if ((state!=null && "WITHDRAWN".equals(state.getStatus())) || (harmonyClient &&
                (state==null || !"GRANTED".equals(state.getStatus()) || !VERSION.equals(state.getPrivacyPolicyVersion())
                || !VERSION.equals(state.getCrossBorderConsentVersion())))) {
            throw new BusinessException(ErrorCode.PRIVACY_CONSENT_REQUIRED);
        }
    }
    private String nonblank(String value) {
        if (value==null || value.isBlank() || value.length()>40) throw new BusinessException(ErrorCode.VALIDATION_ERROR);
        return value.trim();
    }
    private ConsentView view(PrivacyConsent state) {
        return new ConsentView(state.getStatus(),state.getConsentType(),state.getPrivacyPolicyVersion(),
                state.getCrossBorderConsentVersion(),state.getInstallationId(),state.getAcceptedAtEpochMs(),state.getOccurredAt(),state.getUserId());
    }
}
