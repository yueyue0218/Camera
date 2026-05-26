package com.action.camera.message;

import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.controller.ConversationController;
import com.action.camera.message.controller.QuoteController;
import com.action.camera.message.dto.ConfirmQuoteRequest;
import com.action.camera.message.dto.ConfirmQuoteResponse;
import com.action.camera.message.dto.ConversationResponse;
import com.action.camera.message.dto.CreateConversationFromResponseRequest;
import com.action.camera.message.dto.CreateQuoteRequest;
import com.action.camera.message.dto.MessageResponse;
import com.action.camera.message.dto.QuoteResponse;
import com.action.camera.message.dto.RejectQuoteResponse;
import com.action.camera.message.dto.SendTextMessageRequest;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Message;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.message.service.ConversationService;
import com.action.camera.message.service.MessageService;
import com.action.camera.message.service.QuoteService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.service.OrderService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationQuoteControllerTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_USER_ID = 2001L;
    private static final Long STRANGER_ID = 3001L;
    private static final Long RESPONSE_ID = 3001L;
    private static final Long DEMAND_ID = 5001L;
    private static final Long CONVERSATION_ID = 9001L;
    private static final Long QUOTE_ID = 7001L;
    private static final Long ORDER_ID = 8001L;
    private static final Long AMOUNT_CENT = 39900L;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private QuoteRepository quoteRepository;

    @Mock
    private OrderService orderService;

    private ConversationController conversationController;

    private QuoteController quoteController;

    @BeforeEach
    void setUp() {
        ConversationService conversationService = new ConversationService(conversationRepository);
        MessageService messageService = new MessageService(conversationRepository, messageRepository);
        QuoteService quoteService = new QuoteService(quoteRepository, conversationRepository, orderService);
        conversationController = new ConversationController(conversationService, messageService, quoteService);
        quoteController = new QuoteController(quoteService);
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void createConversationEndpointUsesCurrentCustomer() {
        UserContext.setUserId(CUSTOMER_ID);
        when(conversationRepository.findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBId(
                ConversationService.SOURCE_TYPE_DEMAND_RESPONSE, RESPONSE_ID, CUSTOMER_ID, PROVIDER_USER_ID))
                .thenReturn(Optional.empty());
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(invocation -> {
            Conversation conversation = invocation.getArgument(0);
            conversation.setId(CONVERSATION_ID);
            return conversation;
        });

        Result<ConversationResponse> result =
                conversationController.createFromAcceptedResponse(acceptedRequest());

        assertEquals(200, result.getCode());
        assertEquals(CONVERSATION_ID, result.getData().getConversationId());
        assertEquals(CUSTOMER_ID, result.getData().getParticipantAId());
        assertEquals(PROVIDER_USER_ID, result.getData().getParticipantBId());
    }

    @Test
    void createConversationEndpointRejectsWrongCurrentUser() {
        UserContext.setUserId(PROVIDER_USER_ID);

        assertThrows(BusinessException.class,
                () -> conversationController.createFromAcceptedResponse(acceptedRequest()));

        verify(conversationRepository, never()).save(any(Conversation.class));
    }

    @Test
    void repeatedConversationEndpointReturnsExistingConversation() {
        UserContext.setUserId(CUSTOMER_ID);
        Conversation existing = conversation();
        when(conversationRepository.findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBId(
                ConversationService.SOURCE_TYPE_DEMAND_RESPONSE, RESPONSE_ID, CUSTOMER_ID, PROVIDER_USER_ID))
                .thenReturn(Optional.of(existing));

        Result<ConversationResponse> result =
                conversationController.createFromAcceptedResponse(acceptedRequest());

        assertEquals(CONVERSATION_ID, result.getData().getConversationId());
        verify(conversationRepository, never()).save(any(Conversation.class));
    }

    @Test
    void nonAcceptedConversationRequestFails() {
        UserContext.setUserId(CUSTOMER_ID);
        CreateConversationFromResponseRequest request = acceptedRequest();
        request.setStatus("PENDING");

        assertThrows(BusinessException.class,
                () -> conversationController.createFromAcceptedResponse(request));
    }

    @Test
    void participantCanSendTextMessageEndpoint() {
        UserContext.setUserId(PROVIDER_USER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            message.setId(1L);
            return message;
        });
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Result<MessageResponse> result =
                conversationController.sendTextMessage(CONVERSATION_ID, textRequest("可以，我发正式报价"));

        assertEquals(200, result.getCode());
        assertEquals(PROVIDER_USER_ID, result.getData().getSenderId());
        assertEquals(MessageService.MESSAGE_TYPE_TEXT, result.getData().getMessageType());
    }

    @Test
    void blankTextMessageEndpointFails() {
        UserContext.setUserId(CUSTOMER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> conversationController.sendTextMessage(CONVERSATION_ID, textRequest("   ")));

        verify(messageRepository, never()).save(any(Message.class));
    }

    @Test
    void strangerCannotSendTextMessageEndpoint() {
        UserContext.setUserId(STRANGER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> conversationController.sendTextMessage(CONVERSATION_ID, textRequest("我不是会话双方")));
    }

    @Test
    void participantCanListMessagesEndpoint() {
        UserContext.setUserId(CUSTOMER_ID);
        Message message = message();
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(CONVERSATION_ID))
                .thenReturn(List.of(message));

        Result<List<MessageResponse>> result = conversationController.listMessages(CONVERSATION_ID);

        assertEquals(1, result.getData().size());
        assertEquals(message.getId(), result.getData().get(0).getMessageId());
    }

    @Test
    void strangerCannotListMessagesEndpoint() {
        UserContext.setUserId(STRANGER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> conversationController.listMessages(CONVERSATION_ID));
    }

    @Test
    void providerCanCreateQuoteEndpoint() {
        UserContext.setUserId(PROVIDER_USER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(quoteRepository.findFirstByConversationIdAndStatus(CONVERSATION_ID, QuoteStatus.PENDING_CONFIRM))
                .thenReturn(Optional.empty());
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> {
            Quote quote = invocation.getArgument(0);
            quote.setId(QUOTE_ID);
            return quote;
        });

        Result<QuoteResponse> result = quoteController.createQuote(validQuoteRequest());

        assertEquals(200, result.getCode());
        assertEquals(QUOTE_ID, result.getData().getQuotationId());
        assertEquals(AMOUNT_CENT, result.getData().getAmountCent());
        assertEquals(QuoteStatus.PENDING_CONFIRM, result.getData().getStatus());
        verify(orderService, never()).createOrderFromConfirmedQuote(any(Quote.class));
    }

    @Test
    void customerCannotCreateQuoteEndpoint() {
        UserContext.setUserId(CUSTOMER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> quoteController.createQuote(validQuoteRequest()));

        verify(quoteRepository, never()).save(any(Quote.class));
    }

    @Test
    void strangerCannotCreateQuoteEndpoint() {
        UserContext.setUserId(STRANGER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> quoteController.createQuote(validQuoteRequest()));

        verify(quoteRepository, never()).save(any(Quote.class));
    }

    @Test
    void pendingQuoteBlocksCreateQuoteEndpoint() {
        UserContext.setUserId(PROVIDER_USER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(quoteRepository.findFirstByConversationIdAndStatus(CONVERSATION_ID, QuoteStatus.PENDING_CONFIRM))
                .thenReturn(Optional.of(pendingQuote()));

        assertThrows(BusinessException.class,
                () -> quoteController.createQuote(validQuoteRequest()));

        verify(quoteRepository, never()).save(any(Quote.class));
    }

    @Test
    void serviceContentNullOrBlankFailsInCreateQuoteEndpoint() {
        UserContext.setUserId(PROVIDER_USER_ID);
        CreateQuoteRequest nullServiceContent = validQuoteRequest();
        nullServiceContent.setServiceContent(null);
        CreateQuoteRequest blankServiceContent = validQuoteRequest();
        blankServiceContent.setServiceContent("   ");

        assertThrows(BusinessException.class, () -> quoteController.createQuote(nullServiceContent));
        assertThrows(BusinessException.class, () -> quoteController.createQuote(blankServiceContent));

        verify(quoteRepository, never()).save(any(Quote.class));
    }

    @Test
    void createQuoteEndpointDoesNotAcceptOperatorIdInRequest() throws NoSuchFieldException {
        assertThrows(NoSuchFieldException.class, () -> CreateQuoteRequest.class.getDeclaredField("operatorId"));
        assertThrows(NoSuchFieldException.class, () -> CreateQuoteRequest.class.getDeclaredField("customerId"));
        assertThrows(NoSuchFieldException.class, () -> CreateQuoteRequest.class.getDeclaredField("providerUserId"));
    }

    @Test
    void participantCanListQuotesEndpointWithStatusFilter() {
        UserContext.setUserId(CUSTOMER_ID);
        Quote quote = pendingQuote();
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(quoteRepository.findByConversationIdAndStatusOrderByCreatedAtDesc(
                CONVERSATION_ID, QuoteStatus.PENDING_CONFIRM)).thenReturn(List.of(quote));

        Result<List<QuoteResponse>> result =
                conversationController.listQuotes(CONVERSATION_ID, QuoteStatus.PENDING_CONFIRM);

        assertEquals(1, result.getData().size());
        assertEquals(AMOUNT_CENT, result.getData().get(0).getAmountCent());
    }

    @Test
    void strangerCannotListQuotesEndpoint() {
        UserContext.setUserId(STRANGER_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> conversationController.listQuotes(CONVERSATION_ID, null));
    }

    @Test
    void customerCanConfirmQuoteEndpoint() {
        UserContext.setUserId(CUSTOMER_ID);
        Quote quote = pendingQuote();
        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderService.createOrderFromConfirmedQuote(any(Quote.class))).thenReturn(order());

        ConfirmQuoteRequest request = new ConfirmQuoteRequest();
        request.setConfirmRemark("确认报价");
        Result<ConfirmQuoteResponse> result = quoteController.confirmQuote(QUOTE_ID, request);

        assertEquals(QUOTE_ID, result.getData().getQuotationId());
        assertEquals(QuoteStatus.CONFIRMED, result.getData().getQuotationStatus());
        assertEquals(ORDER_ID, result.getData().getOrderId());
        assertEquals(OrderStatus.PENDING_PAYMENT, result.getData().getOrderStatus());
    }

    @Test
    void providerCannotConfirmOwnQuoteEndpoint() {
        UserContext.setUserId(PROVIDER_USER_ID);
        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(pendingQuote()));

        assertThrows(BusinessException.class,
                () -> quoteController.confirmQuote(QUOTE_ID, new ConfirmQuoteRequest()));

        verify(orderService, never()).createOrderFromConfirmedQuote(any(Quote.class));
    }

    @Test
    void customerCanRejectQuoteEndpoint() {
        UserContext.setUserId(CUSTOMER_ID);
        Quote quote = pendingQuote();
        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Result<RejectQuoteResponse> result = quoteController.rejectQuote(QUOTE_ID, null);

        assertEquals(QUOTE_ID, result.getData().getQuotationId());
        assertEquals(QuoteStatus.REJECTED, result.getData().getQuotationStatus());
    }

    @Test
    void rejectedQuoteCannotBeConfirmedEndpoint() {
        UserContext.setUserId(CUSTOMER_ID);
        Quote quote = pendingQuote();
        quote.setStatus(QuoteStatus.REJECTED);
        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(quote));

        assertThrows(BusinessException.class,
                () -> quoteController.confirmQuote(QUOTE_ID, null));

        verify(orderService, never()).createOrderFromConfirmedQuote(any(Quote.class));
    }

    private CreateConversationFromResponseRequest acceptedRequest() {
        CreateConversationFromResponseRequest request = new CreateConversationFromResponseRequest();
        request.setResponseId(RESPONSE_ID);
        request.setDemandId(DEMAND_ID);
        request.setCustomerId(CUSTOMER_ID);
        request.setProviderUserId(PROVIDER_USER_ID);
        request.setStatus(ConversationService.RESPONSE_STATUS_ACCEPTED);
        return request;
    }

    private SendTextMessageRequest textRequest(String content) {
        SendTextMessageRequest request = new SendTextMessageRequest();
        request.setContent(content);
        return request;
    }

    private CreateQuoteRequest validQuoteRequest() {
        CreateQuoteRequest request = new CreateQuoteRequest();
        request.setConversationId(CONVERSATION_ID);
        request.setAmountCent(AMOUNT_CENT);
        request.setShootStartTime(LocalDateTime.of(2026, 6, 1, 9, 0));
        request.setShootEndTime(LocalDateTime.of(2026, 6, 1, 12, 0));
        request.setLocation("南京大学鼓楼校区");
        request.setServiceContent("毕业照半日约拍");
        request.setOriginalCount(30);
        request.setRefinedCount(9);
        request.setDeliveryDeadline(LocalDateTime.of(2026, 6, 8, 12, 0));
        request.setPhotoUsageScope("PERSONAL_ONLY");
        request.setTerms("P4 quote terms");
        request.setContractTerms("P4 contract terms");
        request.setSafetyNoticeVersion("P4-DEMO");
        request.setExpireTime(LocalDateTime.of(2026, 5, 30, 23, 59));
        request.setRemark("Basic retouch included");
        return request;
    }

    private Conversation conversation() {
        Conversation conversation = new Conversation();
        conversation.setId(CONVERSATION_ID);
        conversation.setParticipantAId(CUSTOMER_ID);
        conversation.setParticipantBId(PROVIDER_USER_ID);
        conversation.setSourceType(ConversationService.SOURCE_TYPE_DEMAND_RESPONSE);
        conversation.setSourceId(RESPONSE_ID);
        conversation.setCreatedAt(LocalDateTime.now());
        return conversation;
    }

    private Message message() {
        Message message = new Message();
        message.setId(1L);
        message.setConversationId(CONVERSATION_ID);
        message.setSenderId(CUSTOMER_ID);
        message.setMessageType(MessageService.MESSAGE_TYPE_TEXT);
        message.setContent("你好");
        message.setCreatedAt(LocalDateTime.now());
        return message;
    }

    private Quote pendingQuote() {
        Quote quote = new Quote();
        quote.setId(QUOTE_ID);
        quote.setQuoteNo("Q202606010001");
        quote.setConversationId(CONVERSATION_ID);
        quote.setCustomerId(CUSTOMER_ID);
        quote.setProviderUserId(PROVIDER_USER_ID);
        quote.setSourceType(ConversationService.SOURCE_TYPE_DEMAND_RESPONSE);
        quote.setSourceId(RESPONSE_ID);
        quote.setAmountCent(AMOUNT_CENT);
        quote.setShootStartTime(LocalDateTime.of(2026, 6, 1, 9, 0));
        quote.setShootEndTime(LocalDateTime.of(2026, 6, 1, 12, 0));
        quote.setLocation("南京大学鼓楼校区");
        quote.setServiceContent("毕业照半日约拍");
        quote.setOriginalCount(30);
        quote.setRefinedCount(9);
        quote.setDeliveryDeadline(LocalDateTime.of(2026, 6, 8, 12, 0));
        quote.setPhotoUsageScope("PERSONAL_ONLY");
        quote.setServiceSnapshotJson("{}");
        quote.setStatus(QuoteStatus.PENDING_CONFIRM);
        quote.setExpireTime(LocalDateTime.of(2026, 5, 30, 23, 59));
        quote.setCreatedAt(LocalDateTime.now());
        quote.setUpdatedAt(LocalDateTime.now());
        return quote;
    }

    private Order order() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderNo("O202606010001");
        order.setQuoteId(QUOTE_ID);
        order.setConversationId(CONVERSATION_ID);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_USER_ID);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setEscrowStatus(EscrowStatus.NOT_PAID);
        order.setTotalAmountCent(AMOUNT_CENT);
        return order;
    }
}
