package com.action.camera.image;

import org.springframework.core.io.Resource;

public record ImageBinary(Resource resource, String contentType) {
}
