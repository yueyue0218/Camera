package com.action.camera.message.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AcceptedResponseSnapshot {

    private Long responseId;

    private Long demandId;

    private Long customerId;

    private Long providerUserId;

    private String status;
}
