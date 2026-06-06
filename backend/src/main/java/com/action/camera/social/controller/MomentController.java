package com.action.camera.social.controller;

import com.action.camera.common.Result;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.social.dto.CreateMomentRequest;
import com.action.camera.social.dto.MomentDto;
import com.action.camera.social.service.MomentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/moments")
public class MomentController {

    private final MomentService momentService;

    public MomentController(MomentService momentService) {
        this.momentService = momentService;
    }

    @GetMapping
    public Result<List<MomentDto>> listMoments(@RequestParam(required = false, defaultValue = "latest") String scope,
                                               @RequestParam(required = false) Long authorId,
                                               @RequestParam(required = false) String authorRole,
                                               HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.listMoments(currentUser, scope, authorId, authorRole));
    }

    @PostMapping
    public Result<MomentDto> createMoment(@RequestBody CreateMomentRequest createRequest,
                                          HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.createMoment(currentUser, createRequest));
    }

    @PutMapping("/{momentId}")
    public Result<MomentDto> updateMoment(@PathVariable Long momentId,
                                          @RequestBody CreateMomentRequest createRequest,
                                          HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.updateMoment(momentId, currentUser, createRequest));
    }

    @GetMapping("/{momentId}")
    public Result<MomentDto> getMoment(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.getMoment(momentId, currentUser));
    }

    @PostMapping("/{momentId}/like")
    public Result<MomentDto> toggleLike(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.toggleLike(momentId, currentUser));
    }

    @PutMapping("/{momentId}/like")
    public Result<MomentDto> likeMoment(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.likeMoment(momentId, currentUser));
    }

    @DeleteMapping("/{momentId}/like")
    public Result<MomentDto> unlikeMoment(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.unlikeMoment(momentId, currentUser));
    }

    @PostMapping("/{momentId}/favorite")
    public Result<MomentDto> toggleFavorite(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.toggleFavorite(momentId, currentUser));
    }

    @PutMapping("/{momentId}/favorite")
    public Result<MomentDto> favoriteMoment(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.favoriteMoment(momentId, currentUser));
    }

    @DeleteMapping("/{momentId}/favorite")
    public Result<MomentDto> unfavoriteMoment(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        return Result.success(momentService.unfavoriteMoment(momentId, currentUser));
    }

    @DeleteMapping("/{momentId}")
    public Result<Void> deleteMoment(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUser();
        momentService.deleteMoment(momentId, currentUser);
        return Result.success(null);
    }

    private CurrentUser currentUser() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        UserRole role = UserContext.getCurrentRole() == null ? UserRole.CUSTOMER : UserContext.getCurrentRole();
        return new CurrentUser(userId, role);
    }
}
