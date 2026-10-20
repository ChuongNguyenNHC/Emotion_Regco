package com.emotion.service;

import com.emotion.model.EmotionRecord;
import com.emotion.repository.EmotionRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class EmotionChatService {

    private static final List<String> NEGATIVE_EMOTIONS = List.of("sad", "angry", "fear", "disgust");
    private static final List<String> EMOTIONS = List.of(
            "Happy", "Sad", "Angry", "Fear", "Surprise", "Disgust", "Neutral");
    private static final Map<String, String> NEGATIVE_EMOTION_LABELS = Map.of(
            "sad", "Buồn",
            "angry", "Tức giận",
            "fear", "Sợ hãi",
            "disgust", "Ghê tởm");

    private final EmotionRecordRepository emotionRecordRepository;
    private final VideoAnalysisService videoAnalysisService;
    private final GeminiChatService geminiChatService;
    private final ChatConversationService chatConversationService;

    public EmotionChatService(
            EmotionRecordRepository emotionRecordRepository,
            VideoAnalysisService videoAnalysisService,
            GeminiChatService geminiChatService,
            ChatConversationService chatConversationService) {
        this.emotionRecordRepository = emotionRecordRepository;
        this.videoAnalysisService = videoAnalysisService;
        this.geminiChatService = geminiChatService;
        this.chatConversationService = chatConversationService;
    }

    public Map<String, Object> chat(
            String conversationId,
            String message,
            String userId,
            LocalDateTime from,
            LocalDateTime to,
            MultipartFile video,
            String videoId)
            throws IOException {
        if ((message == null || message.isBlank()) && (video == null || video.isEmpty())) {
            throw new IllegalArgumentException("Hãy nhập câu hỏi hoặc chọn một video.");
        }
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("Khoảng thời gian không hợp lệ.");
        }
        geminiChatService.ensureConfigured();

        Map<String, Object> context = new LinkedHashMap<>();
        Map<String, Object> videoAnalysis = null;
        if (video != null && !video.isEmpty()) {
            videoAnalysis = videoAnalysisService.analyzeAndStore(video, userId, videoId);
            if (videoAnalysis == null || !Boolean.TRUE.equals(videoAnalysis.get("success"))) {
                throw new IllegalStateException("Không thể phân tích video đã gửi.");
            }
            context.put("scope", "video");
            context.put("videoAnalysis", summarizeVideo(videoAnalysis));
        } else if (videoId != null && !videoId.isBlank()) {
            EmotionRecord record = emotionRecordRepository
                    .findByUserIdAndVideoId(normalizeUserId(userId), videoId.trim())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Không tìm thấy video đã phân tích trong tài khoản này."));
            videoAnalysis = toVideoAnalysis(record);
            context.put("scope", "video");
            context.put("videoAnalysis", summarizeVideo(videoAnalysis));
        } else {
            context.put("scope", "history");
            context.put("periodStart", from.toString());
            context.put("periodEnd", to.toString());
            context.put("statistics", buildStatistics(userId, from, to));
        }

        String prompt = message == null || message.isBlank()
                ? "Phân tích video: nêu rõ các biểu cảm tiêu cực xuất hiện, tên từng loại, tỷ lệ và timestamp/mốc thời gian tương ứng."
                : message.trim();
        String answer = geminiChatService.answer(prompt, context);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("answer", answer);
        if (isRegisteredUser(userId)) {
            var conversation = chatConversationService.appendExchange(
                    conversationId,
                    userId.trim(),
                    message,
                    video == null || video.isEmpty()
                            ? videoAnalysis == null ? null : (String) videoAnalysis.get("filename")
                            : video.getOriginalFilename(),
                    videoAnalysis,
                    answer,
                    from,
                    to);
            result.put("conversationId", conversation.getId());
        }
        if (videoAnalysis != null) {
            result.put("videoAnalysis", videoAnalysis);
        }
        return result;
    }

    private String normalizeUserId(String userId) {
        return userId == null || userId.isBlank() ? "guest" : userId.trim();
    }

    private boolean isRegisteredUser(String userId) {
        return userId != null && !userId.isBlank() && !"guest".equalsIgnoreCase(userId.trim());
    }

    private Map<String, Object> toVideoAnalysis(EmotionRecord record) {
        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("success", true);
        analysis.put("videoId", record.getVideoId());
        analysis.put("filename", record.getVideoFileName());
        analysis.put("dominantEmotion", record.getDominantEmotion());
        analysis.put("emoji", record.getEmoji());
        analysis.put("sampledFrames", record.getVideoTimeline() == null ? 0 : record.getVideoTimeline().size());
        analysis.put("timeline", record.getVideoTimeline() == null ? List.of() : record.getVideoTimeline());

        Map<String, Double> distribution = new LinkedHashMap<>();
        if (record.getProbabilities() != null) {
            record.getProbabilities().forEach((emotion, probability) -> {
                if (probability != null && Double.isFinite(probability)) {
                    distribution.put(emotion, Math.round(probability * 1000.0) / 10.0);
                }
            });
        }
        analysis.put("distribution", distribution);
        return analysis;
    }

    private Map<String, Object> buildStatistics(String userId, LocalDateTime from, LocalDateTime to) {
        Map<String, Object> statistics = new LinkedHashMap<>();
        statistics.put("scope", "Chỉ lịch sử của tài khoản đang đăng nhập; khách chưa đăng nhập không có thống kê cá nhân.");

        if (userId == null || userId.isBlank() || "guest".equalsIgnoreCase(userId.trim())) {
            statistics.put("recordCount", 0);
            statistics.put("message", "Người dùng chưa đăng nhập nên không có lịch sử cá nhân để thống kê.");
            return statistics;
        }

        List<EmotionRecord> records = emotionRecordRepository
                .findByUserIdAndCreatedAtBetweenOrderByCreatedAtAsc(userId.trim(), from, to);
        Map<String, Integer> emotionCounts = new LinkedHashMap<>();
        Map<String, Double> probabilitySums = new LinkedHashMap<>();
        Map<String, Integer> probabilitySampleCounts = new LinkedHashMap<>();
        for (String emotion : EMOTIONS) {
            probabilitySums.put(emotion, 0.0);
            probabilitySampleCounts.put(emotion, 0);
        }
        int negativeCount = 0;

        for (EmotionRecord record : records) {
            String emotion = record.getDominantEmotion() == null ? "Unknown" : record.getDominantEmotion();
            emotionCounts.merge(emotion, 1, Integer::sum);
            if (NEGATIVE_EMOTIONS.contains(emotion.toLowerCase())) {
                negativeCount++;
            }
            if (record.getProbabilities() != null) {
                record.getProbabilities().forEach((label, probability) -> {
                    String canonicalLabel = EMOTIONS.stream()
                            .filter(candidate -> candidate.equalsIgnoreCase(label))
                            .findFirst()
                            .orElse(null);
                    if (canonicalLabel != null && probability != null && Double.isFinite(probability)) {
                        probabilitySums.merge(canonicalLabel, probability, Double::sum);
                        probabilitySampleCounts.merge(canonicalLabel, 1, Integer::sum);
                    }
                });
            }
        }

        Map<String, Double> averageProbabilitiesPercent = new LinkedHashMap<>();
        for (String emotion : EMOTIONS) {
            int sampleCount = probabilitySampleCounts.get(emotion);
            averageProbabilitiesPercent.put(
                    emotion,
                    sampleCount == 0
                            ? null
                            : Math.round(probabilitySums.get(emotion) * 1000.0 / sampleCount) / 10.0);
        }

        statistics.put("recordCount", records.size());
        statistics.put("dominantEmotionCounts", emotionCounts);
        statistics.put("averageProbabilitiesPercent", averageProbabilitiesPercent);
        statistics.put("probabilitySampleCounts", probabilitySampleCounts);
        statistics.put("negativeEmotionNames", List.of("Sad", "Angry", "Fear", "Disgust"));
        statistics.put("negativeRecordCount", negativeCount);
        statistics.put("negativeRecordPercentage",
                records.isEmpty() ? 0.0 : Math.round(negativeCount * 1000.0 / records.size()) / 10.0);
        return statistics;
    }

    private Map<String, Object> summarizeVideo(Map<String, Object> analysis) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("filename", analysis.get("filename"));
        summary.put("durationSeconds", analysis.get("durationSeconds"));
        summary.put("sampledFrames", analysis.get("sampledFrames"));
        summary.put("dominantEmotion", analysis.get("dominantEmotion"));
        summary.put("distributionPercent", analysis.get("distribution"));

        if (analysis.get("timeline") instanceof List<?> timeline) {
            List<Map<String, Object>> moments = new ArrayList<>();
            List<Map<String, Object>> negativeMoments = new ArrayList<>();
            Map<String, Integer> negativeEmotionCounts = new LinkedHashMap<>();
            for (Object item : timeline) {
                if (item instanceof Map<?, ?> frame) {
                    Map<String, Object> moment = new LinkedHashMap<>();
                    moment.put("timestamp", frame.get("timestamp"));
                    moment.put("emotion", frame.get("emotion"));
                    moment.put("confidence", frame.get("confidence"));
                    moments.add(moment);

                    Object emotionValue = frame.get("emotion");
                    if (emotionValue instanceof String emotion
                            && NEGATIVE_EMOTIONS.contains(emotion.toLowerCase())) {
                        negativeMoments.add(moment);
                        String emotionKey = emotion.toLowerCase();
                        negativeEmotionCounts.merge(emotionKey, 1, Integer::sum);
                    }
                }
            }
            summary.put("timeline", moments);
            summary.put("negativeEmotionCounts", labelNegativeCounts(negativeEmotionCounts));
            summary.put("negativeEmotionMoments", negativeMoments);
            summary.put("timelineSampling", "Mỗi mốc là frame được mô hình lấy mẫu; không nội suy giữa các mốc.");
        }
        return summary;
    }

    private Map<String, Integer> labelNegativeCounts(Map<String, Integer> counts) {
        Map<String, Integer> labeledCounts = new LinkedHashMap<>();
        counts.forEach((emotion, count) ->
                labeledCounts.put(NEGATIVE_EMOTION_LABELS.get(emotion), count));
        return labeledCounts;
    }
}
