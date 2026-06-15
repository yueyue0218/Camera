package com.action.camera.application;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.FileRecord;
import com.action.camera.dto.FileUploadResponse;
import com.action.camera.infrastructure.storage.FileStorage;
import com.action.camera.repository.FileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileServiceTest {

    @Mock
    private FileStorage fileStorage;

    @Mock
    private FileRepository fileRepository;

    @Mock
    private FileAccessPolicy fileAccessPolicy;

    private FileService fileService;

    @BeforeEach
    void setUp() {
        fileService = new FileService(fileStorage, fileRepository, fileAccessPolicy);
        ReflectionTestUtils.setField(fileService, "maxImageSizeBytes", 10L * 1024L * 1024L);
    }

    @Test
    void batchImageUploadRejectsMoreThanNineFiles() {
        List<MultipartFile> files = java.util.stream.IntStream.rangeClosed(1, 10)
                .mapToObj(index -> (MultipartFile) image("image-" + index + ".jpg", "image/jpeg", "data-" + index))
                .toList();

        assertThatThrownBy(() -> fileService.uploadImages(files, 1001L, "DEMAND_REFERENCE", "PUBLIC"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("最多只能上传 9 张图片");

        verify(fileStorage, never()).store(any());
        verify(fileRepository, never()).save(any());
    }

    @Test
    void batchImageUploadRejectsNonImageFile() {
        MockMultipartFile textFile = image("notes.txt", "text/plain", "not image");

        assertThatThrownBy(() -> fileService.uploadImages(List.of(textFile), 1001L, "DEMAND_REFERENCE", "PUBLIC"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("不是支持的图片格式");

        verify(fileStorage, never()).store(any());
        verify(fileRepository, never()).save(any());
    }

    @Test
    void batchImageUploadRejectsOversizedImage() {
        ReflectionTestUtils.setField(fileService, "maxImageSizeBytes", 4L);
        MockMultipartFile largeImage = image("large.png", "image/png", "12345");

        assertThatThrownBy(() -> fileService.uploadImages(List.of(largeImage), 1001L, "DEMAND_REFERENCE", "PUBLIC"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("图片过大");

        verify(fileStorage, never()).store(any());
        verify(fileRepository, never()).save(any());
    }

    @Test
    void batchImageUploadStoresAllImagesWhenValid() {
        allowUploadPolicy("SERVICE_PORTFOLIO", "PUBLIC", "PUBLIC");
        AtomicLong ids = new AtomicLong(20L);
        when(fileStorage.store(any())).thenReturn("2026/06/15/a.jpg", "2026/06/15/b.webp");
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(invocation -> {
            FileRecord record = invocation.getArgument(0);
            record.setId(ids.incrementAndGet());
            return record;
        });

        List<FileUploadResponse> responses = fileService.uploadImages(List.of(
                image("a.jpg", "image/jpeg", "a"),
                image("b.webp", "image/webp", "b")
        ), 1001L, "SERVICE_PORTFOLIO", "PUBLIC");

        assertThat(responses).extracting(FileUploadResponse::getFileId).containsExactly(21L, 22L);
        verify(fileStorage, times(2)).store(any());
        verify(fileRepository, times(2)).save(any(FileRecord.class));
    }

    @Test
    void originalSingleFileUploadStillWorks() {
        allowUploadPolicy("CERTIFICATION", "PRIVATE", "PRIVATE");
        when(fileStorage.store(any())).thenReturn("2026/06/15/file.bin");
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(invocation -> {
            FileRecord record = invocation.getArgument(0);
            record.setId(31L);
            return record;
        });

        FileUploadResponse response = fileService.upload(
                new MockMultipartFile("file", "file.bin", "application/octet-stream", "data".getBytes()),
                1001L,
                "CERTIFICATION",
                "PRIVATE"
        );

        assertThat(response.getFileId()).isEqualTo(31L);
        assertThat(response.getOriginalName()).isEqualTo("file.bin");
    }

    @Test
    void deliveryUploadCannotBeMarkedPublicByRequestParameter() {
        allowUploadPolicy("DELIVERY", "PUBLIC", "PRIVATE");
        when(fileStorage.store(any())).thenReturn("2026/06/16/delivery.jpg");
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(invocation -> {
            FileRecord record = invocation.getArgument(0);
            record.setId(41L);
            return record;
        });
        ArgumentCaptor<FileRecord> recordCaptor = ArgumentCaptor.forClass(FileRecord.class);

        fileService.upload(image("delivery.jpg", "image/jpeg", "data"), 1001L, "DELIVERY", "PUBLIC");

        verify(fileRepository).save(recordCaptor.capture());
        assertThat(recordCaptor.getValue().getVisibility()).isEqualTo("PRIVATE");
    }

    private void allowUploadPolicy(String bizType, String requestedVisibility, String resolvedVisibility) {
        when(fileAccessPolicy.normalizeBizType(bizType)).thenReturn(bizType);
        when(fileAccessPolicy.resolveVisibility(bizType, requestedVisibility)).thenReturn(resolvedVisibility);
    }

    private MockMultipartFile image(String filename, String contentType, String content) {
        return new MockMultipartFile("files", filename, contentType, content.getBytes());
    }
}
