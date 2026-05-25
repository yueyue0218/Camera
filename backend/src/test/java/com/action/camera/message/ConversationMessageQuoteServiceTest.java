package com.action.camera.message;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Message;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.model.AcceptedResponseSnapshot;
import com.action.camera.message.model.CreateQuoteCommand;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.message.service.ConversationService;
import com.action.camera.message.service.MessageService;
import com.action.camera.message.service.QuoteService;
import com.action.camera.order.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationMessageQuoteServiceTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_USER_ID = 2001L;
    private static final Long STRANGER_ID = 3001L;
    private static final Long RESPONSE_ID = 3001L;
    private static final Long DEMAND_ID = 5001L;
    private static final Long CONVERSATION_ID = 9001L;
    private static final Long AMOUNT_CENT = 39900L;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private QuoteRepository quoteRepository;

    @Mock
    private OrderService orderService;

    private ConversationService conversationService;

    private MessageService messageService;

    private QuoteService quoteService;

    @BeforeEach
    void setUp() {
        conversationService = new ConversationService(conversationRepository);
        messageService = new MessageService(conversationRepository, messageRepository);
        quoteService = new QuoteService(quoteRepository, conversationRepository, orderService);
    }

    @Test
    void acceptedResponseCanCreateConversation() {
        AcceptedResponseSnapshot snapshot = acceptedSnapshot();
        when(conversationRepository.findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBId(
                ConversationService.SOURCE_TYPE_DEMAND_RESPONSE, RESPONSE_ID, CUSTOMER_ID, PROVIDER_USER_ID))
                .thenReturn(Optional.empty());
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(invocation -> {
            Conversation conversation = invocation.getArgument(0);
            conversation.setId(CONVERSATION_ID);
            return conversation;
        });

        Conversation conversation = conversationService.createFromAcceptedResponse(snapshot, CUSTOMER_ID);

        assertEquals(CONVERSATION_ID, conversation.getId());
        assertEquals(CUSTOMER_ID, conversation.getParticipantAId());
        assertEquals(PROVIDER_USER_ID, conversation.getParticipantBId());
        assertEquals(ConversationService.SOURCE_TYPE_DEMAND_RESPONSE, conversation.getSourceType());
        assertEquals(RESPONSE_ID, conversation.getSourceId());
        assertNotNull(conversation.getCreatedAt());
        verify(conversationRepository, times(1)).save(any(Conversation.class));
    }

    @Test
    void repeatedAcceptedResponseReturnsExistingConversation() {
        Conversation existing = conversation();
        when(conversationRepository.findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBId(
                ConversationService.SOURCE_TYPE_DEMAND_RESPONSE, RESPONSE_ID, CUSTOMER_ID, PROVIDER_USER_ID))
                .thenReturn(Optional.of(existing));

        Conversation conversation = conversationService.createFromAcceptedResponse(acceptedSnapshot(), CUSTOMER_ID);

        assertEquals(existing, conversation);
        verify(conversationRepository, never()).save(any(Conversation.class));
    }

    @Test
    void nonAcceptedResponseCannotCreateConversation() {
        AcceptedResponseSnapshot snapshot = acceptedSnapshot();
        snapshot.setStatus("PENDING_CUSTOMER_ACCEPT");

        assertThrows(BusinessException.class,
                () -> conversationService.createFromAcceptedResponse(snapshot, CUSTOMER_ID));

        verify(conversationRepository, never()).save(any(Conversation.class));
    }

    @Test
    void nonCustomerCannotCreateConversationFromResponse() {
        assertThrows(BusinessException.class,
                () -> conversationService.createFromAcceptedResponse(acceptedSnapshot(), PROVIDER_USER_ID));

        verify(conversationRepository, never()).save(any(Conversation.class));
    }

    @Test
    void participantsCanSendTextAndUpdateLastMessageTime() {
        Conversation conversation = conversation();
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation));
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            message.setId(1L);
            return message;
        });
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Message customerMessage = messageService.sendTextMessage(CONVERSATION_ID, CUSTOMER_ID, "你好，我想确认一下拍摄时间");
        Message providerMessage = messageService.sendTextMessage(CONVERSATION_ID, PROVIDER_USER_ID, "可以，我稍后发正式报价");

        assertEquals(MessageService.MESSAGE_TYPE_TEXT, customerMessage.getMessageType());
        assertEquals(CUSTOMER_ID, customerMessage.getSenderId());
        assertEquals(PROVIDER_USER_ID, providerMessage.getSenderId());
        assertFalse(customerMessage.getIsRead());
        assertNotNull(conversation.getLastMessageTime());
        verify(messageRepository, times(2)).save(any(Message.class));
        verify(conversationRepository, times(2)).save(conversation);
    }

    @Test
    void strangerCannotSendTextMessage() {
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> messageService.sendTextMessage(CONVERSATION_ID, STRANGER_ID, "我不是会话双方"));

        verify(messageRepository, never()).save(any(Message.class));
    }

    @Test
    void blankTextMessageCannotBeSent() {
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> messageService.sendTextMessage(CONVERSATION_ID, CUSTOMER_ID, "  "));

        verify(messageRepository, never()).save(any(Message.class));
    }

    @Test
    void nonParticipantCannotListMessages() {
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> messageService.listMessages(CONVERSATION_ID, STRANGER_ID));

        verify(messageRepository, never()).findByConversationIdOrderByCreatedAtAsc(CONVERSATION_ID);
    }

    @Test
    void participantCanListMessages() {
        Message message = new Message();
        message.setConversationId(CONVERSATION_ID);
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(CONVERSATION_ID)).thenReturn(List.of(message));

        List<Message> messages = messageService.listMessages(CONVERSATION_ID, CUSTOMER_ID);

        assertEquals(1, messages.size());
    }

    @Test
    void providerCanCreatePendingQuoteInConversation() {
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(quoteRepository.findFirstByConversationIdAndStatus(CONVERSATION_ID, QuoteStatus.PENDING_CONFIRM))
                .thenReturn(Optional.empty());
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> {
            Quote quote = invocation.getArgument(0);
            quote.setId(7001L);
            return quote;
        });

        Quote quote = quoteService.createQuoteFromConversation(validQuoteCommand(), PROVIDER_USER_ID);

        assertEquals(QuoteStatus.PENDING_CONFIRM, quote.getStatus());
        assertEquals(CONVERSATION_ID, quote.getConversationId());
        assertEquals(CUSTOMER_ID, quote.getCustomerId());
        assertEquals(PROVIDER_USER_ID, quote.getProviderUserId());
        assertEquals(ConversationService.SOURCE_TYPE_DEMAND_RESPONSE, quote.getSourceType());
        assertEquals(RESPONSE_ID, quote.getSourceId());
        assertQuoteHasSqlRequiredFields(quote);
    }

    @Test
    void customerCannotCreateQuote() {
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(validQuoteCommand(), CUSTOMER_ID));

        verify(quoteRepository, never()).save(any(Quote.class));
    }

    @Test
    void strangerCannotCreateQuote() {
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(validQuoteCommand(), STRANGER_ID));

        verify(quoteRepository, never()).save(any(Quote.class));
    }

    @Test
    void pendingQuoteBlocksNewQuoteInSameConversation() {
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(quoteRepository.findFirstByConversationIdAndStatus(CONVERSATION_ID, QuoteStatus.PENDING_CONFIRM))
                .thenReturn(Optional.of(new Quote()));

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(validQuoteCommand(), PROVIDER_USER_ID));

        verify(quoteRepository, never()).save(any(Quote.class));
    }

    @Test
    void invalidQuoteAmountIsRejected() {
        CreateQuoteCommand command = validQuoteCommand();
        command.setAmountCent(0L);

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(command, PROVIDER_USER_ID));

        verify(conversationRepository, never()).findById(any());
    }

    @Test
    void invalidShootTimeIsRejected() {
        CreateQuoteCommand command = validQuoteCommand();
        command.setShootEndTime(command.getShootStartTime());

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(command, PROVIDER_USER_ID));

        verify(conversationRepository, never()).findById(any());
    }

    @Test
    void invalidDeliveryDeadlineIsRejected() {
        CreateQuoteCommand command = validQuoteCommand();
        command.setDeliveryDeadline(command.getShootEndTime());

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(command, PROVIDER_USER_ID));

        verify(conversationRepository, never()).findById(any());
    }

    @Test
    void nullServiceContentIsRejected() {
        CreateQuoteCommand command = validQuoteCommand();
        command.setServiceContent(null);

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(command, PROVIDER_USER_ID));

        verify(quoteRepository, never()).save(any(Quote.class));
        verify(orderService, never()).createOrderFromConfirmedQuote(any(Quote.class));
        verify(messageRepository, never()).save(any(Message.class));
    }

    @Test
    void blankServiceContentIsRejected() {
        CreateQuoteCommand command = validQuoteCommand();
        command.setServiceContent("   ");

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(command, PROVIDER_USER_ID));

        verify(quoteRepository, never()).save(any(Quote.class));
        verify(orderService, never()).createOrderFromConfirmedQuote(any(Quote.class));
        verify(messageRepository, never()).save(any(Message.class));
    }

    @Test
    void invalidPhotoCountsAreRejected() {
        CreateQuoteCommand command = validQuoteCommand();
        command.setOriginalCount(-1);

        assertThrows(BusinessException.class,
                () -> quoteService.createQuoteFromConversation(command, PROVIDER_USER_ID));

        verify(conversationRepository, never()).findById(any());
    }

    @Test
    void quoteCreationDoesNotCreateQuoteCardMessage() {
        when(conversationRepository.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation()));
        when(quoteRepository.findFirstByConversationIdAndStatus(CONVERSATION_ID, QuoteStatus.PENDING_CONFIRM))
                .thenReturn(Optional.empty());
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        quoteService.createQuoteFromConversation(validQuoteCommand(), PROVIDER_USER_ID);

        verify(messageRepository, never()).save(any(Message.class));
    }

    private AcceptedResponseSnapshot acceptedSnapshot() {
        return new AcceptedResponseSnapshot(
                RESPONSE_ID,
                DEMAND_ID,
                CUSTOMER_ID,
                PROVIDER_USER_ID,
                ConversationService.RESPONSE_STATUS_ACCEPTED
        );
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

    private CreateQuoteCommand validQuoteCommand() {
        CreateQuoteCommand command = new CreateQuoteCommand();
        command.setConversationId(CONVERSATION_ID);
        command.setAmountCent(AMOUNT_CENT);
        command.setShootStartTime(LocalDateTime.of(2026, 6, 1, 9, 0));
        command.setShootEndTime(LocalDateTime.of(2026, 6, 1, 12, 0));
        command.setLocation("南京大学鼓楼校区");
        command.setServiceContent("毕业照半日约拍");
        command.setOriginalCount(30);
        command.setRefinedCount(9);
        command.setDeliveryDeadline(LocalDateTime.of(2026, 6, 8, 12, 0));
        command.setPhotoUsageScope("PERSONAL_ONLY");
        command.setTerms("P4 quote terms");
        command.setContractTerms("P4 contract terms");
        command.setSafetyNoticeVersion("P4-DEMO");
        command.setExpireTime(LocalDateTime.of(2026, 5, 30, 23, 59));
        command.setRemark("Basic retouch included");
        return command;
    }

    private void assertQuoteHasSqlRequiredFields(Quote quote) {
        assertNotNull(quote.getQuoteNo());
        assertNotNull(quote.getConversationId());
        assertNotNull(quote.getProviderUserId());
        assertNotNull(quote.getCustomerId());
        assertNotNull(quote.getSourceType());
        assertNotNull(quote.getShootStartTime());
        assertNotNull(quote.getShootEndTime());
        assertNotNull(quote.getLocation());
        assertNotNull(quote.getOriginalCount());
        assertNotNull(quote.getRefinedCount());
        assertNotNull(quote.getDeliveryDeadline());
        assertNotNull(quote.getPhotoUsageScope());
        assertNotNull(quote.getServiceSnapshotJson());
        assertNotNull(quote.getAmountCent());
        assertNotNull(quote.getStatus());
        assertNotNull(quote.getExpireTime());
        assertNotNull(quote.getCreatedAt());
        assertNotNull(quote.getUpdatedAt());
        assertTrue(quote.getDeliveryDeadline().isAfter(quote.getShootEndTime()));
    }
}
