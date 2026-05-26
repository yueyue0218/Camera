package com.action.camera.message.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.dto.ConversationListItemResponse;
import com.action.camera.message.dto.ConversationResponse;
import com.action.camera.message.dto.CreateConversationFromResponseRequest;
import com.action.camera.message.dto.MessageResponse;
import com.action.camera.message.dto.QuoteResponse;
import com.action.camera.message.dto.SendTextMessageRequest;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Message;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.model.AcceptedResponseSnapshot;
import com.action.camera.message.service.ConversationService;
import com.action.camera.message.service.MessageService;
import com.action.camera.message.service.QuoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final MessageService messageService;
    private final QuoteService quoteService;

    @GetMapping("/conversations")
    public Result<List<ConversationListItemResponse>> listMyConversations() {
        Long operatorId = currentUserId();
        List<ConversationListItemResponse> conversations = conversationService.listMyConversations(operatorId)
                .stream()
                .map(conversation -> ConversationListItemResponse.from(conversation, operatorId))
                .toList();
        return Result.success(conversations);
    }

    @PostMapping("/conversations/from-response")
    public Result<ConversationResponse> createFromAcceptedResponse(
            @RequestBody CreateConversationFromResponseRequest request) {
        Long operatorId = currentUserId();
        AcceptedResponseSnapshot snapshot = new AcceptedResponseSnapshot(
                request.getResponseId(),
                request.getDemandId(),
                request.getCustomerId(),
                request.getProviderUserId(),
                request.getStatus()
        );
        Conversation conversation = conversationService.createFromAcceptedResponse(snapshot, operatorId);
        return Result.success(ConversationResponse.from(conversation));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public Result<List<MessageResponse>> listMessages(@PathVariable Long conversationId) {
        Long operatorId = currentUserId();
        List<MessageResponse> messages = messageService.listMessages(conversationId, operatorId)
                .stream()
                .map(MessageResponse::from)
                .toList();
        return Result.success(messages);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public Result<MessageResponse> sendTextMessage(
            @PathVariable Long conversationId,
            @RequestBody SendTextMessageRequest request) {
        Long operatorId = currentUserId();
        Message message = messageService.sendTextMessage(conversationId, operatorId, request.getContent());
        return Result.success(MessageResponse.from(message));
    }

    @GetMapping("/conversations/{conversationId}/quotations")
    public Result<List<QuoteResponse>> listQuotes(
            @PathVariable Long conversationId,
            @RequestParam(required = false) QuoteStatus status) {
        Long operatorId = currentUserId();
        List<QuoteResponse> quotes = quoteService.listQuotesInConversation(conversationId, status, operatorId)
                .stream()
                .map(QuoteResponse::from)
                .toList();
        return Result.success(quotes);
    }

    private Long currentUserId() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return userId;
    }
}
