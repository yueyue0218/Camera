package com.action.camera.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "camera.cors")
public class CorsProperties {

    private List<String> allowedOriginPatterns = new ArrayList<>();

    public List<String> getAllowedOriginPatterns() {
        return List.copyOf(allowedOriginPatterns);
    }

    public void setAllowedOriginPatterns(List<String> allowedOriginPatterns) {
        this.allowedOriginPatterns = allowedOriginPatterns == null
                ? new ArrayList<>()
                : new ArrayList<>(allowedOriginPatterns);
    }
}
