package com.action.camera.social.dto;

public class FollowStateResponse {

    private final Long targetUserId;
    private final boolean followed;
    private final long followerCount;
    private final long followingCount;

    public FollowStateResponse(Long targetUserId, boolean followed, long followerCount, long followingCount) {
        this.targetUserId = targetUserId;
        this.followed = followed;
        this.followerCount = followerCount;
        this.followingCount = followingCount;
    }

    public Long getTargetUserId() {
        return targetUserId;
    }

    public boolean isFollowed() {
        return followed;
    }

    public long getFollowerCount() {
        return followerCount;
    }

    public long getFollowingCount() {
        return followingCount;
    }
}
