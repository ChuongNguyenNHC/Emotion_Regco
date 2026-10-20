package com.emotion.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@Document(collection = "chat_conversations")
public class ChatConversation {

    @Id
    private String id;

    private String userId;
    private String title;
    private LocalDateTime periodStart;
    private LocalDateTime periodEnd;
    private List<ChatMessage> messages = new ArrayList<>();
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
}
