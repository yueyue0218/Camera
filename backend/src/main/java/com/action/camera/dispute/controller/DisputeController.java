package com.action.camera.dispute.controller;

import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.dispute.dto.DisputeArbitrateRequest;
import com.action.camera.dispute.dto.DisputeCreateRequest;
import com.action.camera.dispute.dto.DisputeReplyRequest;
import com.action.camera.dispute.dto.DisputeResponse;
import com.action.camera.dispute.service.DisputeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class DisputeController {

    private final DisputeService disputeService;

    public DisputeController(DisputeService disputeService) {
        this.disputeService = disputeService;
    }

    @PostMapping("/orders/{orderId}/disputes")
    public Result<DisputeResponse> createDispute(@PathVariable Long orderId,
                                                 @RequestBody DisputeCreateRequest request) {
        Long currentUserId = UserContext.getUserId();
        return Result.success(disputeService.createDispute(orderId, currentUserId, request));
    }

    @PostMapping("/disputes/{disputeId}/replies")
    public Result<DisputeResponse> replyDispute(@PathVariable Long disputeId,
                                                @RequestBody DisputeReplyRequest request) {
        Long currentUserId = UserContext.getUserId();
        return Result.success(disputeService.replyDispute(disputeId, currentUserId, request));
    }

    @PatchMapping("/admin/disputes/{disputeId}/arbitration")
    public Result<DisputeResponse> arbitrate(@PathVariable Long disputeId,
                                             @RequestBody DisputeArbitrateRequest request) {
        Long currentUserId = UserContext.getUserId();
        return Result.success(disputeService.arbitrate(disputeId, currentUserId, request));
    }

    @GetMapping("/disputes/{disputeId}")
    public Result<DisputeResponse> getDispute(@PathVariable Long disputeId) {
        Long currentUserId = UserContext.getUserId();
        return Result.success(disputeService.getDispute(disputeId, currentUserId));
    }

    @GetMapping("/orders/{orderId}/disputes")
    public Result<List<DisputeResponse>> listByOrder(@PathVariable Long orderId) {
        Long currentUserId = UserContext.getUserId();
        return Result.success(disputeService.listByOrder(orderId, currentUserId));
    }
}
