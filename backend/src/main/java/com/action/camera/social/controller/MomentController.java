package com.action.camera.social.controller;

import com.action.camera.common.Result;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.MockCurrentUserProvider;
import com.action.camera.social.dto.CreateMomentRequest;
import com.action.camera.social.dto.MomentDto;
import com.action.camera.social.service.MomentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/moments")
public class MomentController {

    private final MomentService momentService;
    private final MockCurrentUserProvider currentUserProvider;

    public MomentController(MomentService momentService, MockCurrentUserProvider currentUserProvider) {
        this.momentService = momentService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    public Result<List<MomentDto>> listMoments(@RequestParam(required = false) String keyword,
                                               HttpServletRequest request) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(request);
        return Result.success(momentService.listMoments(currentUser, keyword));
    }

    @PostMapping
    public Result<MomentDto> createMoment(@RequestBody CreateMomentRequest createRequest,
                                          HttpServletRequest request) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(request);
        return Result.success(momentService.createMoment(currentUser, createRequest));
    }

    @GetMapping("/{momentId}")
    public Result<MomentDto> getMoment(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(request);
        return Result.success(momentService.getMoment(momentId, currentUser));
    }

    @PostMapping("/{momentId}/like")
    public Result<MomentDto> toggleLike(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(request);
        return Result.success(momentService.toggleLike(momentId, currentUser));
    }

    @PostMapping("/{momentId}/favorite")
    public Result<MomentDto> toggleFavorite(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(request);
        return Result.success(momentService.toggleFavorite(momentId, currentUser));
    }

    @DeleteMapping("/{momentId}")
    public Result<Void> deleteMoment(@PathVariable Long momentId, HttpServletRequest request) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(request);
        momentService.deleteMoment(momentId, currentUser);
        return Result.success(null);
    }
}
