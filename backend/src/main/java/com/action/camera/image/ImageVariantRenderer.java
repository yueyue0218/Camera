package com.action.camera.image;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.AlphaComposite;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;

@Component
public class ImageVariantRenderer {

    private final WebpEncoder webpEncoder;

    public ImageVariantRenderer(WebpEncoder webpEncoder) {
        this.webpEncoder = webpEncoder;
    }

    public RenderedImageVariant render(InputStream input, ImageVariant variant) {
        BufferedImage source = readRequiredImage(input);
        BufferedImage resized = resizeWithoutUpscale(source, variant.maxLongEdge());
        try {
            byte[] webp = webpEncoder.encode(resized, variant.quality());
            return result(webp, "image/webp", "webp", resized);
        } catch (IOException | RuntimeException webpFailure) {
            return fallback(resized, variant.quality());
        }
    }

    private BufferedImage readRequiredImage(InputStream input) {
        try {
            BufferedImage image = ImageIO.read(input);
            if (image == null) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR, "图片解码失败");
            }
            return image;
        } catch (IOException error) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "图片解码失败");
        }
    }

    private BufferedImage resizeWithoutUpscale(BufferedImage source, int maxLongEdge) {
        int currentLongEdge = Math.max(source.getWidth(), source.getHeight());
        double scale = maxLongEdge <= 0
                ? 1.0
                : Math.min(1.0, (double) maxLongEdge / currentLongEdge);
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        boolean alpha = source.getColorModel().hasAlpha();
        BufferedImage target = new BufferedImage(
                width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setRenderingHint(
                    RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(
                    RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(
                    RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            if (alpha) {
                graphics.setComposite(AlphaComposite.Src);
            }
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private RenderedImageVariant fallback(BufferedImage image, float quality) {
        boolean alpha = image.getColorModel().hasAlpha();
        String format = alpha ? "png" : "jpeg";
        String contentType = alpha ? "image/png" : "image/jpeg";
        String extension = alpha ? "png" : "jpg";
        return result(writeBuiltIn(image, format, quality), contentType, extension, image);
    }

    private byte[] writeBuiltIn(BufferedImage image, String format, float quality) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if ("jpeg".equals(format)) {
                writeJpeg(image, quality, output);
            } else if (!ImageIO.write(image, format, output)) {
                throw new IOException("No ImageIO writer for " + format);
            }
            return output.toByteArray();
        } catch (IOException error) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "图片生成失败");
        }
    }

    private void writeJpeg(BufferedImage image, float quality, ByteArrayOutputStream output)
            throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new IOException("JPEG ImageIO writer is unavailable");
        }
        ImageWriter writer = writers.next();
        try (ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(imageOutput);
            ImageWriteParam parameter = writer.getDefaultWriteParam();
            parameter.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            parameter.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), parameter);
            imageOutput.flush();
        } finally {
            writer.dispose();
        }
    }

    private RenderedImageVariant result(
            byte[] bytes, String contentType, String extension, BufferedImage image) {
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "图片生成失败");
        }
        return new RenderedImageVariant(
                bytes, contentType, extension, image.getWidth(), image.getHeight());
    }
}
