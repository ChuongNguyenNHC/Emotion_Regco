package com.emotion.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "emotion_records")
public class EmotionRecord {

    @Id
    private String id;
    
    private String userId;           // "guest" or logged in userId
    private String dominantEmotion;  // e.g. "Happy", "Sad"
    private String emoji;            // e.g. "😊"
    private Double confidence;       // e.g. 0.87
    private Map<String, Double> probabilities; // Detail breakdown
    private LocalDateTime createdAt = LocalDateTime.now();
}
