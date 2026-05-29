package com.action.camera.credit.controller;

import com.action.camera.application.CreditService;
import com.action.camera.common.Result;
import com.action.camera.credit.dto.CreditRecordResponse;
import com.action.camera.credit.dto.CreditSummaryResponse;
import com.action.camera.domain.CreditRecord;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class CreditController {

    private final CreditService creditService;
    private final UserRepository userRepository;

    public CreditController(CreditService creditService, UserRepository userRepository) {
        this.creditService = creditService;
        this.userRepository = userRepository;
    }

    @GetMapping("/users/{userId}/credit")
    public Result<CreditSummaryResponse> getCreditSummary(@PathVariable Long userId) {
        List<CreditRecord> records = creditService.getCreditHistory(userId);
        return Result.success(new CreditSummaryResponse(
                userId,
                userRepository.findById(userId).map(User::getCreditScore).orElse(null),
                (long) records.size(),
                records.isEmpty() ? null : records.get(0).getCreatedAt()
        ));
    }

    @GetMapping("/users/{userId}/credit-records")
    public Result<List<CreditRecordResponse>> listCreditRecords(@PathVariable Long userId) {
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
                record.getScoreAfter(),
                record.getReason(),
                record.getCreatedAt()
        );
    }
}
