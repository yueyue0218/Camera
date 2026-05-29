package com.action.camera.infrastructure.storage;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.UUID;

/**
 * 本地硬盘存储实现。文件按日期分目录，文件名用 UUID 避免冲突。
 */
@Component
public class LocalFileStorage implements FileStorage {

    @Value("${file.storage.local-path}")
    private String basePath;

    @Override
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "文件为空");
        }
        // 例如 2026/05/22/随机串.jpg
        String datePath = LocalDate.now().toString().replace("-", "/");
        String ext = getExtension(file.getOriginalFilename());
        String fileKey = datePath + "/" + UUID.randomUUID() + ext;
        try {
            Path target = Paths.get(basePath, fileKey);
            Files.createDirectories(target.getParent());
            file.transferTo(target.toAbsolutePath());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "文件保存失败: " + e.getMessage());
        }
        return fileKey;
    }

    @Override
    public Resource load(String fileKey) {
        try {
            Path base = Paths.get(basePath).toAbsolutePath().normalize();
            Path file = base.resolve(fileKey).normalize();
            if (!file.startsWith(base)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "非法文件路径");
            }
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "文件不存在");
            }
            return resource;
        } catch (MalformedURLException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "文件读取失败");
        }
    }

    @Override
    public void delete(String fileKey) {
        try {
            Files.deleteIfExists(Paths.get(basePath, fileKey));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "文件删除失败");
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
}