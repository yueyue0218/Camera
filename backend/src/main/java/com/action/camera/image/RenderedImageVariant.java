package com.action.camera.image;

public record RenderedImageVariant(
        byte[] bytes,
        String contentType,
        String extension,
        int width,
        int height) {
}
