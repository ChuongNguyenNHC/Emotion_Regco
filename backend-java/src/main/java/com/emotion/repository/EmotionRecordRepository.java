package com.emotion.repository;

import com.emotion.model.EmotionRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EmotionRecordRepository extends MongoRepository<EmotionRecord, String> {
    List<EmotionRecord> findTop20ByOrderByCreatedAtDesc();
    List<EmotionRecord> findByUserIdOrderByCreatedAtDesc(String userId);
}
