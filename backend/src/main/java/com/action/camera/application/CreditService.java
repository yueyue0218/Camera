package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.CreditRecord;
import com.action.camera.domain.User;
import com.action.camera.repository.CreditRecordRepository;
import com.action.camera.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class CreditService {

    private final UserRepository userRepository;
    private final CreditRecordRepository creditRecordRepository;

    public CreditService(UserRepository userRepository,
                         CreditRecordRepository creditRecordRepository) {
        this.userRepository = userRepository;
        this.creditRecordRepository = creditRecordRepository;
    }

    /**
     * 更新信用分（D 评价完成后调用此方法，不要直接改 users 表）
     *
     * @param userId      被更新的用户 id
     * @param scoreChange 变化值，正数加分，负数扣分
     * @param eventType   事件类型，如 ORDER_COMPLETED / CANCEL_PENALTY / LATE_DELIVERY 等
     * @param orderId     关联订单 id，无则传 null
     * @param reason      原因说明
     */
    @Transactional
    public void updateCreditScore(Long userId, int scoreChange,
                                  String eventType, Long orderId, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "用户不存在"));

        // 计算新分数，限制在 [0, 100]
        BigDecimal newScore = user.getCreditScore()
                .add(BigDecimal.valueOf(scoreChange))
                .max(BigDecimal.ZERO)
                .min(new BigDecimal("100.00"));

        user.setCreditScore(newScore);
        userRepository.save(user);

        // 写信用流水
        CreditRecord record = new CreditRecord();
        record.setUserId(userId);
        record.setRelatedOrderId(orderId);
        record.setEventType(eventType);
        record.setScoreChange(scoreChange);
        record.setScoreAfter(newScore);
        record.setReason(reason);
        creditRecordRepository.save(record);
    }

    /** 查询用户信用分流水（D3 信用摘要用） */
    public List<CreditRecord> getCreditHistory(Long userId) {
        return creditRecordRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}