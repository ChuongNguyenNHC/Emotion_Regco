package com.emotion.controller;

import com.emotion.model.EmotionRecord;
import com.emotion.repository.EmotionRecordRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;
import java.util.List;

@RestController
@RequestMapping("/api/v1/emotions")
@CrossOrigin(origins = "*")
public class EmotionController {

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Autowired
    private EmotionRecordRepository emotionRecordRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> checkHealth() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "Spring Boot Backend");
        response.put("mongoDb", "CONNECTED (Cluster0 Atlas)");
        response.put("aiServiceUrl", aiServiceUrl);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/analyze-base64")
    public ResponseEntity<?> proxyAnalyzeBase64(@RequestBody Map<String, Object> payload) {
        String targetUrl = aiServiceUrl + "/api/v1/predict-base64";
        try {
            // 1. Call FastAPI AI Service
            ResponseEntity<Map> aiResponse = restTemplate.postForEntity(targetUrl, payload, Map.class);
            Map<String, Object> body = aiResponse.getBody();

            if (body != null && Boolean.TRUE.equals(body.get("success"))) {
                // 2. Save prediction history into MongoDB Atlas
                EmotionRecord record = new EmotionRecord();
                record.setUserId((String) payload.getOrDefault("userId", "guest"));
                record.setDominantEmotion((String) body.get("emotion"));
                record.setEmoji((String) body.get("emoji"));
                
                Object confObj = body.get("confidence");
                if (confObj instanceof Number) {
                    record.setConfidence(((Number) confObj).doubleValue());
                }
                
                if (body.get("probabilities") instanceof Map) {
                    record.setProbabilities((Map<String, Double>) body.get("probabilities"));
                }
                record.setCreatedAt(LocalDateTime.now());

                emotionRecordRepository.save(record);
            }

            return ResponseEntity.ok(body);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Failed to analyze & store emotion: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/history")
    public ResponseEntity<List<EmotionRecord>> getRecentHistory() {
        return ResponseEntity.ok(emotionRecordRepository.findTop20ByOrderByCreatedAtDesc());
    }
}

