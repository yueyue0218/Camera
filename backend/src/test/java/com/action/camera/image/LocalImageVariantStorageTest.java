package com.action.camera.image;

import com.action.camera.infrastructure.storage.LocalFileStorage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class LocalImageVariantStorageTest {

    @TempDir
    Path storageRoot;

    @Test
    void storePublishesOnlyCompletedDerivativeAtDeterministicPath() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(storageRoot.toString());
        byte[] bytes = "complete-image".getBytes();
        RenderedImageVariant rendered = new RenderedImageVariant(
                bytes, "image/png", "png", 100, 80);

        StoredImageVariant stored = storage.storeVariantAtomically(
                42L, ImageVariant.THUMBNAIL, rendered);

        Path expected = storageRoot.resolve("derived/42/thumbnail.png");
        assertThat(stored.resource().exists()).isTrue();
        assertThat(stored.contentType()).isEqualTo("image/png");
        assertThat(expected).hasBinaryContent(bytes);
        try (Stream<Path> files = Files.list(expected.getParent())) {
            assertThat(files).noneMatch(path -> path.getFileName().toString().endsWith(".tmp"));
        }
    }

    @Test
    void loadVariantFindsCompletedRepresentationAndIgnoresTemporaryFiles() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(storageRoot.toString());
        Path directory = storageRoot.resolve("derived/7");
        Files.createDirectories(directory);
        Files.write(directory.resolve("medium.webp.tmp"), "partial".getBytes());
        byte[] complete = "complete".getBytes();
        Files.write(directory.resolve("medium.png"), complete);

        StoredImageVariant stored = storage.loadVariant(7L, ImageVariant.MEDIUM).orElseThrow();

        assertThat(stored.contentType()).isEqualTo("image/png");
        assertThat(readAll(stored.resource())).isEqualTo(complete);
    }

    private static byte[] readAll(Resource resource) throws IOException {
        try (InputStream input = resource.getInputStream()) {
            return input.readAllBytes();
        }
    }
}
