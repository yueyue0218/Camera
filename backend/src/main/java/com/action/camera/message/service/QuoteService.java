package com.action.camera.message.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class QuoteService {

    private final QuoteRepository quoteRepository;
    private final OrderService orderService;

    @Transactional
    public Order confirmQuote(Long quoteId, Long operatorId, String confirmRemark) {
        Quote quote = getQuoteOrThrow(quoteId);
        ensureCustomerOperator(quote, operatorId);

        if (quote.getStatus() == QuoteStatus.CONFIRMED) {
            return orderService.createOrderFromConfirmedQuote(quote);
        }
        if (quote.getStatus() != QuoteStatus.PENDING_CONFIRM) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Quote status does not allow confirmation: " + quote.getStatus());
        }

        quote.setStatus(QuoteStatus.CONFIRMED);
        quote.setUpdatedAt(LocalDateTime.now());
        quoteRepository.save(quote);
        return orderService.createOrderFromConfirmedQuote(quote);
    }

    @Transactional
    public Quote rejectQuote(Long quoteId, Long operatorId, String rejectReason) {
        Quote quote = getQuoteOrThrow(quoteId);
        ensureCustomerOperator(quote, operatorId);

        if (quote.getStatus() != QuoteStatus.PENDING_CONFIRM) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Quote status does not allow rejection: " + quote.getStatus());
        }

        quote.setStatus(QuoteStatus.REJECTED);
        quote.setRemark(mergeRemark(quote.getRemark(), rejectReason));
        quote.setUpdatedAt(LocalDateTime.now());
        return quoteRepository.save(quote);
    }

    private Quote getQuoteOrThrow(Long quoteId) {
        if (quoteId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "quoteId must not be null");
        }
        return quoteRepository.findById(quoteId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Quote not found: " + quoteId));
    }

    private void ensureCustomerOperator(Quote quote, Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        if (!Objects.equals(quote.getCustomerId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the customer can operate this quote");
        }
    }

    private String mergeRemark(String originalRemark, String operationRemark) {
        if (operationRemark == null || operationRemark.isBlank()) {
            return originalRemark;
        }
        if (originalRemark == null || originalRemark.isBlank()) {
            return operationRemark;
        }
        return originalRemark + "\nReject reason: " + operationRemark;
    }
}
