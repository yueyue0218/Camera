package com.action.camera.controller;

import com.action.camera.application.FileService;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.domain.FileRecord;
import com.action.camera.dto.FileUploadResponse;
import com.action.camera.infrastructure.storage.FileStorage;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/files")
public class FileController {

    private final FileService fileService;
    private final FileStorage fileStorage;

    public FileController(FileService fileService, FileStorage fileStorage) {
        this.fileService = fileService;
        this.fileStorage = fileStorage;
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

    /** 下载文件（需登录，用 fileId） */
    @GetMapping("/{fileId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long fileId) {
        FileRecord record = fileService.getById(fileId);
        Resource resource = fileStorage.load(record.getFileKey());

        String contentType = record.getMimeType() != null
                ? record.getMimeType() : "application/octet-stream";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + record.getOriginalName() + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }
}