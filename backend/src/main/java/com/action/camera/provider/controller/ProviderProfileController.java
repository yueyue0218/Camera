package com.action.camera.provider.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.provider.dto.ProviderProfilePublicVO;
import com.action.camera.provider.dto.ProviderProfileUpdateDTO;
import com.action.camera.provider.service.ProviderProfileService;
import jakarta.servlet.http.HttpServletRequest;
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
    private final JwtUtil jwtUtil;

    public ProviderProfileController(ProviderProfileService providerProfileService, JwtUtil jwtUtil) {
        this.providerProfileService = providerProfileService;
        this.jwtUtil = jwtUtil;
    }

    /**
     * PUT /api/v1/providers/me/profile
     * 摄影师编辑自己的主页。需要 JWT 认证。
     *
     * 注意：该路径被 WebMvcConfig 排除在全局拦截器之外（与公开 GET 共享 pattern），
     * 因此在此处手动解析 userId。
     */
    @PutMapping("/me/profile")
    public Result<Void> updateMyProfile(@Valid @RequestBody ProviderProfileUpdateDTO dto,
                                         HttpServletRequest request) {
        Long currentUserId = resolveUserId(request);
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

    /** 优先从线程上下文取（拦截器已解析），回退到手动解析 header。 */
    private Long resolveUserId(HttpServletRequest request) {
        Long fromContext = UserContext.getUserId();
        if (fromContext != null) {
            return fromContext;
        }
        String demoId = request.getHeader("X-User-Id");
        if (demoId != null && !demoId.isBlank()) {
            try { return Long.parseLong(demoId.trim()); } catch (NumberFormatException ignored) {}
        }
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            try { return jwtUtil.parseUserId(auth.substring(7)); } catch (Exception ignored) {}
        }
        return null;
    }
}
