package com.emotion.service;

import com.emotion.dto.AuthResponse;
import com.emotion.dto.LoginRequest;
import com.emotion.dto.RegisterRequest;
import com.emotion.model.User;
import com.emotion.repository.UserRepository;
import com.emotion.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    public AuthResponse register(RegisterRequest req) {
        if (req.getEmail() == null || req.getEmail().trim().isEmpty()) {
            return AuthResponse.builder().success(false).message("Email không được để trống").build();
        }
        if (req.getPassword() == null || req.getPassword().length() < 6) {
            return AuthResponse.builder().success(false).message("Mật khẩu phải có ít nhất 6 ký tự").build();
        }

        String email = req.getEmail().trim().toLowerCase();
        String fullName = req.getFullName() != null && !req.getFullName().trim().isEmpty()
                ? req.getFullName().trim()
                : email.split("@")[0];

        if (userRepository.existsByEmail(email)) {
            return AuthResponse.builder().success(false).message("Email đã được sử dụng!").build();
        }

        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setUsername(email); // Giữ username fallback về email
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setFullName(fullName);
        user.setRole("ROLE_USER");
        user.setCreatedAt(LocalDateTime.now());

        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole());

        AuthResponse.UserInfo userInfo = AuthResponse.UserInfo.builder()
                .id(user.getId())
                .username(user.getEmail())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();

        return AuthResponse.builder()
                .success(true)
                .message("Đăng ký tài khoản thành công!")
                .token(token)
                .user(userInfo)
                .build();
    }

    public AuthResponse login(LoginRequest req) {
        if (req.getEmail() == null || req.getEmail().trim().isEmpty()) {
            return AuthResponse.builder().success(false).message("Vui lòng nhập địa chỉ email").build();
        }
        if (req.getPassword() == null || req.getPassword().isEmpty()) {
            return AuthResponse.builder().success(false).message("Vui lòng nhập mật khẩu").build();
        }

        String email = req.getEmail().trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isEmpty()) {
            return AuthResponse.builder().success(false).message("Tài khoản hoặc mật khẩu không chính xác").build();
        }

        User user = userOpt.get();
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            return AuthResponse.builder().success(false).message("Tài khoản hoặc mật khẩu không chính xác").build();
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole());

        AuthResponse.UserInfo userInfo = AuthResponse.UserInfo.builder()
                .id(user.getId())
                .username(user.getEmail())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();

        return AuthResponse.builder()
                .success(true)
                .message("Đăng nhập thành công!")
                .token(token)
                .user(userInfo)
                .build();
    }
}
