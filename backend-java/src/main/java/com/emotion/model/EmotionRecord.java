package com.emotion.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@Document(collection = "emotion_records")
public class EmotionRecord {

    @Id
    private String id;

    private String userId; // "guest" or logged in userId
    private String videoId;
    private String dominantEmotion; // e.g. "Happy", "Sad"
    private String emoji; // e.g. "😊"
    private Double confidence; // e.g. 0.87
    private Map<String, Double> probabilities; // Detail breakdown
    private String sourceType = "REALTIME_CAMERA"; // "REALTIME_CAMERA" or "UPLOADED_VIDEO"
    private String videoFileName; // optional filename when sourceType is UPLOADED_VIDEO
    private List<Map<String, Object>> videoTimeline; // Per-sampled-frame emotion data for uploaded videos
    private LocalDateTime createdAt = LocalDateTime.now();
}
