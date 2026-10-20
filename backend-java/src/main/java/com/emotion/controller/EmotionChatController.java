package com.emotion.controller;

import com.emotion.service.EmotionChatService;
import com.emotion.service.ChatConversationService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/emotions")
@CrossOrigin(origins = "*")
public class EmotionChatController {

    private static final Logger LOGGER = LoggerFactory.getLogger(EmotionChatController.class);

    private final EmotionChatService emotionChatService;
    private final ChatConversationService chatConversationService;

    public EmotionChatController(
            EmotionChatService emotionChatService,
            ChatConversationService chatConversationService) {
        this.emotionChatService = emotionChatService;
        this.chatConversationService = chatConversationService;
    }

    @PostMapping(value = "/chat", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> chat(
            @RequestParam(value = "conversationId", required = false) String conversationId,
            @RequestParam(value = "message", required = false) String message,
            @RequestParam(value = "userId", required = false, defaultValue = "guest") String userId,
            @RequestParam(value = "from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(value = "to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "videoId", required = false) String videoId) {
        try {
            return ResponseEntity.ok(
                    emotionChatService.chat(conversationId, message, userId, from, to, file, videoId));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
        } catch (IllegalStateException exception) {
            return ResponseEntity.status(503).body(Map.of("message", exception.getMessage()));
        } catch (IOException exception) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "Không thể đọc video đã tải lên."));
        } catch (RuntimeException exception) {
            LOGGER.error("Emotion chat request failed", exception);
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "Không thể xử lý yêu cầu chat. Vui lòng kiểm tra kết nối các dịch vụ."));
        }
    }

    @GetMapping("/chat/history")
    public ResponseEntity<?> listChatHistory(@RequestParam("userId") String userId) {
        if (isGuest(userId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Đăng nhập để xem lịch sử chat."));
        }
        return ResponseEntity.ok(chatConversationService.list(userId.trim()));
    }

    @GetMapping("/chat/history/{conversationId}")
    public ResponseEntity<?> getChatHistory(
            @PathVariable String conversationId,
            @RequestParam("userId") String userId) {
        if (isGuest(userId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Đăng nhập để xem lịch sử chat."));
        }
        try {
            return ResponseEntity.ok(chatConversationService.get(conversationId, userId.trim()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.notFound().build();
        }
    }

    private boolean isGuest(String userId) {
        return userId == null || userId.isBlank() || "guest".equalsIgnoreCase(userId.trim());
    }
}
