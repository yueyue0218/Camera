package com.action.camera.credit.controller;

import com.action.camera.application.CreditService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.credit.dto.CreditRecordResponse;
import com.action.camera.credit.dto.CreditSummaryResponse;
import com.action.camera.credit.service.CreditSnapshotService;
import com.action.camera.domain.CreditRecord;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
public class CreditController {

    private final CreditService creditService;
    private final UserRepository userRepository;
    private final CreditSnapshotService creditSnapshotService;

    public CreditController(CreditService creditService,
                            UserRepository userRepository,
                            CreditSnapshotService creditSnapshotService) {
        this.creditService = creditService;
        this.userRepository = userRepository;
        this.creditSnapshotService = creditSnapshotService;
    }

    @GetMapping("/users/{userId}/credit")
    public Result<CreditSummaryResponse> getCreditSummary(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        List<CreditRecord> records = creditService.getCreditHistory(user.getId());
        CreditSnapshotService.CreditSnapshot snapshot = creditSnapshotService.getSnapshot(user.getId());
        BigDecimal currentScore = user.getCreditScore() != null
                ? user.getCreditScore()
                : snapshot.creditScore();

        return Result.success(new CreditSummaryResponse(
                user.getId(),
                currentScore,
                creditSnapshotService.resolveCreditLevel(currentScore, snapshot.effectiveOrderCount(), snapshot.receivedReviewCount()),
                (long) records.size(),
                records.isEmpty() ? null : records.get(0).getCreatedAt(),
                snapshot.effectiveOrderCount(),
                snapshot.completedOrderCount(),
                snapshot.goodReviewRate(),
                snapshot.defaultRate(),
                snapshot.riskRecordCount(),
                snapshot.receivedReviewCount(),
                snapshot.averageRating()
        ));
    }

    @GetMapping("/users/{userId}/credit-records")
    public Result<List<CreditRecordResponse>> listCreditRecords(@PathVariable Long userId) {
        requireSelfOrAdmin(userId);
        return Result.success(creditService.getCreditHistory(userId).stream()
                .map(this::toResponse)
                .toList());
    }

    private CreditRecordResponse toResponse(CreditRecord record) {
        return new CreditRecordResponse(
                record.getId(),
                record.getUserId(),
                record.getRelatedOrderId(),
                record.getEventType(),
                record.getScoreChange(),
                record.getBeforeScore(),
                record.getScoreAfter(),
                record.getAfterScore(),
                record.getAppliedScoreChange(),
                record.getSourceType(),
                record.getSourceId(),
                record.getReason(),
                record.getCreatedAt()
        );
    }

    private void requireSelfOrAdmin(Long userId) {
        Long currentUserId = UserContext.getUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (currentUserId.equals(userId) || UserContext.isAdmin()) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "只能查看自己的信用记录");
    }
}
