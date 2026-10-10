package com.action.camera.support;

import com.action.camera.CameraApplication;
import com.action.camera.auth.service.AuthSessionService;
import com.action.camera.domain.User;
import com.action.camera.domain.UserRoleBinding;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.report.repository.ReportRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;

/**
 * Explicit local-only check: real Nginx -> real Spring Boot -> disposable H2.
 * Run after test-compile and frontend build: java -cp ... StagingRoutingHttpCheck
 * <absolute-nginx-binary> <absolute-repository-root>. No production endpoints.
 * Credentials remain in memory; only response metadata is written to target.
 */
public final class StagingRoutingHttpCheck {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private static final List<Map<String, Object>> EVIDENCE = new ArrayList<>();
    private static final List<String> FAILURES = new ArrayList<>();
    private static String base;
    private static ConfigurableApplicationContext context;
    private static Path output;
    private static String adminToken, reporterToken, adminPassword;
    private static long ownerId, demandId, serviceId;

    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Usage: <nginx-binary> <repository-root>");
        Path nginx = Path.of(args[0]).toAbsolutePath();
        Path repository = Path.of(args[1]).toAbsolutePath();
        Path dist = repository.resolve("frontend/dist");
        if (!Files.isRegularFile(dist.resolve("index.html"))) throw new IllegalStateException("Build temp-staging frontend first");
        output = repository.resolve("backend/target/routing-audit");
        Files.createDirectories(output);
        Path isolated = Files.createTempDirectory(output, "nginx-");
        Files.createDirectories(isolated.resolve("logs"));
        Files.createDirectories(isolated.resolve("temp"));
        int port;
        try (var socket = new java.net.ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
            port = socket.getLocalPort();
        }
        base = "http://127.0.0.1:" + port;
        // Fixed local H2 overrides take precedence over environment/production defaults.
        var app = new SpringApplication(CameraApplication.class);
        try {
            context = app.run("--spring.profiles.active=smoke", "--server.address=127.0.0.1", "--server.port=0",
                "--spring.datasource.url=jdbc:h2:mem:routing_" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
                "--spring.datasource.driver-class-name=org.h2.Driver", "--spring.datasource.username=sa", "--spring.datasource.password=",
                "--spring.jpa.hibernate.ddl-auto=create-drop", "--spring.jpa.show-sql=false", "--camera.demo.seed-users=false");
            seed();
            int backendPort = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            String candidate = Files.readString(repository.resolve("infra/staging/nginx/portra.conf"))
                .replace("127.0.0.1:8080", "127.0.0.1:" + backendPort)
                .replace("/var/www/dist", unix(dist));
            Files.writeString(isolated.resolve("portra.conf"), candidate);
            String config = "pid nginx.pid;\nerror_log logs/error.log warn;\nevents {}\nhttp {\n"
                + "include \"" + unix(nginx.getParent().resolve("conf/mime.types")) + "\";\naccess_log off;\nserver {\n"
                + "listen 127.0.0.1:" + port + ";\ninclude \"" + unix(isolated.resolve("portra.conf")) + "\";\n}\n}\n";
            Files.writeString(isolated.resolve("nginx.conf"), config);
            runNginx(nginx, isolated, "-t");
            runNginx(nginx, isolated);
            try {
                waitForServer();
                verifyPages(Files.readString(dist.resolve("index.html")));
                verifyApi();
                Files.writeString(output.resolve("nginx-http-evidence.json"), JSON.writerWithDefaultPrettyPrinter().writeValueAsString(EVIDENCE));
                System.out.println("ROUTING_HTTP_CHECKS=" + EVIDENCE.size() + " FAILURES=" + FAILURES.size());
                FAILURES.forEach(System.out::println);
                if (!FAILURES.isEmpty()) throw new AssertionError("Routing checks failed; see response metadata evidence");
            } finally {
                runNginx(nginx, isolated, "-s", "quit");
            }
        } finally {
            if (context != null) context.close();
        }
    }

    private static String unix(Path path) { return path.toString().replace('\\', '/'); }

    private static void runNginx(Path binary, Path prefix, String... extra) throws Exception {
        var command = new ArrayList<String>(List.of(binary.toString(), "-p", unix(prefix) + "/", "-c", "nginx.conf"));
        command.addAll(List.of(extra));
        var process = new ProcessBuilder(command).directory(prefix.toFile()).redirectErrorStream(true)
            .redirectOutput(ProcessBuilder.Redirect.appendTo(output.resolve("nginx-process.log").toFile())).start();
        if (extra.length == 0 && !process.waitFor(500, java.util.concurrent.TimeUnit.MILLISECONDS)) return;
        if (!process.waitFor(15, java.util.concurrent.TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IllegalStateException("Nginx control command timed out");
        }
        if (process.exitValue() != 0) throw new IllegalStateException("Nginx command failed: " + Arrays.toString(extra));
    }

    private static void waitForServer() throws Exception {
        for (int i = 0; i < 50; i++) {
            try { HTTP.send(HttpRequest.newBuilder(URI.create(base + "/")).GET().build(), HttpResponse.BodyHandlers.discarding()); return; }
            catch (java.io.IOException e) { Thread.sleep(100); }
        }
        throw new IllegalStateException("Local Nginx did not start");
    }

    private static void seed() {
        var users = context.getBean(UserRepository.class);
        User owner = user("routing-owner", "PROVIDER");
        User reporter = user("routing-reporter", "CUSTOMER");
        User admin = user("routing-admin", "ADMIN");
        adminPassword = UUID.randomUUID().toString().substring(0, 24);
        admin.setStudentNo("999000009");
        admin.setPasswordHash(new BCryptPasswordEncoder().encode(adminPassword));
        users.saveAndFlush(admin);
        ownerId = owner.getId();
        reporterToken = context.getBean(AuthSessionService.class).issue(reporter, "CUSTOMER", false, "routing", "local HTTP").response().getToken();
        adminToken = context.getBean(AuthSessionService.class).issue(admin, "ADMIN", true, "routing", "local HTTP").response().getToken();
        var now = LocalDateTime.now();
        demandId = context.getBean(DemandRepository.class).saveAndFlush(new Demand(ownerId, "PORTRAIT", List.of("natural"),
            null, "afternoon", "flexible", List.of("NEAR_1_MONTH"), "NJ", "campus", 10000, 20000,
            "routing isolated demand", List.of(), now, now.plusDays(30))).getId();
        var service = new ServicePackage();
        service.setProviderId(ownerId); service.setTitle("routing isolated service"); service.setCityCode("NJ");
        service.setServiceArea("campus"); service.setScene("PORTRAIT"); service.setBasePriceCent(10000L);
        service.setDurationMinutes(60); service.setOriginalCount(20); service.setRefinedCount(5);
        service.setDeliveryDays(7); service.setTimeDescription("flexible"); service.setTimeTags(List.of("NEAR_1_MONTH"));
        service.setCreatedAt(now); service.setUpdatedAt(now);
        serviceId = context.getBean(ServicePackageRepository.class).saveAndFlush(service).getId();
    }

    private static User user(String nickname, String role) {
        var user = new User(); user.setNickname(nickname); user.setCurrentRole(role);
        user = context.getBean(UserRepository.class).saveAndFlush(user);
        var binding = new UserRoleBinding(); binding.setUserId(user.getId()); binding.setRole(role);
        context.getBean(UserRoleBindingRepository.class).saveAndFlush(binding);
        return user;
    }

    private static HttpResponse<String> call(String method, String path, String token, Object body, Map<String, String> headers) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(10));
        if (token != null) request.header("Authorization", "Bearer " + token);
        headers.forEach(request::header);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        return HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void record(String method, String path, HttpResponse<String> response, int code, boolean ok) {
        EVIDENCE.add(Map.of("method", method, "path", path, "httpStatus", response.statusCode(),
            "contentType", response.headers().firstValue("Content-Type").orElse(""), "businessCode", code, "passed", ok));
        if (!ok) FAILURES.add(method + " " + path + " status=" + response.statusCode() + " code=" + code);
    }

    private static JsonNode json(String method, String path, String token, Object body, int expected) throws Exception {
        var response = call(method, path, token, body, Map.of("Accept", "application/json"));
        JsonNode payload = JSON.createObjectNode();
        try { payload = JSON.readTree(response.body()); } catch (Exception ignored) { /* Report non-JSON as failure. */ }
        int code = payload.path("code").asInt(-1);
        record(method, path, response, code, response.statusCode() == 200
            && response.headers().firstValue("Content-Type").orElse("").contains("application/json") && code == expected
            && !(expected == 200 && method.equals("GET") && path.equals("/api/admin/certifications")
                && !payload.path("data").path("records").isArray()));
        return payload;
    }

    private static void verifyPages(String index) throws Exception {
        for (String path : List.of("/admin", "/admin/reports", "/admin/hall", "/admin/feed", "/admin/users", "/admin/certifications", "/admin/complaints", "/admin/users/42")) {
            for (int refresh = 0; refresh < 2; refresh++) {
                var response = call("GET", path, null, null, Map.of("Accept", "text/html", "Cache-Control", "no-cache"));
                record("GET", path, response, -1, response.statusCode() == 200
                    && response.headers().firstValue("Content-Type").orElse("").contains("text/html") && response.body().equals(index));
            }
        }
        var matcher = java.util.regex.Pattern.compile("(?:src|href)=\"(/assets/[^\"]+)\"").matcher(index);
        while (matcher.find()) {
            String path = matcher.group(1);
            var response = call("GET", path, null, null, Map.of());
            record("GET", path, response, -1, response.statusCode() == 200 && !response.body().equals(index));
        }
    }

    private static void verifyApi() throws Exception {
        json("GET", "/api/certifications/me", reporterToken, null, 40401);
        json("POST", "/api/certifications", reporterToken, Map.of(), 40001);
        json("GET", "/api/admin/certifications", adminToken, null, 200);
        json("GET", "/api/admin/certifications", reporterToken, null, 40301);
        for (String action : List.of("approve", "reject")) {
            Object body = action.equals("reject") ? Map.of("rejectReason", "local absent fixture") : null;
            json("POST", "/api/admin/certifications/999999/" + action, adminToken, body, 40401);
            json("POST", "/api/admin/certifications/999999/" + action, reporterToken, body, 40301);
        }
        for (String path : List.of("/reports/my", "/api/web/reports/my")) json("GET", path, null, null, 40101);
        for (String path : List.of("/reports", "/api/web/reports")) json("POST", path, null, Map.of("targetType", "USER", "targetId", ownerId, "reason", "anonymous"), 40101);
        var endpoints = List.of("/admin/dashboard", "/admin/hall-items?type=DEMAND", "/admin/moments", "/admin/users",
            "/admin/reports", "/admin/certifications?type=REAL_NAME", "/admin/review-complaints");
        for (String path : endpoints) {
            json("GET", "/api/web" + path, null, null, 40101);
            json("GET", "/api/web" + path, reporterToken, null, 40301);
            json("GET", "/api/web" + path, adminToken, null, 200);
        }
        for (String method : List.of("GET", "POST", "PATCH")) {
            for (String path : List.of("/reports", "/api/web/reports", "/reports/my", "/api/web/reports/my", "/api/web/admin/reports", "/auth/refresh")) {
                var response = call("OPTIONS", path, null, null, Map.of("Origin", base,
                    "Access-Control-Request-Method", method, "Access-Control-Request-Headers", "authorization,content-type"));
                boolean ok = response.statusCode() == 200 && response.headers().firstValue("Access-Control-Allow-Origin").orElse("").equals(base)
                    && response.headers().firstValue("Access-Control-Allow-Credentials").orElse("").equals("true")
                    && response.headers().firstValue("Access-Control-Allow-Methods").orElse("").contains(method)
                    && response.headers().firstValue("Access-Control-Allow-Headers").orElse("").toLowerCase().contains("authorization");
                record("OPTIONS " + method, path, response, -1, ok);
            }
        }
        for (String path : List.of("/demands", "/service-packages", "/demands/" + demandId, "/service-packages/" + serviceId,
            "/api/web/demands", "/api/web/service-packages")) json("GET", path, null, null, 200);
        json("GET", "/users/" + ownerId + "/public-profile", reporterToken, null, 200);
        // This fixture has no provider profile; preserve the real controller's NOT_FOUND JSON.
        json("GET", "/api/v1/providers/" + ownerId + "/profile", null, null, 40401);
        for (String path : List.of("/users/me", "/orders", "/notifications", "/conversations", "/reviews/complaints/my", "/me/service-package-interests")) json("GET", path, reporterToken, null, 200);
        // Admin login remains the original controller and original refresh-cookie path.
        var login = call("POST", "/api/web/admin/login", null, Map.of("studentNo", "999000009", "password", adminPassword), Map.of());
        String cookie = login.headers().firstValue("Set-Cookie").orElse("");
        int code = -1;
        try { code = JSON.readTree(login.body()).path("code").asInt(-1); } catch (Exception ignored) {}
        record("POST", "/api/web/admin/login", login, code, code == 200 && cookie.contains("Path=/auth/refresh")
            && cookie.contains("HttpOnly") && cookie.contains("Secure") && cookie.contains("SameSite=Lax"));
        if (code == 200) {
            var refresh = call("POST", "/auth/refresh", null, null, Map.of("Cookie", cookie.split(";", 2)[0]));
            int refreshed = JSON.readTree(refresh.body()).path("code").asInt(-1);
            record("POST", "/auth/refresh", refresh, refreshed, refreshed == 200);
        }
        for (String type : List.of("DEMAND", "SERVICE_PACKAGE", "USER")) {
            long id = type.equals("DEMAND") ? demandId : type.equals("SERVICE_PACKAGE") ? serviceId : ownerId;
            var created = json("POST", "/api/web/reports", reporterToken, Map.of("targetType", type, "targetId", id, "reason", "route check " + type), 200);
            long reportId = created.path("data").path("reportId").asLong();
            if (reportId > 0) {
                json("GET", "/api/web/admin/reports/" + reportId, adminToken, null, 200);
                json("PATCH", "/api/web/admin/reports/" + reportId + "/resolve", reporterToken, Map.of("resolution", "IGNORE"), 40301);
                json("PATCH", "/api/web/admin/reports/" + reportId + "/resolve", adminToken, Map.of("resolution", "IGNORE", "adminComment", "local routing check"), 200);
                var saved = context.getBean(ReportRepository.class).findById(reportId).orElseThrow();
                if (!saved.getTargetType().name().equals(type) || saved.getTargetId() != id || !saved.getStatus().name().equals("RESOLVED"))
                    FAILURES.add("Persisted report target/state mismatch " + type);
            }
        }
        var legacy = json("POST", "/reports", reporterToken, Map.of("targetType", "USER", "targetId", ownerId, "reason", "legacy route"), 200);
        long legacyId = legacy.path("data").path("reportId").asLong();
        if (legacyId > 0) json("PATCH", "/api/web/admin/reports/" + legacyId + "/resolve", adminToken, Map.of("resolution", "IGNORE", "adminComment", "local legacy routing check"), 200);
        json("GET", "/reports/my", reporterToken, null, 200);
        json("GET", "/api/web/reports/my", reporterToken, null, 200);
    }
}
