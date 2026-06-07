package com.action.camera.message.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class CreateQuoteCommand {

    private Long conversationId;

    private Long amountCent;

    private LocalDateTime shootStartTime;

    private LocalDateTime shootEndTime;

    private String location;

    private String serviceContent;

    private Integer originalCount;

    private Integer refinedCount;

    private LocalDateTime deliveryDeadline;

    private String photoUsageScope;

    private String terms;

    private String contractTerms;

    private String safetyNoticeVersion;

    private LocalDateTime expireTime;

    private String remark;
}
