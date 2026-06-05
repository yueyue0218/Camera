package com.action.camera.review.adapter;

import com.action.camera.repository.FileRepository;
import com.action.camera.review.port.EvidenceFileMetadata;
import com.action.camera.review.port.EvidenceFileQueryPort;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class LocalEvidenceFileQueryAdapter implements EvidenceFileQueryPort {

    private final FileRepository fileRepository;

    public LocalEvidenceFileQueryAdapter(FileRepository fileRepository) {
        this.fileRepository = fileRepository;
    }

    @Override
    public Optional<EvidenceFileMetadata> findById(Long fileId) {
        return fileRepository.findById(fileId)
                .map(file -> new EvidenceFileMetadata(
                        file.getId(),
                        file.getUploaderId(),
                        file.getMimeType(),
                        false
                ));
    }
}
