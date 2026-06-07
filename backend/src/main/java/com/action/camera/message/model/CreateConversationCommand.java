package com.action.camera.message.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateConversationCommand {

    private Long customerId;

    private Long providerId;

    private Long initiatorId;

    private String sourceType;

    private Long sourceId;

    private Long orderId;

    private String initialMessage;

    public CreateConversationCommand(Long customerId,
                                     Long providerId,
                                     Long initiatorId,
                                     String sourceType,
                                     Long sourceId,
                                     String initialMessage) {
        this(customerId, providerId, initiatorId, sourceType, sourceId, null, initialMessage);
    }

    public CreateConversationCommand(Long customerId,
                                     Long providerId,
                                     Long initiatorId,
                                     String sourceType,
                                     Long sourceId,
                                     Long orderId,
                                     String initialMessage) {
        this.customerId = customerId;
        this.providerId = providerId;
        this.initiatorId = initiatorId;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.orderId = orderId;
        this.initialMessage = initialMessage;
    }
}
