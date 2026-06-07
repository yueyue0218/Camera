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
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

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
    public CreditRecord updateCreditScore(Long userId, int scoreChange,
                                          String eventType, Long orderId, String reason) {
        return updateCreditScore(userId, scoreChange, eventType, orderId, reason, eventType, orderId);
    }

    @Transactional
    public CreditRecord updateCreditScore(Long userId, int scoreChange,
                                          String eventType, Long orderId, String reason,
                                          String sourceType, Long sourceId) {
        if (sourceType != null && sourceId != null) {
            Optional<CreditRecord> existing = creditRecordRepository.findBySourceTypeAndSourceId(sourceType, sourceId);
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "用户不存在"));

        BigDecimal beforeScore = normalizeScore(user.getCreditScore());
        BigDecimal newScore = beforeScore.add(BigDecimal.valueOf(scoreChange))
                .max(BigDecimal.ZERO)
                .min(new BigDecimal("100.00"))
                .setScale(2, RoundingMode.HALF_UP);
        int appliedScoreChange = newScore.subtract(beforeScore).intValue();

        user.setCreditScore(newScore);
        userRepository.save(user);

        CreditRecord record = new CreditRecord();
        record.setUserId(userId);
        record.setRelatedOrderId(orderId);
        record.setEventType(eventType);
        record.setScoreChange(scoreChange);
        record.setBeforeScore(beforeScore);
        record.setScoreAfter(newScore);
        record.setAfterScore(newScore);
        record.setAppliedScoreChange(appliedScoreChange);
        record.setSourceType(sourceType);
        record.setSourceId(sourceId);
        record.setReason(reason);
        return creditRecordRepository.save(record);
    }

    @Transactional
    public CreditRecord reverseCreditAdjustment(Long userId,
                                                String originalSourceType,
                                                Long originalSourceId,
                                                String reversalEventType,
                                                Long relatedOrderId,
                                                String reason,
                                                String reversalSourceType,
                                                Long reversalSourceId,
                                                int fallbackScoreChange) {
        if (reversalSourceType != null && reversalSourceId != null) {
            Optional<CreditRecord> existing = creditRecordRepository.findBySourceTypeAndSourceId(reversalSourceType, reversalSourceId);
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        int appliedChange = creditRecordRepository.findBySourceTypeAndSourceId(originalSourceType, originalSourceId)
                .map(CreditRecord::getAppliedScoreChange)
                .orElse(fallbackScoreChange);
        return updateCreditScore(
                userId,
                -appliedChange,
                reversalEventType,
                relatedOrderId,
                reason,
                reversalSourceType,
                reversalSourceId
        );
    }

    /** 查询用户信用分流水（D3 信用摘要用） */
    public List<CreditRecord> getCreditHistory(Long userId) {
        return creditRecordRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    private BigDecimal normalizeScore(BigDecimal score) {
        if (score == null) {
            return new BigDecimal("80.00");
        }
        return score.setScale(2, RoundingMode.HALF_UP);
    }
}
