package com.emotion.repository;

import com.emotion.model.ChatConversation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatConversationRepository extends MongoRepository<ChatConversation, String> {

    List<ChatConversation> findByUserIdOrderByUpdatedAtDesc(String userId);

    Optional<ChatConversation> findByIdAndUserId(String id, String userId);

}
