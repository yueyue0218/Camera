package com.action.camera.common;

import com.action.camera.common.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.MissingServletRequestParameterException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class B5SecurityContractTest {

    private static final Path REPOSITORY = Path.of("..").toAbsolutePath().normalize();

    @Test
    void unexpectedAndFrameworkErrorsDoNotExposeInternalDetails() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        Result<?> unexpected = handler.handleException(
                new IllegalStateException("connection refused at mysql.internal:3306"));
        Result<?> missing = handler.handleMissingRequestPart(
                new MissingServletRequestParameterException("secret", "String"));

        assertThat(unexpected.getMessage()).isEqualTo("服务暂时不可用")
                .doesNotContain("mysql", "3306", "IllegalStateException");
        assertThat(missing.getMessage()).isEqualTo("请求参数不完整")
                .doesNotContain("secret", "MissingServletRequestParameterException");
    }

    @Test
    void nginxTemplateForcesHttpsAndDefinesProxyTrustBoundary() throws IOException {
        String nginx = read("deploy/nginx/camera.conf");

        assertThat(nginx)
                .contains("return 301 https://$host$request_uri")
                .contains("listen 443 ssl")
                .contains("Strict-Transport-Security")
                .contains("X-Content-Type-Options")
                .contains("Content-Security-Policy")
                .contains("proxy_set_header X-Forwarded-For $remote_addr")
                .contains("proxy_set_header X-Forwarded-Proto https")
                .doesNotContain("$proxy_add_x_forwarded_for");
    }

    @Test
    void currentDocumentationNamesOnlyThePhoneSessionContract() throws IOException {
        String readme = read("README.md");
        String api = read("docs/P3/03_API规范文档.md");

        assertThat(readme)
                .contains("POST /auth/sms/send", "POST /auth/sms/verify")
                .doesNotContain("用**学校邮箱**注册")
                .doesNotMatch("(?s).*http://\\d{1,3}(?:\\.\\d{1,3}){3}.*");
        assertThat(api)
                .contains("POST /auth/sms/send", "POST /auth/sms/verify")
                .doesNotContain("POST /sessions\n参数名", "POST /sessions/logout");
    }

    @Test
    void ciDoesNotEmbedDatabasePasswords() throws IOException {
        String gitlab = read(".gitlab-ci.yml");

        assertThat(gitlab)
                .contains("MYSQL_ALLOW_EMPTY_PASSWORD")
                .doesNotContain("MYSQL_ROOT_PASSWORD", "DB_PASSWORD");
    }

    @Test
    void frontendProductionEnvironmentUsesHttpsWithoutAnEmbeddedMapKey() throws IOException {
        String environment = read("frontend/.env.production");

        assertThat(environment)
                .contains("VITE_API_BASE_URL=https://")
                .contains("VITE_AMAP_KEY=\n")
                .doesNotContain("VITE_API_BASE_URL=http://");
    }

    private String read(String relativePath) throws IOException {
        return Files.readString(REPOSITORY.resolve(relativePath), StandardCharsets.UTF_8)
                .replace("\r\n", "\n");
    }
}
