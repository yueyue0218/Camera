package com.action.camera.provider.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.provider.dto.ProviderProfilePublicVO;
import com.action.camera.provider.dto.ProviderProfileUpdateDTO;
import com.action.camera.provider.service.ProviderProfileService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/providers")
public class ProviderProfileController {

    private final ProviderProfileService providerProfileService;

    public ProviderProfileController(ProviderProfileService providerProfileService) {
        this.providerProfileService = providerProfileService;
    }

    /**
     * PUT /api/v1/providers/me/profile
     * 摄影师编辑自己的主页。需要 JWT 认证。
     */
    @PutMapping("/me/profile")
    public Result<Void> updateMyProfile(@Valid @RequestBody ProviderProfileUpdateDTO dto) {
        Long currentUserId = UserContext.getUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        providerProfileService.updateProfile(currentUserId, dto);
        return Result.success(null, "主页更新成功");
    }

    /**
     * GET /api/v1/providers/{providerUserId}/profile
     * 公开主页，无需认证。
     */
    @GetMapping("/{providerUserId}/profile")
    public Result<ProviderProfilePublicVO> getPublicProfile(@PathVariable Long providerUserId) {
        return Result.success(providerProfileService.getPublicProfile(providerUserId));
    }

}
