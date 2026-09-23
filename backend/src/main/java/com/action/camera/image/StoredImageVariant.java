package com.action.camera.image;

import org.springframework.core.io.Resource;

public record StoredImageVariant(Resource resource, String contentType) {
}
