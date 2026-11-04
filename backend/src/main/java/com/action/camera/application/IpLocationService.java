package com.action.camera.application;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;

/** IP inference must not upload an address to a third party or overwrite a public region. */
@Service
public class IpLocationService {
    // Preserve injection compatibility; do not construct a network client.
    public IpLocationService(RestTemplateBuilder builder) {}
    public String resolveProvince(String ip) { return null; }
}
