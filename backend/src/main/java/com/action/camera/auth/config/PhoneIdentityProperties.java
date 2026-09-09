package com.action.camera.auth.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "camera.phone-identity")
@Getter
@Setter
public class PhoneIdentityProperties {

    private String encryptionKey = "";
    private String lookupHmacKey = "";
}
