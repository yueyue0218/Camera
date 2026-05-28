package com.action.camera.certification.event;

import com.action.camera.certification.entity.RealNameCertification;
import com.action.camera.provider.entity.ProviderProfile;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class CertificationApprovedListener {

    private final ProviderProfileMapper providerProfileMapper;

    public CertificationApprovedListener(ProviderProfileMapper providerProfileMapper) {
        this.providerProfileMapper = providerProfileMapper;
    }

    /**
     * 认证通过后自动创建摄影师档案（若尚不存在）。
     * 与发布方共用同一事务，失败时整体回滚。
     */
    @EventListener
    public void onCertificationApproved(CertificationApprovedEvent event) {
        RealNameCertification cert = event.getCertification();
        Long userId = cert.getUserId();

        long exists = providerProfileMapper.selectCount(
                new LambdaQueryWrapper<ProviderProfile>()
                        .eq(ProviderProfile::getUserId, userId)
        );

        if (exists == 0) {
            ProviderProfile profile = new ProviderProfile();
            profile.setUserId(userId);
            profile.setCertifiedAt(cert.getReviewedAt());
            providerProfileMapper.insert(profile);
        }
    }
}
