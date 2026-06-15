package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.FileRecord;
import com.action.camera.dto.FileUploadResponse;
import com.action.camera.infrastructure.storage.FileStorage;
import com.action.camera.repository.FileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class FileService {

    public static final int MAX_IMAGE_COUNT = 9;
    private static final long DEFAULT_MAX_IMAGE_SIZE_BYTES = 10L * 1024L * 1024L;
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
    );
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".gif"
    );

    private final FileStorage fileStorage;
    private final FileRepository fileRepository;

    @Value("${camera.files.image.max-size-bytes:10485760}")
    private long maxImageSizeBytes = DEFAULT_MAX_IMAGE_SIZE_BYTES;

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

    @Transactional
    public List<FileUploadResponse> uploadImages(List<MultipartFile> files, Long uploaderId,
                                                 String bizType, String visibility) {
        validateImageBatch(files);
        List<String> storedFileKeys = new ArrayList<>();
        List<FileUploadResponse> responses = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
                String fileKey = fileStorage.store(file);
                storedFileKeys.add(fileKey);
                FileRecord saved = fileRepository.save(toRecord(file, uploaderId, bizType, visibility, fileKey));
                responses.add(new FileUploadResponse(saved.getId(), saved.getOriginalName()));
            }
            return responses;
        } catch (RuntimeException ex) {
            // The database transaction rolls back automatically; remove files already written in this batch.
            storedFileKeys.forEach(this::deleteQuietly);
            throw ex;
        }
    }

    /** 根据 fileId 查元数据（下载端点用） */
    public FileRecord getById(Long fileId) {
        return fileRepository.findById(fileId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "文件不存在"));
    }

    private void validateImageBatch(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请选择要上传的图片");
        }
        if (files.size() > MAX_IMAGE_COUNT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "最多只能上传 9 张图片");
        }
        for (int i = 0; i < files.size(); i++) {
            validateImage(files.get(i), i + 1);
        }
    }

    private void validateImage(MultipartFile file, int index) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "第 " + index + " 张图片不能为空");
        }
        String contentType = normalize(file.getContentType());
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "第 " + index + " 张不是支持的图片格式");
        }
        String extension = extension(file.getOriginalFilename());
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "第 " + index + " 张不是支持的图片格式");
        }
        if (file.getSize() > maxImageSizeBytes) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "第 " + index + " 张图片过大，单张不能超过 " + maxImageSizeMb() + "MB");
        }
    }

    private FileRecord toRecord(MultipartFile file, Long uploaderId, String bizType, String visibility, String fileKey) {
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
        return record;
    }

    private void deleteQuietly(String fileKey) {
        try {
            fileStorage.delete(fileKey);
        } catch (RuntimeException ignored) {
            // Best-effort cleanup; the user still receives the upload failure and no success is reported.
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String extension(String filename) {
        if (filename == null) {
            return "";
        }
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex < 0 ? "" : filename.substring(dotIndex).toLowerCase(Locale.ROOT);
    }

    private long maxImageSizeMb() {
        return Math.max(1L, maxImageSizeBytes / 1024L / 1024L);
    }
}
