package com.action.camera.message.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.dto.ConfirmQuoteRequest;
import com.action.camera.message.dto.ConfirmQuoteResponse;
import com.action.camera.message.dto.CreateQuoteRequest;
import com.action.camera.message.dto.QuoteResponse;
import com.action.camera.message.dto.RejectQuoteRequest;
import com.action.camera.message.dto.RejectQuoteResponse;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.model.CreateQuoteCommand;
import com.action.camera.message.service.QuoteService;
import com.action.camera.order.entity.Order;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class QuoteController {

    private final QuoteService quoteService;

    @PostMapping("/quotations")
    public Result<QuoteResponse> createQuote(@RequestBody CreateQuoteRequest request) {
        Long operatorId = currentUserId();
        Quote quote = quoteService.createQuoteFromConversation(toCommand(request), operatorId);
        return Result.success(QuoteResponse.from(quote));
    }

    @PostMapping("/quotations/{quotationId}/confirm")
    public Result<ConfirmQuoteResponse> confirmQuote(
            @PathVariable Long quotationId,
            @RequestBody(required = false) ConfirmQuoteRequest request) {
        Long operatorId = currentUserId();
        String confirmRemark = request == null ? null : request.getConfirmRemark();
        Order order = quoteService.confirmQuote(quotationId, operatorId, confirmRemark);
        return Result.success(ConfirmQuoteResponse.from(quotationId, order));
    }

    @PostMapping("/quotations/{quotationId}/reject")
    public Result<RejectQuoteResponse> rejectQuote(
            @PathVariable Long quotationId,
            @RequestBody(required = false) RejectQuoteRequest request) {
        Long operatorId = currentUserId();
        String rejectReason = request == null ? null : request.getRejectReason();
        Quote quote = quoteService.rejectQuote(quotationId, operatorId, rejectReason);
        return Result.success(RejectQuoteResponse.from(quote));
    }

    private CreateQuoteCommand toCommand(CreateQuoteRequest request) {
        CreateQuoteCommand command = new CreateQuoteCommand();
        command.setConversationId(request.getConversationId());
        command.setAmountCent(request.getAmountCent());
        command.setShootStartTime(request.getShootStartTime());
        command.setShootEndTime(request.getShootEndTime());
        command.setLocation(request.getLocation());
        command.setServiceContent(request.getServiceContent());
        command.setOriginalCount(request.getOriginalCount());
        command.setRefinedCount(request.getRefinedCount());
        command.setDeliveryDeadline(request.getDeliveryDeadline());
        command.setPhotoUsageScope(request.getPhotoUsageScope());
        command.setTerms(request.getTerms());
        command.setContractTerms(request.getContractTerms());
        command.setSafetyNoticeVersion(request.getSafetyNoticeVersion());
        command.setExpireTime(request.getExpireTime());
        command.setRemark(request.getRemark());
        return command;
    }

    private Long currentUserId() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return userId;
    }
}
