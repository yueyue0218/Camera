package com.action.camera.social.controller;

import com.action.camera.common.Result;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.social.dto.FollowStateResponse;
import com.action.camera.social.dto.PublicProfileResponse;
import com.action.camera.social.dto.SocialUserBriefResponse;
import com.action.camera.social.service.SocialRelationService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/users")
public class UserSocialController {

    private final SocialRelationService socialRelationService;

    public UserSocialController(SocialRelationService socialRelationService) {
        this.socialRelationService = socialRelationService;
    }

    @PutMapping("/{userId}/follow")
    public Result<FollowStateResponse> follow(@PathVariable Long userId) {
        return Result.success(socialRelationService.follow(userId, currentUser()));
    }

    @DeleteMapping("/{userId}/follow")
    public Result<FollowStateResponse> unfollow(@PathVariable Long userId) {
        return Result.success(socialRelationService.unfollow(userId, currentUser()));
    }

    @GetMapping("/{userId}/followers")
    public Result<List<SocialUserBriefResponse>> followers(@PathVariable Long userId) {
        return Result.success(socialRelationService.listFollowers(userId, currentUser()));
    }

    @GetMapping("/{userId}/following")
    public Result<List<SocialUserBriefResponse>> following(@PathVariable Long userId) {
        return Result.success(socialRelationService.listFollowing(userId, currentUser()));
    }

    @GetMapping("/{userId}/public-profile")
    public Result<PublicProfileResponse> publicProfile(@PathVariable Long userId) {
        return Result.success(socialRelationService.getPublicProfile(userId, currentUser()));
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
