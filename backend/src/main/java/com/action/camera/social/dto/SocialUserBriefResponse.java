package com.action.camera.social.dto;

public class SocialUserBriefResponse {

    private final Long userId;
    private final String nickname;
    private final Long avatarFileId;
    private final String currentRole;
    private final String bio;
    private final boolean followedByCurrentUser;

    public SocialUserBriefResponse(Long userId, String nickname, Long avatarFileId, String currentRole,
                                   String bio, boolean followedByCurrentUser) {
        this.userId = userId;
        this.nickname = nickname;
        this.avatarFileId = avatarFileId;
        this.currentRole = currentRole;
        this.bio = bio;
        this.followedByCurrentUser = followedByCurrentUser;
    }

    public Long getUserId() {
        return userId;
    }

    public String getNickname() {
        return nickname;
    }

    public Long getAvatarFileId() {
        return avatarFileId;
    }

    public String getCurrentRole() {
        return currentRole;
    }

    public String getBio() {
        return bio;
    }

    public boolean isFollowedByCurrentUser() {
        return followedByCurrentUser;
    }
}
