package com.action.camera.photoauthorization.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.photoauthorization.dto.PhotoAuthorizationRequest;
import com.action.camera.photoauthorization.dto.PhotoAuthorizationResponse;
import com.action.camera.photoauthorization.service.PhotoAuthorizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class PhotoAuthorizationController {

    private final PhotoAuthorizationService photoAuthorizationService;

    @PostMapping("/orders/{orderId}/photo-authorizations/requests")
    public Result<PhotoAuthorizationResponse> requestAuthorization(
            @PathVariable Long orderId,
            @RequestBody PhotoAuthorizationRequest request
    ) {
        return Result.success(photoAuthorizationService.requestAuthorization(orderId, currentUserId(), request));
    }

    @PostMapping("/photo-authorizations/{authorizationId}/approve")
    public Result<PhotoAuthorizationResponse> approve(
            @PathVariable Long authorizationId,
            @RequestBody(required = false) PhotoAuthorizationRequest request
    ) {
        String remark = request == null ? null : request.getRemark();
        return Result.success(photoAuthorizationService.approve(authorizationId, currentUserId(), remark));
    }

    @PostMapping("/photo-authorizations/{authorizationId}/reject")
    public Result<PhotoAuthorizationResponse> reject(
            @PathVariable Long authorizationId,
            @RequestBody(required = false) PhotoAuthorizationRequest request
    ) {
        String remark = request == null ? null : request.getRemark();
        return Result.success(photoAuthorizationService.reject(authorizationId, currentUserId(), remark));
    }

    @GetMapping("/orders/{orderId}/photo-authorizations")
    public Result<List<PhotoAuthorizationResponse>> listOrderAuthorizations(@PathVariable Long orderId) {
        return Result.success(photoAuthorizationService.listOrderAuthorizations(orderId, currentUserId()));
    }

    @GetMapping("/photo-authorizations/provider")
    public Result<List<PhotoAuthorizationResponse>> listProviderAuthorizations() {
        return Result.success(photoAuthorizationService.listProviderAuthorizations(currentUserId()));
    }

    private Long currentUserId() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return userId;
    }
}
