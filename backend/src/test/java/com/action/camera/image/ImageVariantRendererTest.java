package com.action.camera.image;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageVariantRendererTest {

    private final ImageVariantRenderer renderer = new ImageVariantRenderer(new ImageIoWebpEncoder());

    @Test
    void thumbnailBoundsLongEdgeAt640WithoutUpscaling() throws Exception {
        RenderedImageVariant large = renderer.render(
                new ByteArrayInputStream(png(1200, 800, false)), ImageVariant.THUMBNAIL);
        assertDimensions(large, 640, 427);

        RenderedImageVariant small = renderer.render(
                new ByteArrayInputStream(png(320, 200, false)), ImageVariant.THUMBNAIL);
        assertDimensions(small, 320, 200);
    }

    @Test
    void mediumBoundsLongEdgeAt1600WithoutUpscaling() throws Exception {
        RenderedImageVariant landscape = renderer.render(
                new ByteArrayInputStream(png(2400, 1800, false)), ImageVariant.MEDIUM);
        assertDimensions(landscape, 1600, 1200);

        RenderedImageVariant portrait = renderer.render(
                new ByteArrayInputStream(png(900, 1200, false)), ImageVariant.MEDIUM);
        assertDimensions(portrait, 900, 1200);
    }

    @Test
    void transparentInputRetainsAlpha() throws Exception {
        RenderedImageVariant result = renderer.render(
                new ByteArrayInputStream(png(900, 600, true)), ImageVariant.THUMBNAIL);

        BufferedImage decoded = decode(result);
        assertThat(decoded.getColorModel().hasAlpha()).isTrue();
        assertThat(new Color(decoded.getRGB(0, 0), true).getAlpha()).isZero();
    }

    @Test
    void webpFailureFallsBackToTruthfulPngForAlpha() throws Exception {
        ImageVariantRenderer failingWebp = new ImageVariantRenderer((image, quality) -> {
            throw new IOException("encoder unavailable");
        });

        RenderedImageVariant result = failingWebp.render(
                new ByteArrayInputStream(png(800, 600, true)), ImageVariant.THUMBNAIL);

        assertThat(result.contentType()).isEqualTo("image/png");
        assertThat(result.extension()).isEqualTo("png");
        assertThat(decode(result).getColorModel().hasAlpha()).isTrue();
    }

    @Test
    void webpFailureFallsBackToTruthfulJpegForOpaqueImage() throws Exception {
        ImageVariantRenderer failingWebp = new ImageVariantRenderer((image, quality) -> {
            throw new IOException("encoder unavailable");
        });

        RenderedImageVariant result = failingWebp.render(
                new ByteArrayInputStream(png(800, 600, false)), ImageVariant.THUMBNAIL);

        assertThat(result.contentType()).isEqualTo("image/jpeg");
        assertThat(result.extension()).isEqualTo("jpg");
        assertThat(decode(result).getColorModel().hasAlpha()).isFalse();
    }

    @Test
    void corruptInputIsRejectedAsImageProcessingFailure() {
        assertThatThrownBy(() -> renderer.render(
                new ByteArrayInputStream("not-an-image".getBytes()), ImageVariant.THUMBNAIL))
                .isInstanceOfSatisfying(BusinessException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(ErrorCode.INTERNAL_ERROR));
    }

    @Test
    void realWebpEncoderReturnsDecodableTruthfulWebp() throws Exception {
        RenderedImageVariant result = renderer.render(
                new ByteArrayInputStream(png(700, 500, false)), ImageVariant.THUMBNAIL);

        assertThat(result.contentType()).isEqualTo("image/webp");
        assertThat(result.extension()).isEqualTo("webp");
        assertDimensions(result, 640, 457);
    }

    private static void assertDimensions(RenderedImageVariant result, int width, int height) throws IOException {
        BufferedImage decoded = decode(result);
        assertThat(decoded).isNotNull();
        assertThat(decoded.getWidth()).isEqualTo(width);
        assertThat(decoded.getHeight()).isEqualTo(height);
        assertThat(result.width()).isEqualTo(width);
        assertThat(result.height()).isEqualTo(height);
    }

    private static BufferedImage decode(RenderedImageVariant result) throws IOException {
        return ImageIO.read(new ByteArrayInputStream(result.bytes()));
    }

    private static byte[] png(int width, int height, boolean alpha) throws IOException {
        BufferedImage image = new BufferedImage(
                width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            if (alpha) {
                graphics.setComposite(java.awt.AlphaComposite.Clear);
                graphics.fillRect(0, 0, width, height);
                graphics.setComposite(java.awt.AlphaComposite.SrcOver);
                graphics.setColor(new Color(210, 80, 120, 180));
                graphics.fillRect(width / 4, height / 4, width / 2, height / 2);
            } else {
                graphics.setColor(new Color(40, 120, 200));
                graphics.fillRect(0, 0, width, height);
            }
        } finally {
            graphics.dispose();
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(image, "png", output)).isTrue();
        return output.toByteArray();
    }
}
