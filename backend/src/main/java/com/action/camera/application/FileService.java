package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.FileRecord;
import com.action.camera.dto.FileUploadResponse;
import com.action.camera.infrastructure.storage.FileStorage;
import com.action.camera.repository.FileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class FileService {

    private final FileStorage fileStorage;
    private final FileRepository fileRepository;

    public FileService(FileStorage fileStorage, FileRepository fileRepository) {
        this.fileStorage = fileStorage;
        this.fileRepository = fileRepository;
    }

    /**
     * 上传文件：物理存储 → 写 files 元数据表 → 返回 fileId
     * D 调用此方法后，用返回的 fileId 写 delivery_files 关联表
     *
     * @param file       上传的文件
     * @param uploaderId 上传者 userId（从 UserContext 取）
     * @param bizType    业务类型：DELIVERY / AVATAR / PORTFOLIO 等
     * @param visibility PUBLIC 或 PRIVATE
     */
    @Transactional
    public FileUploadResponse upload(MultipartFile file, Long uploaderId,
                                     String bizType, String visibility) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "文件不能为空");
        }

        // 1. 物理存储，拿到 fileKey
        String fileKey = fileStorage.store(file);

        // 2. 写 files 元数据表
        FileRecord record = new FileRecord();
        record.setUploaderId(uploaderId);
        record.setFileKey(fileKey);
        record.setOriginalName(
                file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown");
        record.setMimeType(
                file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        record.setFileSize(file.getSize());
        record.setBizType(bizType);
        record.setVisibility(visibility);
        // url 留 null（本地存储无公开 URL，通过 GET /files/{fileId}/download 访问）

        FileRecord saved = fileRepository.save(record);
        return new FileUploadResponse(saved.getId(), saved.getOriginalName());
    }

    /** 根据 fileId 查元数据（下载端点用） */
    public FileRecord getById(Long fileId) {
        return fileRepository.findById(fileId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "文件不存在"));
    }
}