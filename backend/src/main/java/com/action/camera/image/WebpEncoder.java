package com.action.camera.image;

import java.awt.image.BufferedImage;
import java.io.IOException;

@FunctionalInterface
public interface WebpEncoder {

    byte[] encode(BufferedImage image, float quality) throws IOException;
}
