package com.action.camera.review.controller;

import com.action.camera.common.Result;
import com.action.camera.review.dto.ReviewCreateRequest;
import com.action.camera.review.dto.ReviewResponse;
import com.action.camera.review.service.ReviewService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping("/orders/{orderId}/reviews")
    public Result<ReviewResponse> create(@PathVariable Long orderId,
                                         @RequestBody ReviewCreateRequest request) {
        return Result.success(reviewService.create(orderId, request));
    }

    @GetMapping("/orders/{orderId}/reviews")
    public Result<List<ReviewResponse>> listByOrder(@PathVariable Long orderId) {
        return Result.success(reviewService.listByOrder(orderId));
    }

    @GetMapping("/users/{userId}/reviews")
    public Result<List<ReviewResponse>> listReceivedByUser(@PathVariable Long userId) {
        return Result.success(reviewService.listReceivedByUser(userId));
    }
}
