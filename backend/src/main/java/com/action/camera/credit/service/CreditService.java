package com.action.camera.credit.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.credit.dto.CreditRecordResponse;
import com.action.camera.credit.dto.CreditSummaryResponse;
import com.action.camera.credit.entity.CreditRecord;
import com.action.camera.credit.repository.CreditRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class CreditService {

    private static final BigDecimal INITIAL_SCORE = BigDecimal.valueOf(80);
    private static final BigDecimal MIN_SCORE = BigDecimal.ZERO;
    private static final BigDecimal MAX_SCORE = BigDecimal.valueOf(100);
    private static final String REVIEW_EVENT = "REVIEW";

    private final CreditRecordRepository creditRecordRepository;

    public CreditService(CreditRecordRepository creditRecordRepository) {
        this.creditRecordRepository = creditRecordRepository;
    }

    @Transactional
    public CreditRecordResponse createReviewCreditRecord(Long userId, Long orderId, Integer rating, String reason) {
        if (userId == null || rating == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "用户和评分不能为空");
        }
        if (rating < 1 || rating > 5) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "评分必须在 1-5 之间");
        }

        int scoreChange = calculateReviewScoreChange(rating);
        BigDecimal scoreBefore = latestScore(userId);
        BigDecimal scoreAfter = clamp(scoreBefore.add(BigDecimal.valueOf(scoreChange)));

        CreditRecord record = new CreditRecord();
        record.setUserId(userId);
        record.setRelatedOrderId(orderId);
        record.setEventType(REVIEW_EVENT);
        record.setScoreChange(scoreChange);
        record.setScoreAfter(scoreAfter);
        record.setReason(reason);
        record.setCreatedAt(LocalDateTime.now());

        return toResponse(creditRecordRepository.save(record));
    }

    @Transactional(readOnly = true)
    public CreditSummaryResponse getCreditSummary(Long userId) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "用户不能为空");
        }
        return creditRecordRepository.findFirstByUserIdOrderByCreatedAtDescIdDesc(userId)
                .map(record -> new CreditSummaryResponse(
                        userId,
                        record.getScoreAfter(),
                        creditRecordRepository.countByUserId(userId),
                        record.getCreatedAt()
                ))
                .orElseGet(() -> new CreditSummaryResponse(userId, INITIAL_SCORE, 0L, null));
    }

    @Transactional(readOnly = true)
    public List<CreditRecordResponse> listRecords(Long userId) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "用户不能为空");
        }
        return creditRecordRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    private int calculateReviewScoreChange(Integer rating) {
        return switch (rating) {
            case 5 -> 2;
            case 4 -> 1;
            case 3 -> 0;
            case 2 -> -2;
            case 1 -> -5;
            default -> throw new BusinessException(ErrorCode.VALIDATION_ERROR, "评分必须在 1-5 之间");
        };
    }

    private BigDecimal latestScore(Long userId) {
        return creditRecordRepository.findFirstByUserIdOrderByCreatedAtDescIdDesc(userId)
                .map(CreditRecord::getScoreAfter)
                .orElse(INITIAL_SCORE);
    }

    private BigDecimal clamp(BigDecimal score) {
        if (score.compareTo(MIN_SCORE) < 0) {
            return MIN_SCORE;
        }
        if (score.compareTo(MAX_SCORE) > 0) {
            return MAX_SCORE;
        }
        return score;
    }

    private CreditRecordResponse toResponse(CreditRecord record) {
        return new CreditRecordResponse(
                record.getId(),
                record.getUserId(),
                record.getRelatedOrderId(),
                record.getEventType(),
                record.getScoreChange(),
                record.getScoreAfter(),
                record.getReason(),
                record.getCreatedAt()
        );
    }
}
