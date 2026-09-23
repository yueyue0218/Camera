package com.action.camera.common.config;

import com.action.camera.common.interceptor.AuthInterceptor;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class WebMvcTempStagingCorsContractTest {

    private static final String TEMP_STAGING_ORIGIN = "https://47.76.106.57";

    @Test
    void tempStagingAllowsOnlyConfiguredHttpsOriginWithCredentials() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOriginPatterns(List.of(TEMP_STAGING_ORIGIN));

        CorsConfiguration cors = configurationFor(properties);

        assertThat(cors.getAllowedOriginPatterns()).containsExactly(TEMP_STAGING_ORIGIN);
        assertThat(cors.getAllowedOriginPatterns()).doesNotContain("*");
        assertThat(cors.getAllowCredentials()).isTrue();
    }

    @Test
    void baseOriginsRemainUnchangedAndExcludeTempStagingOrigin() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "https://localhost:*",
                "http://127.0.0.1:*",
                "http://47.250.86.6",
                "http://47.250.86.6:*",
                "https://47.250.86.6",
                "https://47.250.86.6:*",
                "http://192.168.*:*",
                "http://10.*:*",
                "https://*.vercel.app",
                "https://*.up.railway.app"
        ));

        CorsConfiguration cors = configurationFor(properties);

        assertThat(cors.getAllowedOriginPatterns())
                .containsExactlyElementsOf(properties.getAllowedOriginPatterns())
                .doesNotContain(TEMP_STAGING_ORIGIN, "*");
        assertThat(cors.getAllowCredentials()).isTrue();
    }

    private CorsConfiguration configurationFor(CorsProperties properties) {
        WebMvcConfig config = new WebMvcConfig(mock(AuthInterceptor.class), properties);
        InspectableCorsRegistry registry = new InspectableCorsRegistry();
        config.addCorsMappings(registry);
        return registry.configurations().get("/**");
    }

    private static final class InspectableCorsRegistry extends CorsRegistry {
        Map<String, CorsConfiguration> configurations() {
            return getCorsConfigurations();
        }
    }
}
