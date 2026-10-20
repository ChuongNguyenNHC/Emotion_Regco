package com.emotion.service;

import com.emotion.model.EmotionRecord;
import com.emotion.repository.EmotionRecordRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class VideoAnalysisService {

    private final EmotionRecordRepository emotionRecordRepository;
    private final String aiServiceUrl;
    private final RestTemplate restTemplate = new RestTemplate();

    public VideoAnalysisService(
            EmotionRecordRepository emotionRecordRepository,
            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl) {
        this.emotionRecordRepository = emotionRecordRepository;
        this.aiServiceUrl = aiServiceUrl;
    }

    public Map<String, Object> analyzeAndStore(MultipartFile file, String userId, String videoId) throws IOException {
        String effectiveVideoId = videoId == null || videoId.isBlank()
                ? UUID.randomUUID().toString()
                : videoId.trim();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename() != null ? file.getOriginalFilename() : "video.mp4";
            }
        };
        body.add("file", fileResource);

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = restTemplate.postForObject(
                aiServiceUrl + "/api/v1/predict-video", request, Map.class);

        if (result == null) {
            return null;
        }
        Map<String, Object> response = new LinkedHashMap<>(result);
        if (Boolean.TRUE.equals(response.get("success"))) {
            saveVideoRecord(file, normalizeUserId(userId), effectiveVideoId, response);
            response.put("videoId", effectiveVideoId);
        }
        return response;
    }

    private void saveVideoRecord(MultipartFile file, String userId, String videoId, Map<String, Object> result) {
        EmotionRecord record = new EmotionRecord();
        record.setUserId(userId);
        record.setVideoId(videoId);
        record.setDominantEmotion((String) result.get("dominantEmotion"));
        record.setEmoji((String) result.get("emoji"));

        if (result.get("distribution") instanceof Map<?, ?> distribution) {
            Map<String, Double> probabilities = new HashMap<>();
            for (Map.Entry<?, ?> entry : distribution.entrySet()) {
                if (entry.getKey() != null && entry.getValue() instanceof Number value) {
                    probabilities.put(entry.getKey().toString(), value.doubleValue() / 100.0);
                }
            }
            record.setProbabilities(probabilities);
            String dominantEmotion = (String) result.get("dominantEmotion");
            if (dominantEmotion != null && probabilities.containsKey(dominantEmotion)) {
                record.setConfidence(probabilities.get(dominantEmotion));
            }
        }

        record.setCreatedAt(LocalDateTime.now());
        record.setSourceType("UPLOADED_VIDEO");
        record.setVideoFileName(file.getOriginalFilename());
        record.setVideoTimeline(toTimeline(result.get("timeline")));
        emotionRecordRepository.save(record);
    }

    private List<Map<String, Object>> toTimeline(Object rawTimeline) {
        if (!(rawTimeline instanceof List<?> frames)) {
            return List.of();
        }

        List<Map<String, Object>> timeline = new ArrayList<>();
        for (Object frame : frames) {
            if (frame instanceof Map<?, ?> frameData) {
                Map<String, Object> entry = new LinkedHashMap<>();
                frameData.forEach((key, value) -> {
                    if (key != null) {
                        entry.put(key.toString(), value);
                    }
                });
                timeline.add(entry);
            }
        }
        return timeline;
    }

    private String normalizeUserId(String userId) {
        return userId == null || userId.isBlank() ? "guest" : userId.trim();
    }
}
