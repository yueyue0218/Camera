package com.action.camera.controller;

import com.action.camera.application.FileService;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.domain.FileRecord;
import com.action.camera.dto.FileUploadResponse;
import com.action.camera.image.ImageBinary;
import com.action.camera.image.ImageVariant;
import com.action.camera.image.ImageVariantService;
import com.action.camera.infrastructure.storage.FileStorage;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.io.OutputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

@RestController
@RequestMapping("/files")
public class FileController {

    private static final String PUBLIC_IMMUTABLE_CACHE =
            "public, max-age=31536000, immutable";
    private static final String PRIVATE_NO_STORE_CACHE = "private, no-store";
    private static final String X_CONTENT_TYPE_OPTIONS = "X-Content-Type-Options";
    private static final String NOSNIFF = "nosniff";

    private final FileService fileService;
    private final FileStorage fileStorage;
    private final ImageVariantService imageVariantService;

    public FileController(
            FileService fileService,
            FileStorage fileStorage,
            ImageVariantService imageVariantService) {
        this.fileService = fileService;
        this.fileStorage = fileStorage;
        this.imageVariantService = imageVariantService;
    }

    /** 上传文件（需登录） */
    @PostMapping("/upload")
    public Result<FileUploadResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("bizType") String bizType,
            @RequestParam(value = "visibility", defaultValue = "PRIVATE") String visibility) {

        Long userId = UserContext.getUserId();
        FileUploadResponse response = fileService.upload(file, userId, bizType, visibility);
        return Result.success(response);
    }

    /** 批量上传图片（需登录，最多 9 张） */
    @PostMapping("/images/batch")
    public Result<List<FileUploadResponse>> uploadImagesBatch(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam("bizType") String bizType,
            @RequestParam(value = "visibility", defaultValue = "PRIVATE") String visibility) {

        Long userId = UserContext.getUserId();
        List<FileUploadResponse> response = fileService.uploadImages(files, userId, bizType, visibility);
        return Result.success(response);
    }

    /** 下载文件：公开文件允许匿名访问，私有文件按业务归属授权。 */
    @GetMapping("/{fileId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long fileId) {
        FileRecord record = fileService.getForDownload(
                fileId,
                UserContext.getUserId(),
                UserContext.getCurrentRole()
        );
        Resource resource = fileStorage.load(record.getFileKey());

        String contentType = record.getMimeType() != null
                ? record.getMimeType() : "application/octet-stream";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(record.getOriginalName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .header(HttpHeaders.CACHE_CONTROL, PRIVATE_NO_STORE_CACHE)
                .header(X_CONTENT_TYPE_OPTIONS, NOSNIFF)
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }

    /** 图片 representation：复用原 FileRecord 与访问策略，响应使用 inline。 */
    @GetMapping("/{fileId}/{variant}")
    public ResponseEntity<Resource> image(
            @PathVariable Long fileId,
            @PathVariable String variant) {
        ImageVariant parsed = ImageVariant.parse(variant);
        FileRecord record = fileService.getForDownload(
                fileId,
                UserContext.getUserId(),
                UserContext.getCurrentRole()
        );
        ImageBinary binary = imageVariantService.load(record, parsed);
        String cache = cacheControl(record, parsed);
        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header(HttpHeaders.CACHE_CONTROL, cache)
                .header(X_CONTENT_TYPE_OPTIONS, NOSNIFF)
                .contentType(MediaType.parseMediaType(binary.contentType()));
        // Spring evaluates If-None-Match only after this method has performed
        // the current download authorization and verified the representation.
        if (parsed == ImageVariant.THUMBNAIL && PUBLIC_IMMUTABLE_CACHE.equals(cache)) {
            response.eTag(thumbnailVersion(binary));
        }
        return response.body(binary.resource());
    }

    private String thumbnailVersion(ImageBinary binary) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(binary.contentType().getBytes(StandardCharsets.UTF_8));
            try (DigestInputStream input = new DigestInputStream(binary.resource().getInputStream(), digest)) {
                input.transferTo(OutputStream.nullOutputStream());
            }
            return '"' + HexFormat.of().formatHex(digest.digest()) + '"';
        } catch (IOException | NoSuchAlgorithmException error) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "图片读取失败");
        }
    }

    private String cacheControl(FileRecord record, ImageVariant variant) {
        if ((variant == ImageVariant.THUMBNAIL || variant == ImageVariant.MEDIUM)
                && fileService.isPubliclyCacheable(record)) {
            return PUBLIC_IMMUTABLE_CACHE;
        }
        return PRIVATE_NO_STORE_CACHE;
    }
}
