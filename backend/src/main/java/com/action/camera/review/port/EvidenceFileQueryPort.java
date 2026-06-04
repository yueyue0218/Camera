package com.action.camera.review.port;

import java.util.Optional;

public interface EvidenceFileQueryPort {

    Optional<EvidenceFileMetadata> findById(Long fileId);
}
