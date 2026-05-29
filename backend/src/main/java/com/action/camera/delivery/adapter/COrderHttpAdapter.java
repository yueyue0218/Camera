package com.action.camera.delivery.adapter;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.port.OrderQueryPort;
import com.action.camera.delivery.port.OrderSnapshot;
import com.action.camera.delivery.port.OrderStatusPort;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "camera.order.adapter", havingValue = "c-http")
public class COrderHttpAdapter implements OrderQueryPort, OrderStatusPort {

    private static final ParameterizedTypeReference<Map<String, Object>> RESULT_TYPE =
            new ParameterizedTypeReference<>() {
            };

    private final RestClient restClient;

    public COrderHttpAdapter(RestClient.Builder restClientBuilder,
                             @Value("${camera.order.c-base-url:http://localhost:8080}") String cBaseUrl) {
        this.restClient = restClientBuilder.baseUrl(cBaseUrl).build();
    }

    @Override
    public OrderSnapshot getOrderSnapshot(Long orderId) {
        Map<String, Object> result = callC(() -> restClient.get()
                .uri("/orders/{orderId}", orderId)
                .header(HttpHeaders.AUTHORIZATION, currentAuthorization())
                .retrieve()
                .body(RESULT_TYPE));
        Map<String, Object> data = dataOf(result);
        return new OrderSnapshot(
                longValue(data, "orderId"),
                longValue(data, "customerId"),
                longValue(data, "providerUserId"),
                stringValue(data, "status"),
                localDateTimeValue(data, "deliveryDeadline")
        );
    }

    @Override
    public String changeStatus(Long orderId, String targetStatus, Long operatorId, String remark) {
        Map<String, Object> result = callC(() -> restClient.post()
                .uri("/orders/{orderId}/status-transitions", orderId)
                .header(HttpHeaders.AUTHORIZATION, currentAuthorization())
                .body(Map.of(
                        "targetStatus", targetStatus,
                        "reason", remark == null ? "" : remark
                ))
                .retrieve()
                .body(RESULT_TYPE));
        return stringValue(dataOf(result), "toStatus");
    }

    private Map<String, Object> dataOf(Map<String, Object> result) {
        if (result == null) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "C 订单接口返回为空");
        }
        Object code = result.get("code");
        if (!(code instanceof Number number) || number.intValue() != 200) {
            throw new BusinessException(mapResultCode(code), messageOf(result));
        }
        Object data = result.get("data");
        if (!(data instanceof Map<?, ?> map)) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "C 订单接口缺少 data");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> typedData = (Map<String, Object>) map;
        return typedData;
    }

    private Map<String, Object> callC(COrderCall call) {
        try {
            return call.execute();
        } catch (RestClientResponseException e) {
            throw new BusinessException(mapHttpStatus(e.getStatusCode()), "C 订单接口调用失败: " + e.getResponseBodyAsString());
        } catch (RestClientException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "C 订单接口不可用: " + e.getMessage());
        }
    }

    private ErrorCode mapResultCode(Object code) {
        if (!(code instanceof Number number)) {
            return ErrorCode.STATUS_CONFLICT;
        }
        int resultCode = number.intValue();
        if (resultCode == ErrorCode.FORBIDDEN.getCode()) {
            return ErrorCode.FORBIDDEN;
        }
        if (resultCode == ErrorCode.NOT_FOUND.getCode()) {
            return ErrorCode.NOT_FOUND;
        }
        if (resultCode == ErrorCode.STATUS_CONFLICT.getCode()) {
            return ErrorCode.STATUS_CONFLICT;
        }
        return ErrorCode.STATUS_CONFLICT;
    }

    private ErrorCode mapHttpStatus(HttpStatusCode statusCode) {
        if (statusCode.value() == 403) {
            return ErrorCode.FORBIDDEN;
        }
        if (statusCode.value() == 404) {
            return ErrorCode.NOT_FOUND;
        }
        if (statusCode.value() == 409) {
            return ErrorCode.STATUS_CONFLICT;
        }
        return ErrorCode.STATUS_CONFLICT;
    }

    private String currentAuthorization() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "缺少当前请求上下文");
        }
        HttpServletRequest request = attributes.getRequest();
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || authorization.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return authorization;
    }

    private Long longValue(Map<String, Object> data, String field) {
        Object value = data.get(field);
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            return Long.parseLong(stringValue);
        }
        throw new BusinessException(ErrorCode.INTERNAL_ERROR, "C 订单接口缺少字段: " + field);
    }

    private String stringValue(Map<String, Object> data, String field) {
        Object value = data.get(field);
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            return stringValue;
        }
        throw new BusinessException(ErrorCode.INTERNAL_ERROR, "C 订单接口缺少字段: " + field);
    }

    private LocalDateTime localDateTimeValue(Map<String, Object> data, String field) {
        String value = stringValue(data, field);
        return LocalDateTime.parse(value);
    }

    private String messageOf(Map<String, Object> result) {
        Object message = result.get("message");
        return message == null ? "C 订单接口返回失败" : message.toString();
    }

    @FunctionalInterface
    private interface COrderCall {

        Map<String, Object> execute();
    }
}
