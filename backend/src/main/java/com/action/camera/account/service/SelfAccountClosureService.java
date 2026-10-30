package com.action.camera.account.service;

import com.action.camera.account.domain.*;
import com.action.camera.account.repository.*;
import com.action.camera.admin.service.AdminPermissionService;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.service.*;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.privacy.dto.PrivacyDtos.*;
import com.action.camera.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

/** Verified self-service account termination; never DELETEs a user or cascades business history. */
@Service
public class SelfAccountClosureService {
    public static final String RETENTION_NOTICE="账号服务已停止，个人资料已匿名化，公开内容已下线；约拍、消息、举报和依法需保留的证据按权限受限保存，原始文件及备份由运营按留存清单处理。";
    private final UserRepository users;
    private final PhoneSmsService sms;
    private final PhoneIdentityCodec phoneCodec;
    private final PhoneNumberNormalizer normalizer;
    private final AccountCancellationRequestRepository requests;
    private final AccountCancellationCleanupRepository cleanup;
    private final AdminPermissionService permissions;
    public SelfAccountClosureService(UserRepository users,PhoneSmsService sms,PhoneIdentityCodec phoneCodec,
            PhoneNumberNormalizer normalizer,AccountCancellationRequestRepository requests,
            AccountCancellationCleanupRepository cleanup,AdminPermissionService permissions) {
        this.users=users; this.sms=sms; this.phoneCodec=phoneCodec; this.normalizer=normalizer;
        this.requests=requests; this.cleanup=cleanup; this.permissions=permissions;
    }
    @Transactional(noRollbackFor=SmsSendFailedException.class)
    public void sendCode(Long userId,ClosureCode input,String requestIp) {
        User user=active(userId,false);
        String phone=verifyBoundPhone(user,input.phone());
        sms.sendCode(phone,SmsPurpose.REAUTH,requestIp,input.deviceId());
    }
    @Transactional(noRollbackFor=SmsCodeInvalidException.class)
    public ClosureView close(Long userId,ClosureConfirm input) {
        if(input==null || !Boolean.TRUE.equals(input.confirmed()))
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,"请明确确认注销后果");
        // Same lock order as the administrator flow: request -> account -> related quotes.
        AccountCancellationRequest record=requests.findByUserIdForUpdate(userId).orElse(null);
        User user=active(userId,true);
        if(permissions.hasAdminPermission(userId)) throw new BusinessException(ErrorCode.STATUS_CONFLICT,"管理员须先移除管理权限");
        String phone=verifyBoundPhone(user,input.phone());
        cleanup.lockParticipantQuotes(userId);
        if(cleanup.countBlockingOrders(userId)>0 || cleanup.countOpenDisputes(userId)>0)
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,"仍有进行中的约拍约定或未解决争议，请先处理或提交权利申请");
        sms.verifyCode(phone,SmsPurpose.REAUTH,input.code());
        LocalDateTime now=LocalDateTime.now();
        cleanup.cleanupUserData(userId,user.getMobileHash(),now);
        AdminAccountCancellationService.anonymize(user);
        users.saveAndFlush(user);
        if(record==null) { record=new AccountCancellationRequest(); record.setUserId(userId); record.setRequestedAt(now); }
        record.setStatus(AccountCancellationStatus.COMPLETED); record.setProcessedAt(now); record.setUpdatedAt(now);
        record.setReason("本人短信核验并确认注销"); record.setResolutionNote("本人短信核验完成，账号服务终止、会话撤销与个人资料匿名化已完成；关联证据受限保留。");
        requests.saveAndFlush(record);
        return new ClosureView("CLOSED",now,RETENTION_NOTICE);
    }
    private User active(Long id,boolean lock) {
        return (lock ? users.findByIdForUpdate(id) : users.findById(id))
                .filter(u -> "ACTIVE".equals(u.getStatus())).orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
    }
    private String verifyBoundPhone(User user,String rawPhone) {
        String phone=normalizer.normalize(rawPhone);
        if(user.getMobileHash()==null || !user.getMobileHash().equals(phoneCodec.lookupHash(phone)))
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,"请输入当前账号绑定的手机号");
        return phone;
    }
}
