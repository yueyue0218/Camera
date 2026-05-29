package com.action.camera.review.controller;

import com.action.camera.common.Result;
import com.action.camera.review.dto.ReviewComplaintArbitrateRequest;
import com.action.camera.review.dto.ReviewComplaintCreateRequest;
import com.action.camera.review.dto.ReviewComplaintResponse;
import com.action.camera.review.service.ReviewComplaintService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ReviewComplaintController {

    private final ReviewComplaintService complaintService;

    public ReviewComplaintController(ReviewComplaintService complaintService) {
        this.complaintService = complaintService;
    }

    @PostMapping("/reviews/{reviewId}/complaints")
    public Result<ReviewComplaintResponse> create(@PathVariable Long reviewId,
                                                  @RequestBody ReviewComplaintCreateRequest request) {
        return Result.success(complaintService.create(reviewId, request));
    }

    @GetMapping("/reviews/complaints/my")
    public Result<List<ReviewComplaintResponse>> listMine() {
        return Result.success(complaintService.listMine());
    }

    @GetMapping("/reviews/{reviewId}/complaints")
    public Result<List<ReviewComplaintResponse>> listByReview(@PathVariable Long reviewId) {
        return Result.success(complaintService.listByReview(reviewId));
    }

    @PostMapping("/reviews/complaints/{complaintId}/cancel")
    public Result<ReviewComplaintResponse> cancel(@PathVariable Long complaintId) {
        return Result.success(complaintService.cancel(complaintId));
    }

    @GetMapping("/admin/review-complaints")
    public Result<List<ReviewComplaintResponse>> listForArbitration(@RequestParam(required = false) String status) {
        return Result.success(complaintService.listForArbitration(status));
    }

    @PatchMapping("/admin/review-complaints/{complaintId}/arbitration")
    public Result<ReviewComplaintResponse> arbitrate(@PathVariable Long complaintId,
                                                     @RequestBody ReviewComplaintArbitrateRequest request) {
        return Result.success(complaintService.arbitrate(complaintId, request));
    }
}
