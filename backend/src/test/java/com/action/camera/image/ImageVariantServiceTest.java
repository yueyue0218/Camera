package com.action.camera.image;

import com.action.camera.domain.FileRecord;
import com.action.camera.infrastructure.storage.FileStorage;
import com.action.camera.infrastructure.storage.LocalFileStorage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImageVariantServiceTest {

    @Mock
    private FileStorage fileStorage;

    @Mock
    private ImageVariantRenderer renderer;

    @TempDir
    Path storageRoot;

    @Test
    void secondRequestReusesDerivativeWithoutRenderingAgain() throws Exception {
        byte[] renderedBytes = "rendered-webp".getBytes();
        RenderedImageVariant rendered = new RenderedImageVariant(
                renderedBytes, "image/webp", "webp", 640, 427);
        StoredImageVariant stored = new StoredImageVariant(
                new ByteArrayResource(renderedBytes), "image/webp");
        when(fileStorage.loadVariant(42L, ImageVariant.THUMBNAIL))
                .thenReturn(Optional.empty(), Optional.empty(), Optional.of(stored));
        when(fileStorage.load("original.png"))
                .thenReturn(new ByteArrayResource("source".getBytes()));
        when(renderer.render(any(InputStream.class), eq(ImageVariant.THUMBNAIL)))
                .thenReturn(rendered);
        when(fileStorage.storeVariantAtomically(42L, ImageVariant.THUMBNAIL, rendered))
                .thenReturn(stored);
        ImageVariantService service = new ImageVariantService(fileStorage, renderer);

        ImageBinary first = service.load(record(), ImageVariant.THUMBNAIL);
        ImageBinary second = service.load(record(), ImageVariant.THUMBNAIL);

        assertThat(first.contentType()).isEqualTo("image/webp");
        assertThat(second.contentType()).isEqualTo("image/webp");
        assertThat(readAll(first.resource())).isEqualTo(renderedBytes);
        verify(renderer, times(1)).render(any(InputStream.class), eq(ImageVariant.THUMBNAIL));
    }

    @Test
    void originalReturnsOriginalBytesAndMimeWithoutRendering() throws Exception {
        byte[] original = png(2, 2);
        when(fileStorage.load("original.png")).thenReturn(new ByteArrayResource(original));
        ImageVariantService service = new ImageVariantService(fileStorage, renderer);

        ImageBinary binary = service.load(record(), ImageVariant.ORIGINAL);

        assertThat(binary.contentType()).isEqualTo("image/png");
        assertThat(readAll(binary.resource())).isEqualTo(original);
        verify(renderer, never()).render(any(), any());
        verify(fileStorage, never()).loadVariant(any(), any());
    }

    @Test
    void originalUsesDetectedRasterMimeInsteadOfStoredMime() throws Exception {
        byte[] actualPng = png(4, 3);
        FileRecord mismatched = record();
        mismatched.setMimeType("image/jpeg");
        when(fileStorage.load("original.png")).thenReturn(new ByteArrayResource(actualPng));
        ImageVariantService service = new ImageVariantService(
                fileStorage,
                renderer,
                new RasterImageInspector(16_384, 16_384, 64_000_000L));

        ImageBinary binary = service.load(mismatched, ImageVariant.ORIGINAL);

        assertThat(binary.contentType()).isEqualTo("image/png");
        assertThat(readAll(binary.resource())).isEqualTo(actualPng);
    }

    @Test
    void originalRejectsSvgEvenWhenStoredMimeClaimsRasterImage() {
        FileRecord disguisedSvg = record();
        disguisedSvg.setMimeType("image/jpeg");
        when(fileStorage.load("original.png"))
                .thenReturn(new ByteArrayResource("<svg><script/></svg>".getBytes()));
        ImageVariantService service = new ImageVariantService(
                fileStorage,
                renderer,
                new RasterImageInspector(16_384, 16_384, 64_000_000L));

        assertThatThrownBy(() -> service.load(disguisedSvg, ImageVariant.ORIGINAL))
                .isInstanceOf(UnsupportedImageFileException.class);
    }

    @Test
    void derivativeRejectsUnknownBytesAsUnsupportedMedia() {
        when(fileStorage.load("original.png"))
                .thenReturn(new ByteArrayResource("%PDF-not-an-image".getBytes()));
        ImageVariantService service = new ImageVariantService(
                fileStorage,
                new ImageVariantRenderer(new ImageIoWebpEncoder()),
                new RasterImageInspector(16_384, 16_384, 64_000_000L));

        assertThatThrownBy(() -> service.load(record(), ImageVariant.THUMBNAIL))
                .isInstanceOf(UnsupportedImageFileException.class);
    }

    @Test
    void concurrentFirstRequestsSeeOnlyCompleteDerivativeAndRenderOnce() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(storageRoot.toString());
        String fileKey = storage.store(new MockMultipartFile(
                "file", "source.png", "image/png", "source".getBytes()));
        FileRecord record = record();
        record.setFileKey(fileKey);
        byte[] complete = "complete-derivative".getBytes();
        RenderedImageVariant rendered = new RenderedImageVariant(
                complete, "image/png", "png", 100, 80);
        ImageVariantRenderer concurrentRenderer = mock(ImageVariantRenderer.class);
        CountDownLatch renderingStarted = new CountDownLatch(1);
        CountDownLatch allowCompletion = new CountDownLatch(1);
        when(concurrentRenderer.render(any(InputStream.class), eq(ImageVariant.THUMBNAIL)))
                .thenAnswer(invocation -> {
                    renderingStarted.countDown();
                    assertThat(allowCompletion.await(5, TimeUnit.SECONDS)).isTrue();
                    return rendered;
                });
        ImageVariantService service = new ImageVariantService(storage, concurrentRenderer);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ImageBinary> first = executor.submit(
                    () -> service.load(record, ImageVariant.THUMBNAIL));
            assertThat(renderingStarted.await(5, TimeUnit.SECONDS)).isTrue();
            Future<ImageBinary> second = executor.submit(
                    () -> service.load(record, ImageVariant.THUMBNAIL));
            allowCompletion.countDown();

            assertThat(readAll(first.get(5, TimeUnit.SECONDS).resource()))
                    .isEqualTo(complete);
            assertThat(readAll(second.get(5, TimeUnit.SECONDS).resource()))
                    .isEqualTo(complete);
        } finally {
            executor.shutdownNow();
        }

        verify(concurrentRenderer, times(1))
                .render(any(InputStream.class), eq(ImageVariant.THUMBNAIL));
        Path derivativeDirectory = storageRoot.resolve("derived/42");
        try (var files = Files.list(derivativeDirectory)) {
            assertThat(files).noneMatch(path -> path.getFileName().toString().endsWith(".tmp"));
        }
    }

    @Test
    void persistedJpegVariantsHaveFrozenBoundsAndSecondRequestKeepsTimestamp() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(storageRoot.toString());
        String fileKey = storage.store(new MockMultipartFile(
                "file", "source.jpg", "image/jpeg", jpeg(2400, 1800)));
        FileRecord record = record();
        record.setFileKey(fileKey);
        record.setMimeType("image/jpeg");
        ImageVariantService service = new ImageVariantService(
                storage, new ImageVariantRenderer(new ImageIoWebpEncoder()));

        ImageBinary thumbnail = service.load(record, ImageVariant.THUMBNAIL);
        StoredImageVariant stored = storage.loadVariant(
                record.getId(), ImageVariant.THUMBNAIL).orElseThrow();
        Path thumbnailPath = stored.resource().getFile().toPath();
        FileTime evidenceTimestamp = FileTime.fromMillis(1_700_000_000_000L);
        Files.setLastModifiedTime(thumbnailPath, evidenceTimestamp);

        ImageBinary repeatedThumbnail = service.load(record, ImageVariant.THUMBNAIL);
        ImageBinary medium = service.load(record, ImageVariant.MEDIUM);

        assertThat(thumbnail.contentType()).isEqualTo("image/webp");
        assertThat(repeatedThumbnail.contentType()).isEqualTo("image/webp");
        assertThat(medium.contentType()).isEqualTo("image/webp");
        assertDimensions(thumbnail, 640, 480);
        assertDimensions(medium, 1600, 1200);
        assertThat(Files.getLastModifiedTime(thumbnailPath)).isEqualTo(evidenceTimestamp);
        assertThat(storage.loadVariant(record.getId(), ImageVariant.THUMBNAIL)
                .orElseThrow().resource().getFile().toPath()).isEqualTo(thumbnailPath);
    }

    private FileRecord record() {
        FileRecord record = new FileRecord();
        record.setId(42L);
        record.setFileKey("original.png");
        record.setOriginalName("original.png");
        record.setMimeType("image/png");
        record.setFileSize(100L);
        record.setBizType("DEMAND_REFERENCE");
        record.setVisibility("PUBLIC");
        return record;
    }

    private static byte[] readAll(Resource resource) throws Exception {
        try (InputStream input = resource.getInputStream()) {
            return input.readAllBytes();
        }
    }

    private static void assertDimensions(ImageBinary binary, int width, int height) throws Exception {
        try (InputStream input = binary.resource().getInputStream()) {
            BufferedImage image = ImageIO.read(input);
            assertThat(image).isNotNull();
            assertThat(image.getWidth()).isEqualTo(width);
            assertThat(image.getHeight()).isEqualTo(height);
        }
    }

    private static byte[] jpeg(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(new Color(40, 120, 200));
            graphics.fillRect(0, 0, width, height);
        } finally {
            graphics.dispose();
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(image, "jpeg", output)).isTrue();
        return output.toByteArray();
    }

    private static byte[] png(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(image, "png", output)).isTrue();
        return output.toByteArray();
    }
}
