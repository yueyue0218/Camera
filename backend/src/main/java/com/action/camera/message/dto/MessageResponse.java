package com.action.camera.message.dto;

import com.action.camera.domain.FileRecord;
import com.action.camera.message.entity.Message;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class MessageResponse {

    private Long messageId;
    private Long conversationId;
    private Long senderId;
    private String messageType;
    private String content;
    private Long fileId;
    private String fileName;
    private String mimeType;
    private Long size;
    private String fileType;
    private String attachmentKind;
    private String downloadUrl;
    private LocalDateTime createdAt;

    public static MessageResponse from(Message message) {
        return from(message, null);
    }

    public static MessageResponse from(Message message, FileRecord file) {
        Long fileId = file != null ? file.getId() : message.getFileId();
        String attachmentKind = file != null ? resolveAttachmentKind(file.getMimeType()) : null;
        return new MessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getMessageType(),
                message.getContent(),
                fileId,
                file != null ? file.getOriginalName() : null,
                file != null ? file.getMimeType() : null,
                file != null ? file.getFileSize() : null,
                attachmentKind,
                attachmentKind,
                fileId != null ? "/files/" + fileId + "/download" : null,
                message.getCreatedAt()
        );
    }

    private static String resolveAttachmentKind(String mimeType) {
        return String.valueOf(mimeType == null ? "" : mimeType).toLowerCase().startsWith("image/")
                ? "IMAGE"
                : "FILE";
    }
}
