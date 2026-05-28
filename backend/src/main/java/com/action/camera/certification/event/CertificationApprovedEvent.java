package com.action.camera.certification.event;

import com.action.camera.certification.entity.RealNameCertification;
import org.springframework.context.ApplicationEvent;

public class CertificationApprovedEvent extends ApplicationEvent {

    private final RealNameCertification certification;

    public CertificationApprovedEvent(Object source, RealNameCertification certification) {
        super(source);
        this.certification = certification;
    }

    public RealNameCertification getCertification() {
        return certification;
    }
}
