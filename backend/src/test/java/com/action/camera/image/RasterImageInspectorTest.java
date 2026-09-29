package com.action.camera.image;

import com.action.camera.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RasterImageInspectorTest {

    private final RasterImageInspector inspector =
            new RasterImageInspector(16_384, 16_384, 64_000_000L);

    @Test
    void detectsRasterFormatAndDimensionsFromFileBytes() throws Exception {
        RasterImageInfo info = inspector.inspect(new ByteArrayInputStream(png(3, 2)));

        assertThat(info.contentType()).isEqualTo("image/png");
        assertThat(info.width()).isEqualTo(3);
        assertThat(info.height()).isEqualTo(2);
    }

    @Test
    void rejectsSvgEvenWhenCallerClaimsItIsAnImage() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>"
                .getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> inspector.inspect(new ByteArrayInputStream(svg)))
                .isInstanceOf(UnsupportedImageFileException.class);
    }

    @Test
    void rejectsOversizedPngFromHeaderBeforeAttemptingPixelDecode() throws Exception {
        byte[] headerOnly = pngHeader(10_000, 10_000);

        assertThatThrownBy(() -> inspector.decode(
                new ByteArrayInputStream(headerOnly), ImageVariant.THUMBNAIL.maxLongEdge()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("像素");
    }

    private byte[] png(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(image, "png", output)).isTrue();
        return output.toByteArray();
    }

    private byte[] pngHeader(int width, int height) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (DataOutputStream data = new DataOutputStream(output)) {
            data.write(new byte[]{(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10});
            byte[] type = "IHDR".getBytes(StandardCharsets.US_ASCII);
            ByteArrayOutputStream chunkData = new ByteArrayOutputStream();
            try (DataOutputStream chunk = new DataOutputStream(chunkData)) {
                chunk.writeInt(width);
                chunk.writeInt(height);
                chunk.writeByte(8);
                chunk.writeByte(2);
                chunk.writeByte(0);
                chunk.writeByte(0);
                chunk.writeByte(0);
            }
            byte[] payload = chunkData.toByteArray();
            CRC32 crc = new CRC32();
            crc.update(type);
            crc.update(payload);
            data.writeInt(payload.length);
            data.write(type);
            data.write(payload);
            data.writeInt((int) crc.getValue());
        }
        return output.toByteArray();
    }
}
