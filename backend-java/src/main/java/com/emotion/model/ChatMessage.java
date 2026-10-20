package com.emotion.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@NoArgsConstructor
public class ChatMessage {

    private String role;
    private String text;
    private String fileName;
    private String videoId;
    private Map<String, Object> videoAnalysis;
    private LocalDateTime createdAt = LocalDateTime.now();
}
