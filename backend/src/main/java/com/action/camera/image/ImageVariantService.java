package com.action.camera.image;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.FileRecord;
import com.action.camera.infrastructure.storage.FileStorage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class ImageVariantService {

    private final FileStorage fileStorage;
    private final ImageVariantRenderer renderer;
    private final RasterImageInspector rasterImageInspector;
    private final ConcurrentHashMap<VariantKey, ReentrantLock> generationLocks =
            new ConcurrentHashMap<>();

    @Autowired
    public ImageVariantService(
            FileStorage fileStorage,
            ImageVariantRenderer renderer,
            RasterImageInspector rasterImageInspector) {
        this.fileStorage = fileStorage;
        this.renderer = renderer;
        this.rasterImageInspector = rasterImageInspector;
    }

    ImageVariantService(FileStorage fileStorage, ImageVariantRenderer renderer) {
        this(fileStorage, renderer,
                new RasterImageInspector(16_384, 16_384, 64_000_000L));
    }

    public ImageBinary load(FileRecord record, ImageVariant variant) {
        requireImage(record);
        if (variant == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "图片版本不能为空");
        }
        if (variant == ImageVariant.ORIGINAL) {
            return loadOriginal(record);
        }
        return fileStorage.loadVariant(record.getId(), variant)
                .map(this::toBinary)
                .orElseGet(() -> generateUnderLock(record, variant));
    }

    private ImageBinary generateUnderLock(FileRecord record, ImageVariant variant) {
        VariantKey key = new VariantKey(record.getId(), variant);
        ReentrantLock lock = generationLocks.computeIfAbsent(key, ignored -> new ReentrantLock());
        lock.lock();
        try {
            return fileStorage.loadVariant(record.getId(), variant)
                    .map(this::toBinary)
                    .orElseGet(() -> renderAndStore(record, variant));
        } finally {
            lock.unlock();
            generationLocks.remove(key, lock);
        }
    }

    private ImageBinary renderAndStore(FileRecord record, ImageVariant variant) {
        Resource original = fileStorage.load(record.getFileKey());
        try (InputStream input = original.getInputStream()) {
            RenderedImageVariant rendered = renderer.render(input, variant);
            return toBinary(fileStorage.storeVariantAtomically(
                    record.getId(), variant, rendered));
        } catch (BusinessException error) {
            throw error;
        } catch (IOException error) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "图片生成失败");
        }
    }

    private ImageBinary toBinary(StoredImageVariant stored) {
        return new ImageBinary(stored.resource(), stored.contentType());
    }

    private ImageBinary loadOriginal(FileRecord record) {
        Resource original = fileStorage.load(record.getFileKey());
        try (InputStream input = original.getInputStream()) {
            RasterImageInfo info = rasterImageInspector.inspect(input);
            return new ImageBinary(original, info.contentType());
        } catch (BusinessException error) {
            throw error;
        } catch (IOException error) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "图片读取失败");
        }
    }

    private void requireImage(FileRecord record) {
        if (record == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "文件不存在");
        }
    }

    private record VariantKey(Long fileId, ImageVariant variant) {
    }
}
