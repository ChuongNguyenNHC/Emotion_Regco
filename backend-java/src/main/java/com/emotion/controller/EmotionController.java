package com.emotion.controller;

import com.emotion.model.EmotionRecord;
import com.emotion.repository.EmotionRecordRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
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

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> aiResponse = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate.postForEntity(targetUrl, payload, Map.class);
            Map<String, Object> body = aiResponse.getBody();

            if (body != null && Boolean.TRUE.equals(body.get("success"))) {
                String userId = (String) payload.get("userId");
                if (userId != null && !userId.trim().isEmpty() && !"guest".equalsIgnoreCase(userId.trim())) {
                    EmotionRecord record = new EmotionRecord();
                    record.setUserId(userId.trim());
                    record.setDominantEmotion((String) body.get("emotion"));
                    record.setEmoji((String) body.get("emoji"));

                    Object confObj = body.get("confidence");
                    if (confObj instanceof Number) {
                        record.setConfidence(((Number) confObj).doubleValue());
                    }

                    if (body.get("probabilities") instanceof Map<?, ?> probMap) {
                        Map<String, Double> convertedMap = new HashMap<>();
                        for (Map.Entry<?, ?> entry : probMap.entrySet()) {
                            if (entry.getKey() != null && entry.getValue() instanceof Number num) {
                                convertedMap.put(entry.getKey().toString(), num.doubleValue());
                            }
                        }
                        record.setProbabilities(convertedMap);
                    }
                    record.setCreatedAt(LocalDateTime.now());
                    record.setSourceType("REALTIME_CAMERA");

                    emotionRecordRepository.save(record);
                }
            }

            return ResponseEntity.ok(body);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Failed to analyze & store emotion: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping(value = "/analyze-video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> proxyAnalyzeVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "userId", required = false, defaultValue = "guest") String userId) {
        String targetUrl = aiServiceUrl + "/api/v1/predict-video";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            org.springframework.core.io.ByteArrayResource fileResource = new org.springframework.core.io.ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename() != null ? file.getOriginalFilename() : "video.mp4";
                }
            };
            bodyMap.add("file", fileResource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> aiResponse = restTemplate.postForEntity(targetUrl, requestEntity, (Class<Map<String, Object>>)(Class<?>)Map.class);
            Map<String, Object> body = aiResponse.getBody();

            if (body != null && Boolean.TRUE.equals(body.get("success"))) {
                if (userId != null && !userId.trim().isEmpty() && !"guest".equalsIgnoreCase(userId.trim())) {
                    EmotionRecord record = new EmotionRecord();
                    record.setUserId(userId.trim());
                    record.setDominantEmotion((String) body.get("dominantEmotion"));
                    record.setEmoji((String) body.get("emoji"));

                    if (body.get("distribution") instanceof Map<?, ?> distMap) {
                        Map<String, Double> convertedMap = new HashMap<>();
                        for (Map.Entry<?, ?> entry : distMap.entrySet()) {
                            if (entry.getKey() != null && entry.getValue() instanceof Number num) {
                                convertedMap.put(entry.getKey().toString(), num.doubleValue() / 100.0);
                            }
                        }
                        record.setProbabilities(convertedMap);

                        // Set confidence as the proportion of the dominant emotion
                        String domEmo = (String) body.get("dominantEmotion");
                        if (domEmo != null && convertedMap.containsKey(domEmo)) {
                            record.setConfidence(convertedMap.get(domEmo));
                        }
                    }
                    record.setCreatedAt(LocalDateTime.now());
                    record.setSourceType("UPLOADED_VIDEO");
                    record.setVideoFileName(file.getOriginalFilename());
                    emotionRecordRepository.save(record);
                }
            }

            return ResponseEntity.ok(body);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Failed to analyze video: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/history")
    public ResponseEntity<List<EmotionRecord>> getRecentHistory(@RequestParam(required = false) String userId) {
        if (userId != null && !userId.trim().isEmpty()) {
            return ResponseEntity.ok(emotionRecordRepository.findByUserIdOrderByCreatedAtDesc(userId));
        }
        return ResponseEntity.ok(emotionRecordRepository.findTop20ByOrderByCreatedAtDesc());
    }

    @DeleteMapping("/clear-guest")
    public ResponseEntity<Map<String, Object>> clearGuestRecords() {
        long deletedCount = emotionRecordRepository.deleteByUserId("guest");
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("deletedCount", deletedCount);
        res.put("message", "Đã dọn sạch " + deletedCount + " bản ghi cũ của khách (guest)!");
        return ResponseEntity.ok(res);
    }
}

