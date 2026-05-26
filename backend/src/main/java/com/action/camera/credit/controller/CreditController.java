package com.action.camera.credit.controller;

import com.action.camera.common.Result;
import com.action.camera.credit.dto.CreditRecordResponse;
import com.action.camera.credit.dto.CreditSummaryResponse;
import com.action.camera.credit.service.CreditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class CreditController {

    private final CreditService creditService;

    public CreditController(CreditService creditService) {
        this.creditService = creditService;
    }

    @GetMapping("/users/{userId}/credit")
    public Result<CreditSummaryResponse> getCreditSummary(@PathVariable Long userId) {
        return Result.success(creditService.getCreditSummary(userId));
    }

    @GetMapping("/users/{userId}/credit-records")
    public Result<List<CreditRecordResponse>> listCreditRecords(@PathVariable Long userId) {
        return Result.success(creditService.listRecords(userId));
    }
}
