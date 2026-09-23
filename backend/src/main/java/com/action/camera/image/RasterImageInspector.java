package com.action.camera.image;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.Locale;
import java.util.Optional;

@Component
public class RasterImageInspector {

    private final int maxWidth;
    private final int maxHeight;
    private final long maxPixels;

    public RasterImageInspector(
            @Value("${camera.files.image.max-width:16384}") int maxWidth,
            @Value("${camera.files.image.max-height:16384}") int maxHeight,
            @Value("${camera.files.image.max-pixels:64000000}") long maxPixels) {
        if (maxWidth <= 0 || maxHeight <= 0 || maxPixels <= 0) {
            throw new IllegalArgumentException("图片尺寸限制必须为正数");
        }
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
        this.maxPixels = maxPixels;
    }

    public RasterImageInfo inspect(InputStream input) {
        try (ImageInputStream imageInput = imageInput(input)) {
            ImageReader reader = requiredReader(imageInput);
            try {
                return inspect(reader, imageInput);
            } finally {
                reader.dispose();
            }
        } catch (BusinessException error) {
            throw error;
        } catch (IOException error) {
            throw new UnsupportedImageFileException("无法识别图片格式");
        }
    }

    public Optional<RasterImageInfo> inspectIfSupported(InputStream input) {
        try (ImageInputStream imageInput = imageInput(input)) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) {
                return Optional.empty();
            }
            ImageReader reader = readers.next();
            try {
                return Optional.of(inspect(reader, imageInput));
            } finally {
                reader.dispose();
            }
        } catch (BusinessException error) {
            throw error;
        } catch (IOException error) {
            throw new UnsupportedImageFileException("无法识别图片格式");
        }
    }

    public BufferedImage decode(InputStream input, int targetLongEdge) {
        if (targetLongEdge <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "图片目标尺寸必须为正数");
        }
        try (ImageInputStream imageInput = imageInput(input)) {
            ImageReader reader = requiredReader(imageInput);
            try {
                RasterImageInfo info = inspect(reader, imageInput);
                ImageReadParam parameters = reader.getDefaultReadParam();
                int subsampling = sourceSubsampling(info.width(), info.height(), targetLongEdge);
                if (subsampling > 1) {
                    parameters.setSourceSubsampling(subsampling, subsampling, 0, 0);
                }
                BufferedImage image = reader.read(0, parameters);
                if (image == null) {
                    throw decodeFailure();
                }
                return image;
            } finally {
                reader.dispose();
            }
        } catch (BusinessException error) {
            throw error;
        } catch (IOException | RuntimeException error) {
            throw decodeFailure();
        }
    }

    private RasterImageInfo inspect(ImageReader reader, ImageInputStream imageInput) throws IOException {
        reader.setInput(imageInput, true, true);
        String contentType = contentType(reader.getFormatName());
        int width = reader.getWidth(0);
        int height = reader.getHeight(0);
        validateDimensions(width, height);
        return new RasterImageInfo(width, height, contentType);
    }

    private ImageInputStream imageInput(InputStream input) throws IOException {
        if (input == null) {
            throw new IOException("missing input");
        }
        ImageInputStream imageInput = ImageIO.createImageInputStream(input);
        if (imageInput == null) {
            throw new IOException("unable to create image input");
        }
        return imageInput;
    }

    private ImageReader requiredReader(ImageInputStream imageInput) {
        Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
        if (readers.hasNext()) {
            return readers.next();
        }
        throw new UnsupportedImageFileException("无法识别图片格式");
    }

    private String contentType(String formatName) {
        String normalized = formatName == null
                ? ""
                : formatName.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "jpeg", "jpg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            default -> throw new UnsupportedImageFileException("不支持的图片格式");
        };
    }

    private void validateDimensions(int width, int height) {
        long pixels = (long) width * height;
        if (width <= 0 || height <= 0
                || width > maxWidth
                || height > maxHeight
                || pixels > maxPixels) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "图片像素尺寸超出限制");
        }
    }

    private int sourceSubsampling(int width, int height, int targetLongEdge) {
        int longEdge = Math.max(width, height);
        return Math.max(1, longEdge / targetLongEdge);
    }

    private BusinessException decodeFailure() {
        return new BusinessException(ErrorCode.INTERNAL_ERROR, "图片解码失败");
    }
}
