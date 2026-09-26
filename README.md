# 🎭 EmotionAI Studio - Hệ thống Nhận diện Cảm xúc Khái niệm Microservices

Đồ án ứng dụng AI nhận diện cảm xúc khuôn mặt qua Webcam Realtime sử dụng kiến trúc Microservices hiện đại: **React (Frontend) + Spring Boot (Web & Data Backend) + FastAPI (AI Microservice) + MongoDB Atlas (Cloud Database)**.

---

## 🏗️ Kiến trúc Hệ thống (System Architecture)

```
                     ┌───────────────────────────┐
                     │   React + Tailwind CSS    │
                     │    (Frontend - Port 5173) │
                     └─────────────┬─────────────┘
                                   │
                                   │ POST Frame / Base64
                                   ▼
                     ┌───────────────────────────┐
                     │    Spring Boot Backend    │
                     │     (Java 21 - Port 8080) │
                     └──────┬─────────────┬──────┘
                            │             │
              POST Image    │             │ Store History / Users
              to Predict    ▼             ▼
       ┌────────────────────────┐    ┌──────────────────────────┐
       │   FastAPI AI Service   │    │      MongoDB Atlas       │
       │ (Python 3.11 - P8000)  │    │     (Cloud Database)     │
       └────────────────────────┘    └──────────────────────────┘
```

---

## 🛠️ Đòi hỏi Môi trường (Prerequisites)

* **Node.js**: `v18+` hoặc `v20+`
* **Python**: `3.10` / `3.11` / `3.12`
* **Java JDK**: `Java 21 LTS` (Eclipse Temurin)
* **MongoDB Atlas Account**: Tài khoản Cloud Database miễn phí.

---

## 🚀 Hướng dẫn Khởi chạy Dự án (Getting Started)

### 1️⃣ Khởi chạy Frontend (`FE`)
```bash
cd FE

# 1. Cài đặt thư viện dependencies
npm install

# 2. Chạy Dev Server
npm run dev
```
🌐 **Địa chỉ Web Frontend:** `http://localhost:5173/`

---

### 2️⃣ Khởi chạy AI Microservice (`backend-ai`)
```bash
cd backend-ai

# 1. Tạo và Kích hoạt Môi trường ảo Python (Virtualenv)
python -m venv venv

# Trên Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Trên Linux/macOS:
# source venv/bin/activate

# 2. Cài đặt các thư viện AI & Web Server
pip install -r requirements.txt

# 3. Khởi chạy FastAPI Server
uvicorn main:app --reload --port 8000
```
🌐 **Địa chỉ AI Service:** `http://localhost:8000/`  
📖 **Tài liệu API Swagger UI:** `http://localhost:8000/docs`

---

### 3️⃣ Khởi chạy Web Backend (`backend-java`)

#### 🔑 Tạo file cấu hình bảo mật `.env`
1. Tại thư mục `backend-java/`, copy file `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
2. Mở file `.env` và điền chuỗi kết nối **MongoDB Atlas** của bạn:
   ```env
   SPRING_DATA_MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/emotion_db?retryWrites=true&w=majority
   AI_SERVICE_URL=http://localhost:8000
   SERVER_PORT=8080
   ```
   > ⚠️ **LƯU Ý:** File `.env` chứa mật khẩu đã được thêm vào `.gitignore`, tuyệt đối **KHÔNG** push file `.env` chứa mật khẩu thật lên GitHub public.

#### 🏃 Chạy Spring Boot Application:
* **Sử dụng VS Code / IntelliJ:** Mở folder `backend-java`, tìm file `src/main/java/com/emotion/BackendJavaApplication.java` và chọn **Run**.
* **Sử dụng Terminal Command:**
  ```bash
  cd backend-java
  ./mvnw spring-boot:run
  ```
🌐 **Địa chỉ Backend API:** `http://localhost:8080/api/v1/emotions/health`

---

## 📊 Danh sách API Chính

| Method | Endpoint | Description | Service |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/emotions/health` | Kiểm tra trạng thái hệ thống | Spring Boot (8080) |
| `POST` | `/api/v1/emotions/analyze-base64` | Nhận ảnh từ React, gọi AI & Lưu MongoDB | Spring Boot (8080) |
| `GET` | `/api/v1/emotions/history` | Truy vấn 20 lịch sử nhận diện mới nhất | Spring Boot (8080) |
| `POST` | `/api/v1/predict-base64` | Xử lý AI Inference nhận diện cảm xúc | FastAPI (8000) |
