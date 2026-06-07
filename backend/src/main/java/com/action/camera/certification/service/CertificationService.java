package com.action.camera.certification.service;

import com.action.camera.certification.dto.CertificationRequest;
import com.action.camera.certification.dto.CertificationResponse;
import com.action.camera.common.page.PageResult;

public interface CertificationService {

    /** 用户提交实名认证申请 */
    CertificationResponse submit(Long userId, CertificationRequest request);

    /** 查询当前用户最新一条认证记录 */
    CertificationResponse getMyLatest(Long userId);

    /** 管理员审核通过 */
    void approve(Long adminId, Long certId);

    /** 管理员拒绝，需说明原因 */
    void reject(Long adminId, Long certId, String rejectReason);

    /** 管理员分页查询认证列表，status 为 null 时查全部 */
    PageResult<CertificationResponse> listByStatus(Long adminId, String status, int page, int size);
}
