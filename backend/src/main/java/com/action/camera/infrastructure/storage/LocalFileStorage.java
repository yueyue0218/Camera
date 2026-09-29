package com.action.camera.infrastructure.storage;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.image.ImageVariant;
import com.action.camera.image.RenderedImageVariant;
import com.action.camera.image.StoredImageVariant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 本地硬盘存储实现。文件按日期分目录，文件名用 UUID 避免冲突。
 */
@Component
public class LocalFileStorage implements FileStorage {

    private static final List<String> DERIVATIVE_EXTENSIONS = List.of("webp", "png", "jpg");

    private final Path basePath;

    public LocalFileStorage(@Value("${file.storage.local-path}") String basePath) {
        this.basePath = Paths.get(basePath).toAbsolutePath().normalize();
    }

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
            Path target = resolveUnderBase(fileKey);
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
            Path file = resolveUnderBase(fileKey);
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
            Files.deleteIfExists(resolveUnderBase(fileKey));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "文件删除失败");
        }
    }

    @Override
    public Optional<StoredImageVariant> loadVariant(Long fileId, ImageVariant variant) {
        requireDerivativeArguments(fileId, variant);
        if (variant == ImageVariant.ORIGINAL) {
            return Optional.empty();
        }
        for (String extension : DERIVATIVE_EXTENSIONS) {
            Path path = derivativePath(fileId, variant, extension);
            if (Files.isRegularFile(path) && Files.isReadable(path)) {
                return Optional.of(new StoredImageVariant(
                        resource(path), contentType(extension)));
            }
        }
        return Optional.empty();
    }

    @Override
    public StoredImageVariant storeVariantAtomically(
            Long fileId, ImageVariant variant, RenderedImageVariant rendered) {
        requireDerivativeArguments(fileId, variant);
        if (variant == ImageVariant.ORIGINAL) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "original 不生成派生文件");
        }
        if (rendered == null || rendered.bytes() == null || rendered.bytes().length == 0) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "派生图片为空");
        }
        String extension = rendered.extension();
        if (!DERIVATIVE_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "不支持的派生图片扩展名");
        }

        Path target = derivativePath(fileId, variant, extension);
        Path temporary = null;
        try {
            Files.createDirectories(target.getParent());
            temporary = Files.createTempFile(
                    target.getParent(), variant.pathValue() + "-", ".tmp");
            Files.write(temporary, rendered.bytes());
            movePublished(temporary, target);
            return new StoredImageVariant(resource(target), rendered.contentType());
        } catch (IOException error) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "派生图片保存失败");
        } finally {
            if (temporary != null) {
                try {
                    Files.deleteIfExists(temporary);
                } catch (IOException ignored) {
                    // Best-effort cleanup; only the deterministic completed file is discoverable.
                }
            }
        }
    }

    private void movePublished(Path temporary, Path target) throws IOException {
        try {
            Files.move(
                    temporary,
                    target,
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException unsupported) {
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private Path derivativePath(Long fileId, ImageVariant variant, String extension) {
        return resolveUnderBase(
                "derived/" + fileId + "/" + variant.pathValue() + "." + extension);
    }

    private void requireDerivativeArguments(Long fileId, ImageVariant variant) {
        if (fileId == null || fileId <= 0 || variant == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "非法图片派生参数");
        }
    }

    private Resource resource(Path path) {
        try {
            return new UrlResource(path.toUri());
        } catch (MalformedURLException error) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "文件读取失败");
        }
    }

    private String contentType(String extension) {
        return switch (extension) {
            case "webp" -> "image/webp";
            case "png" -> "image/png";
            case "jpg" -> "image/jpeg";
            default -> throw new BusinessException(ErrorCode.INTERNAL_ERROR, "未知派生图片格式");
        };
    }

    private Path resolveUnderBase(String relativePath) {
        Path resolved = basePath.resolve(relativePath).normalize();
        if (!resolved.startsWith(basePath)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "非法文件路径");
        }
        return resolved;
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
}
