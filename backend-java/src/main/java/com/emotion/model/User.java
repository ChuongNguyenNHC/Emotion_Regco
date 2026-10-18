package com.emotion.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id = UUID.randomUUID().toString();

    private String username;

    @Indexed(unique = true)
    private String email;

    private String password;

    private String fullName;
    
    private String role = "ROLE_USER"; // ROLE_USER, ROLE_ADMIN

    private LocalDateTime createdAt = LocalDateTime.now();
}
