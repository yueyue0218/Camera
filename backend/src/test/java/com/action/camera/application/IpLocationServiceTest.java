package com.action.camera.application;

import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class IpLocationServiceTest {
    @Test void ipInferenceDoesNotConstructOrCallAnExternalClient() {
        RestTemplateBuilder builder = mock(RestTemplateBuilder.class);
        IpLocationService service = new IpLocationService(builder);
        assertThat(service.resolveProvince("203.0.113.10")).isNull();
        assertThat(service.resolveProvince("127.0.0.1")).isNull();
        assertThat(service.resolveProvince(null)).isNull();
        verifyNoInteractions(builder);
    }
}
