package com.action.camera.privacy.service;

import com.action.camera.common.*;
import com.action.camera.common.exception.BusinessException;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import java.util.Set;

/** Runs after authentication. Legal channels and authentication recovery remain available. */
@Component
public class PrivacyRequestInterceptor implements HandlerInterceptor {
    private static final Set<String> NECESSARY_AUTH=Set.of("/auth/session","/auth/logout","/auth/native/logout","/auth/refresh","/auth/native/refresh");
    private final PrivacyConsentService consent;
    public PrivacyRequestInterceptor(PrivacyConsentService consent) { this.consent=consent; }
    @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler) {
        if("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        String path=request.getRequestURI();
        if(path.startsWith("/privacy/") || path.equals("/admin/privacy-rights") || path.matches("^/admin/privacy-rights/[0-9]+$")
                || NECESSARY_AUTH.contains(path)) return true;
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            java.util.regex.Matcher target=java.util.regex.Pattern.compile("^/(?:users/([0-9]+)/public-profile|api/v1/providers/([0-9]+)/profile)$").matcher(path);
            if(target.matches()) {
                Long targetId=Long.valueOf(target.group(1)!=null ? target.group(1) : target.group(2));
                if("WITHDRAWN".equals(consent.current(targetId).status()))
                    throw new BusinessException(ErrorCode.NOT_FOUND,"该资料暂不可公开查看");
            }
        }
        String version=request.getHeader("X-Portra-Consent-Version");
        boolean harmony=version!=null;
        if(path.equals("/auth/native/sms/verify") || (harmony && path.equals("/auth/sms/send"))) {
            validateNativeEvidence(request); return true;
        }
        if(UserContext.getUserId()!=null) consent.requireBusinessConsent(UserContext.getUserId(),harmony);
        return true;
    }
    private void validateNativeEvidence(HttpServletRequest request) {
        try {
            String installation=request.getHeader("X-Portra-Installation-Id");
            long accepted=Long.parseLong(request.getHeader("X-Portra-Consent-Accepted-At"));
            if(!PrivacyConsentService.VERSION.equals(request.getHeader("X-Portra-Consent-Version"))
                    || installation==null || installation.isBlank() || installation.length()>128
                    || accepted<=0 || accepted>System.currentTimeMillis()+300_000L) throw new IllegalArgumentException();
        } catch(RuntimeException error) { throw new BusinessException(ErrorCode.PRIVACY_CONSENT_REQUIRED); }
    }
}
