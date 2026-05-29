package com.action.camera.message.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.model.AcceptedResponseSnapshot;
import com.action.camera.message.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.time.LocalDateTime;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ConversationService {

    public static final String SOURCE_TYPE_DEMAND_RESPONSE = "DEMAND_RESPONSE";
    public static final String RESPONSE_STATUS_ACCEPTED = "ACCEPTED";

    private final ConversationRepository conversationRepository;

    @Transactional
    public Conversation createFromAcceptedResponse(AcceptedResponseSnapshot snapshot, Long operatorId) {
        validateAcceptedSnapshot(snapshot, operatorId);

        return conversationRepository
                .findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBId(
                        SOURCE_TYPE_DEMAND_RESPONSE,
                        snapshot.getResponseId(),
                        snapshot.getCustomerId(),
                        snapshot.getProviderUserId())
                .orElseGet(() -> conversationRepository.save(buildConversation(snapshot)));
    }

    @Transactional(readOnly = true)
    public List<Conversation> listMyConversations(Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        return conversationRepository.findByParticipantAIdOrParticipantBId(operatorId, operatorId)
                .stream()
                .filter(conversation -> conversation.hasParticipant(operatorId))
                .sorted(Comparator
                        .comparing(this::sortTime, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Conversation::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private LocalDateTime sortTime(Conversation conversation) {
        if (conversation.getLastMessageTime() != null) {
            return conversation.getLastMessageTime();
        }
        return conversation.getCreatedAt();
    }

    private void validateAcceptedSnapshot(AcceptedResponseSnapshot snapshot, Long operatorId) {
        if (snapshot == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "accepted response snapshot must not be null");
        }
        if (snapshot.getResponseId() == null || snapshot.getDemandId() == null
                || snapshot.getCustomerId() == null || snapshot.getProviderUserId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "accepted response snapshot is incomplete");
        }
        if (!RESPONSE_STATUS_ACCEPTED.equals(snapshot.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Demand response is not accepted: " + snapshot.getStatus());
        }
        if (!Objects.equals(snapshot.getCustomerId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the customer can create conversation from response");
        }
    }

    private Conversation buildConversation(AcceptedResponseSnapshot snapshot) {
        Conversation conversation = new Conversation();
        conversation.setParticipantAId(snapshot.getCustomerId());
        conversation.setParticipantBId(snapshot.getProviderUserId());
        conversation.setSourceType(SOURCE_TYPE_DEMAND_RESPONSE);
        conversation.setSourceId(snapshot.getResponseId());
        conversation.setCreatedAt(LocalDateTime.now());
        return conversation;
    }
}
