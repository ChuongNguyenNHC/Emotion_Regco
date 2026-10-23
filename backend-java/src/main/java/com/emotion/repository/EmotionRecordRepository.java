package com.emotion.repository;

import com.emotion.model.EmotionRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

@Repository
public interface EmotionRecordRepository extends MongoRepository<EmotionRecord, String> {
    @org.springframework.data.mongodb.repository.Query(value = "{}", fields = "{ 'videoTimeline': 0 }", sort = "{ 'createdAt': -1 }")
    List<EmotionRecord> findTop20Summary();

    @org.springframework.data.mongodb.repository.Query(value = "{ 'userId': ?0 }", fields = "{ 'videoTimeline': 0 }", sort = "{ 'createdAt': -1 }")
    List<EmotionRecord> findSummaryByUserId(String userId);

    List<EmotionRecord> findTop20ByOrderByCreatedAtDesc();
    List<EmotionRecord> findByUserIdOrderByCreatedAtDesc(String userId);
    Optional<EmotionRecord> findByUserIdAndVideoId(String userId, String videoId);
    List<EmotionRecord> findByUserIdAndCreatedAtBetweenOrderByCreatedAtAsc(
            String userId, LocalDateTime from, LocalDateTime to);
    long deleteByUserId(String userId);
}
