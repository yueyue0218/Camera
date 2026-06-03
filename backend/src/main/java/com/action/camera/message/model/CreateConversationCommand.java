package com.action.camera.message.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateConversationCommand {

    private Long customerId;

    private Long providerId;

    private Long initiatorId;

    private String sourceType;

    private Long sourceId;

    private String initialMessage;
}
