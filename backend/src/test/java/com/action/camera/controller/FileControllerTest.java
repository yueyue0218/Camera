package com.action.camera.controller;

import com.action.camera.application.FileService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.FileRecord;
import com.action.camera.image.ImageBinary;
import com.action.camera.image.ImageVariant;
import com.action.camera.image.ImageIoWebpEncoder;
import com.action.camera.image.ImageVariantRenderer;
import com.action.camera.image.ImageVariantService;
import com.action.camera.image.RasterImageInspector;
import com.action.camera.image.UnsupportedImageFileException;
import com.action.camera.infrastructure.storage.FileStorage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FileControllerTest {

    @Mock
    private FileService fileService;
    @Mock
    private FileStorage fileStorage;
    @Mock
    private ImageVariantService imageVariantService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        FileController controller = new FileController(
                fileService, fileStorage, imageVariantService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new FileEndpointExceptionHandler())
                .build();
    }

    @Test
    void thumbnailReturnsInlineImageWithTruthfulMime() throws Exception {
        FileRecord record = imageRecord();
        when(fileService.getForDownload(eq(42L), any(), any())).thenReturn(record);
        when(imageVariantService.load(record, ImageVariant.THUMBNAIL))
                .thenReturn(new ImageBinary(
                        new ByteArrayResource("webp".getBytes()), "image/webp"));

        mockMvc.perform(get("/files/42/thumbnail"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "inline"))
                .andExpect(content().contentType("image/webp"))
                .andExpect(content().bytes("webp".getBytes()));
    }

    @Test
    void originalReturnsOriginalBytesInline() throws Exception {
        FileRecord record = imageRecord();
        when(fileService.getForDownload(eq(42L), any(), any())).thenReturn(record);
        when(imageVariantService.load(record, ImageVariant.ORIGINAL))
                .thenReturn(new ImageBinary(
                        new ByteArrayResource("original".getBytes()), "image/png"));

        mockMvc.perform(get("/files/42/original"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "inline"))
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes("original".getBytes()));
    }

    @Test
    void missingFileRecordReturnsReal404Json() throws Exception {
        when(fileService.getForDownload(eq(404L), any(), any()))
                .thenThrow(new BusinessException(ErrorCode.NOT_FOUND, "文件不存在"));

        assertJsonError("/files/404/thumbnail", 404, 40401);
    }

    @Test
    void missingPhysicalOriginalReturnsReal404Json() throws Exception {
        FileRecord record = imageRecord();
        when(fileService.getForDownload(eq(42L), any(), any())).thenReturn(record);
        when(imageVariantService.load(record, ImageVariant.MEDIUM))
                .thenThrow(new BusinessException(ErrorCode.NOT_FOUND, "文件不存在"));

        assertJsonError("/files/42/medium", 404, 40401);
    }

    @Test
    void invalidVariantAndInvalidFileIdReturn400Json() throws Exception {
        assertJsonError("/files/42/huge", 400, 40001);
        assertJsonError("/files/not-a-number/thumbnail", 400, 40001);
    }

    @Test
    void existingAuthorizationFailuresKeep401And403() throws Exception {
        when(fileService.getForDownload(eq(41L), any(), any()))
                .thenThrow(new BusinessException(ErrorCode.UNAUTHORIZED, "需要登录"));
        when(fileService.getForDownload(eq(43L), any(), any()))
                .thenThrow(new BusinessException(ErrorCode.FORBIDDEN, "无权访问"));

        assertJsonError("/files/41/thumbnail", 401, 40101);
        assertJsonError("/files/43/thumbnail", 403, 40301);
    }

    @Test
    void nonImageVariantRequestReturns415Json() throws Exception {
        FileRecord record = imageRecord();
        record.setMimeType("application/pdf");
        when(fileService.getForDownload(eq(42L), any(), any())).thenReturn(record);
        when(imageVariantService.load(record, ImageVariant.THUMBNAIL))
                .thenThrow(new UnsupportedImageFileException("该文件不是图片"));

        assertJsonError("/files/42/thumbnail", 415, 40001);
    }

    @Test
    void realVariantServiceMapsUnknownImageBytesTo415Json() throws Exception {
        FileRecord record = imageRecord();
        when(fileService.getForDownload(eq(42L), any(), any())).thenReturn(record);
        when(fileStorage.load("original.png"))
                .thenReturn(new ByteArrayResource("%PDF-not-an-image".getBytes()));
        ImageVariantService realService = new ImageVariantService(
                fileStorage,
                new ImageVariantRenderer(
                        new ImageIoWebpEncoder(),
                        new RasterImageInspector(16_384, 16_384, 64_000_000L)),
                new RasterImageInspector(16_384, 16_384, 64_000_000L));
        FileController controller = new FileController(fileService, fileStorage, realService);
        MockMvc realMockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new FileEndpointExceptionHandler())
                .build();

        realMockMvc.perform(get("/files/42/thumbnail"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void generationFailureReturns500Json() throws Exception {
        FileRecord record = imageRecord();
        when(fileService.getForDownload(eq(42L), any(), any())).thenReturn(record);
        when(imageVariantService.load(record, ImageVariant.THUMBNAIL))
                .thenThrow(new BusinessException(ErrorCode.INTERNAL_ERROR, "图片生成失败"));

        assertJsonError("/files/42/thumbnail", 500, 50001);
    }

    @Test
    void legacyDownloadRetainsAttachmentSemantics() throws Exception {
        FileRecord record = imageRecord();
        when(fileService.getForDownload(eq(42L), any(), any())).thenReturn(record);
        when(fileStorage.load("original.png"))
                .thenReturn(new ByteArrayResource("original".getBytes()));

        mockMvc.perform(get("/files/42/download"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"original.png\""))
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes("original".getBytes()));
    }

    private void assertJsonError(String path, int statusCode, int businessCode) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().is(statusCode))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(businessCode));
    }

    private FileRecord imageRecord() {
        FileRecord record = new FileRecord();
        record.setId(42L);
        record.setFileKey("original.png");
        record.setOriginalName("original.png");
        record.setMimeType("image/png");
        record.setFileSize(100L);
        record.setUploaderId(9L);
        record.setBizType("DEMAND_REFERENCE");
        record.setVisibility("PUBLIC");
        return record;
    }
}
