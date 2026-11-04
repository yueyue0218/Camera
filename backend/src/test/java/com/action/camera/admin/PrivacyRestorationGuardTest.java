package com.action.camera.admin;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.admin.service.AdminAuditService;
import com.action.camera.admin.service.AdminHallService;
import com.action.camera.admin.service.AdminMomentService;
import com.action.camera.admin.service.AdminPermissionService;
import com.action.camera.admin.service.ContentModerationService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.domain.User;
import com.action.camera.privacy.service.PrivacyConsentService;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.repository.MomentPostRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PrivacyRestorationGuardTest {
    @Mock AdminPermissionService permissions;
    @Mock AdminAuditService audits;
    @Mock AdminHallService hall;
    @Mock AdminMomentService momentAdmin;
    @Mock DemandRepository demands;
    @Mock ServicePackageRepository packages;
    @Mock MomentPostRepository moments;
    @Mock UserRepository users;
    @Mock PrivacyConsentService consent;
    @InjectMocks ContentModerationService service;

    private static final Long OWNER = 42L;
    private static final Long ITEM = 7L;

    @BeforeEach
    void admin() {
        when(permissions.requireAdmin()).thenReturn(99L);
    }

    private void activeOwner() {
        User owner = new User();
        owner.setStatus("ACTIVE");
        when(users.findByIdForUpdate(OWNER)).thenReturn(Optional.of(owner));
    }

    private void denied() {
        doThrow(new BusinessException(ErrorCode.PRIVACY_CONSENT_REQUIRED))
                .when(consent).requireBusinessConsent(OWNER, true);
    }

    @Test
    void withdrawnMomentCannotBeRestored() {
        MomentPost post = new MomentPost();
        post.setId(ITEM);
        post.setAuthorId(OWNER);
        post.setModerationStatus(ModerationStatus.HIDDEN);
        when(moments.findById(ITEM)).thenReturn(Optional.of(post));
        activeOwner();
        denied();

        assertThatThrownBy(() -> service.restoreMoment(ITEM, "reviewed"))
                .isInstanceOf(BusinessException.class);
        assertThat(post.getModerationStatus()).isEqualTo(ModerationStatus.HIDDEN);
        verify(moments, never()).findByIdForUpdate(ITEM);
        verify(moments, never()).save(any());
    }

    @Test
    void withdrawnDemandCannotBeRestored() {
        Demand demand = new Demand();
        demand.setId(ITEM);
        demand.setCustomerId(OWNER);
        demand.setModerationStatus(ModerationStatus.HIDDEN);
        when(demands.findById(ITEM)).thenReturn(Optional.of(demand));
        activeOwner();
        denied();

        assertThatThrownBy(() -> service.restoreHallItem(
                com.action.camera.admin.dto.AdminHallItemType.DEMAND, ITEM, "reviewed"))
                .isInstanceOf(BusinessException.class);
        assertThat(demand.getModerationStatus()).isEqualTo(ModerationStatus.HIDDEN);
        verify(demands, never()).findByIdForUpdate(ITEM);
        verify(demands, never()).save(any());
    }

    @Test
    void withdrawnServicePackageCannotBeRestored() {
        ServicePackage pack = new ServicePackage();
        pack.setId(ITEM);
        pack.setProviderId(OWNER);
        pack.setModerationStatus(ModerationStatus.HIDDEN);
        when(packages.findById(ITEM)).thenReturn(Optional.of(pack));
        activeOwner();
        denied();

        assertThatThrownBy(() -> service.restoreHallItem(
                com.action.camera.admin.dto.AdminHallItemType.SERVICE_PACKAGE, ITEM, "reviewed"))
                .isInstanceOf(BusinessException.class);
        assertThat(pack.getModerationStatus()).isEqualTo(ModerationStatus.HIDDEN);
        verify(packages, never()).findByIdForUpdate(ITEM);
        verify(packages, never()).save(any());
    }

    @Test
    void grantedMomentRestorationLocksOwnerBeforeContentAndPreservesModerationAudit() {
        MomentPost post = new MomentPost();
        post.setId(ITEM);
        post.setAuthorId(OWNER);
        post.setModerationStatus(ModerationStatus.HIDDEN);
        when(moments.findById(ITEM)).thenReturn(Optional.of(post));
        when(moments.findByIdForUpdate(ITEM)).thenReturn(Optional.of(post));
        activeOwner();

        service.restoreMoment(ITEM, "reviewed");

        assertThat(post.getModerationStatus()).isEqualTo(ModerationStatus.VISIBLE);
        verify(moments).save(post);
        verify(audits).record("MOMENT", ITEM, 99L, "RESTORE", "reviewed");
        InOrder order = inOrder(users, consent, moments);
        order.verify(users).findByIdForUpdate(OWNER);
        order.verify(consent).requireBusinessConsent(OWNER, true);
        order.verify(moments).findByIdForUpdate(ITEM);
    }
}