package com.action.camera.social.dto;

import com.action.camera.provider.dto.ProviderProfilePublicVO;

public class PublicProfileResponse {

    private final Long userId;
    private final String nickname;
    private final Long avatarFileId;
    private final String bio;
    private final String currentRole;
    private final long followerCount;
    private final long followingCount;
    private final boolean followedByCurrentUser;
    private final long momentCount;
    private final ProviderProfilePublicVO providerProfile;
    private final String cityCode;

    public PublicProfileResponse(Long userId, String nickname, Long avatarFileId, String bio, String currentRole,
                                 long followerCount, long followingCount, boolean followedByCurrentUser,
                                 long momentCount, ProviderProfilePublicVO providerProfile, String cityCode) {
        this.userId = userId;
        this.nickname = nickname;
        this.avatarFileId = avatarFileId;
        this.bio = bio;
        this.currentRole = currentRole;
        this.followerCount = followerCount;
        this.followingCount = followingCount;
        this.followedByCurrentUser = followedByCurrentUser;
        this.momentCount = momentCount;
        this.providerProfile = providerProfile;
        this.cityCode = cityCode;
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

    public String getBio() {
        return bio;
    }

    public String getCurrentRole() {
        return currentRole;
    }

    public long getFollowerCount() {
        return followerCount;
    }

    public long getFollowingCount() {
        return followingCount;
    }

    public boolean isFollowedByCurrentUser() {
        return followedByCurrentUser;
    }

    public long getMomentCount() {
        return momentCount;
    }

    public ProviderProfilePublicVO getProviderProfile() {
        return providerProfile;
    }

    public String getCityCode() {
        return cityCode;
    }
}
