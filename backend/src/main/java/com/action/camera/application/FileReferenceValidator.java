package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.FileRecord;
import com.action.camera.repository.FileRepository;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FileReferenceValidator {

    private final FileRepository fileRepository;

    public FileReferenceValidator(FileRepository fileRepository) {
        this.fileRepository = fileRepository;
    }

    public void requireExisting(Collection<Long> fileIds, String fieldName) {
        List<Long> normalized = fileIds == null
                ? List.of()
                : fileIds.stream()
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList();
        if (normalized.isEmpty()) {
            return;
        }

        Set<Long> existing = fileRepository.findAllById(normalized).stream()
                .map(FileRecord::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<Long> missing = normalized.stream()
                .filter(fileId -> !existing.contains(fileId))
                .toList();
        if (!missing.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    fieldName + " contains missing fileId(s): " + missing);
        }
    }
}
