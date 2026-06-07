package com.action.camera.message.dto;

import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RejectQuoteResponse {

    private Long quotationId;
    private QuoteStatus quotationStatus;

    public static RejectQuoteResponse from(Quote quote) {
        return new RejectQuoteResponse(quote.getId(), quote.getStatus());
    }
}
