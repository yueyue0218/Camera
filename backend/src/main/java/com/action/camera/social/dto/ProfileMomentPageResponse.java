package com.action.camera.social.dto;

import java.util.List;

public record ProfileMomentPageResponse(
        List<MomentDto> records,
        int page,
        int size,
        long total,
        long totalLikeCount,
        long totalFavoriteCount) {
}
