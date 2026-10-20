package com.emotion.service;

import com.emotion.model.ChatConversation;
import com.emotion.model.ChatMessage;
import com.emotion.repository.ChatConversationRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ChatConversationService {

    private final ChatConversationRepository repository;

    public ChatConversationService(ChatConversationRepository repository) {
        this.repository = repository;
    }

    public ChatConversation appendExchange(
            String conversationId,
            String userId,
            String question,
            String fileName,
            Map<String, Object> videoAnalysis,
            String answer,
            LocalDateTime periodStart,
            LocalDateTime periodEnd) {
        ChatConversation conversation;
        if (conversationId == null || conversationId.isBlank()) {
            conversation = new ChatConversation();
            conversation.setUserId(userId);
            conversation.setTitle(createTitle(question, fileName));
            conversation.setPeriodStart(periodStart);
            conversation.setPeriodEnd(periodEnd);
        } else {
            conversation = repository.findByIdAndUserId(conversationId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy cuộc trò chuyện này."));
            conversation.setPeriodStart(periodStart);
            conversation.setPeriodEnd(periodEnd);
        }

        List<ChatMessage> messages = conversation.getMessages();
        if (messages == null) {
            messages = new ArrayList<>();
            conversation.setMessages(messages);
        }
        ChatMessage userMessage = createMessage("user", question, fileName, null);
        if (videoAnalysis != null) {
            userMessage.setVideoId((String) videoAnalysis.get("videoId"));
        }
        messages.add(userMessage);
        messages.add(createMessage("assistant", answer, null, summarizeVideo(videoAnalysis)));
        conversation.setUpdatedAt(LocalDateTime.now());
        return repository.save(conversation);
    }

    public List<Map<String, Object>> list(String userId) {
        return repository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(this::toSummary)
                .toList();
    }

    public Map<String, Object> get(String conversationId, String userId) {
        return toDetails(repository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy cuộc trò chuyện này.")));
    }

    private ChatMessage createMessage(
            String role, String text, String fileName, Map<String, Object> videoAnalysis) {
        ChatMessage message = new ChatMessage();
        message.setRole(role);
        message.setText(text);
        message.setFileName(fileName);
        message.setVideoId(videoAnalysis == null ? null : (String) videoAnalysis.get("videoId"));
        message.setVideoAnalysis(videoAnalysis);
        message.setCreatedAt(LocalDateTime.now());
        return message;
    }

    private String createTitle(String question, String fileName) {
        String title = question == null || question.isBlank() ? "" : question.trim();
        if (title.isEmpty()) {
            title = fileName == null || fileName.isBlank() ? "Cuộc trò chuyện mới" : "Phân tích video: " + fileName;
        }
        return title.length() > 70 ? title.substring(0, 67) + "..." : title;
    }

    private Map<String, Object> summarizeVideo(Map<String, Object> videoAnalysis) {
        if (videoAnalysis == null || videoAnalysis.isEmpty()) {
            return null;
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        for (String field : List.of(
                "videoId", "filename", "durationSeconds", "sampledFrames", "dominantEmotion", "distribution",
                "negativeEmotionCounts", "negativeEmotionMoments")) {
            if (videoAnalysis.containsKey(field)) {
                summary.put(field, videoAnalysis.get(field));
            }
        }
        return summary;
    }

    private Map<String, Object> toSummary(ChatConversation conversation) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", conversation.getId());
        summary.put("title", conversation.getTitle());
        summary.put("updatedAt", conversation.getUpdatedAt());
        summary.put("messageCount", conversation.getMessages() == null ? 0 : conversation.getMessages().size());
        return summary;
    }

    private Map<String, Object> toDetails(ChatConversation conversation) {
        Map<String, Object> details = toSummary(conversation);
        details.put("periodStart", conversation.getPeriodStart());
        details.put("periodEnd", conversation.getPeriodEnd());
        details.put("messages", conversation.getMessages() == null ? List.of() : conversation.getMessages());
        return details;
    }
}
