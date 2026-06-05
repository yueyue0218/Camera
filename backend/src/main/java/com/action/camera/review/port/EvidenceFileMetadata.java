package com.action.camera.review.port;

public record EvidenceFileMetadata(
        Long fileId,
        Long uploaderId,
        String mimeType,
        boolean deleted
) {
}
