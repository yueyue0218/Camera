package com.action.camera.order.dto;

import java.util.Map;

public record OrderSummaryResponse(long total, long completed, long ongoing, Map<String, Long> byStatus) {
}
