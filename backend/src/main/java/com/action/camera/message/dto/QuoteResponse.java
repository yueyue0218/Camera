package com.action.camera.message.dto;

import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class QuoteResponse {

    private Long quotationId;
    private String quoteNo;
    private Long conversationId;
    private Long customerId;
    private Long providerUserId;
    private Long amountCent;
    private LocalDateTime shootStartTime;
    private LocalDateTime shootEndTime;
    private String location;
    private String serviceContent;
    private Integer originalCount;
    private Integer refinedCount;
    private LocalDateTime deliveryDeadline;
    private String photoUsageScope;
    private QuoteStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime expireTime;

    public static QuoteResponse from(Quote quote) {
        return new QuoteResponse(
                quote.getId(),
                quote.getQuoteNo(),
                quote.getConversationId(),
                quote.getCustomerId(),
                quote.getProviderUserId(),
                quote.getAmountCent(),
                quote.getShootStartTime(),
                quote.getShootEndTime(),
                quote.getLocation(),
                quote.getServiceContent(),
                quote.getOriginalCount(),
                quote.getRefinedCount(),
                quote.getDeliveryDeadline(),
                quote.getPhotoUsageScope(),
                quote.getStatus(),
                quote.getCreatedAt(),
                quote.getExpireTime()
        );
    }
}
