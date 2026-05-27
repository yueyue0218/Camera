package com.action.camera.delivery.adapter;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.port.OrderSnapshot;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.client.RestClient;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class COrderHttpAdapterTest {

    private HttpServer server;
    private COrderHttpAdapter adapter;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.start();
        String baseUrl = "http://localhost:" + server.getAddress().getPort();
        adapter = new COrderHttpAdapter(RestClient.builder(), baseUrl);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer test-token");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
        server.stop(0);
    }

    @Test
    void getOrderSnapshotReadsOrderFieldsFromResultData() {
        server.createContext("/orders/10", exchange -> writeJson(exchange, 200, """
                {
                  "code": 200,
                  "message": "success",
                  "data": {
                    "orderId": 10,
                    "customerId": 20,
                    "providerUserId": 30,
                    "status": "PENDING_DELIVERY",
                    "deliveryDeadline": "2026-05-30T12:00:00"
                  }
                }
                """));

        OrderSnapshot snapshot = adapter.getOrderSnapshot(10L);

        assertThat(snapshot.getOrderId()).isEqualTo(10L);
        assertThat(snapshot.getCustomerId()).isEqualTo(20L);
        assertThat(snapshot.getProviderId()).isEqualTo(30L);
        assertThat(snapshot.getStatus()).isEqualTo("PENDING_DELIVERY");
    }

    @Test
    void resultForbiddenCodeMapsToForbiddenBusinessException() {
        server.createContext("/orders/10", exchange -> writeJson(exchange, 200, """
                {
                  "code": 40301,
                  "message": "operator forbidden",
                  "data": null
                }
                """));

        assertThatThrownBy(() -> adapter.getOrderSnapshot(10L))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
                    assertThat(exception.getMessage()).isEqualTo("operator forbidden");
                });
    }

    @Test
    void httpNotFoundMapsToNotFoundBusinessException() {
        server.createContext("/orders/10", exchange -> writeJson(exchange, 404, """
                {
                  "code": 40401,
                  "message": "order not found",
                  "data": null
                }
                """));

        assertThatThrownBy(() -> adapter.getOrderSnapshot(10L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    private void writeJson(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream responseBody = exchange.getResponseBody()) {
            responseBody.write(bytes);
        }
    }
}
