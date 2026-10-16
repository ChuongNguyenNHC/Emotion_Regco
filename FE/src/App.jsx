import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  LayoutDashboard,
  History,
  Activity,
  Smile,
  BarChart3,
  RefreshCw,
  Clock,
  User,
  ChevronRight,
  AlertCircle,
  Play,
  Square,
  Zap,
  LogIn,
  LogOut,
  Video,
  ChevronDown,
  Upload,
  FileVideo,
  ShieldCheck,
  Filter,
} from "lucide-react";
import AuthPage from "./AuthPage";

const API_BASE = "http://localhost:8080/api/v1/emotions";
const CAPTURE_INTERVAL_MS = 1500;

const EMOTION_META = {
  Happy: { emoji: "😊", color: "bg-emerald-500", text: "text-emerald-700", bgLight: "bg-emerald-50", border: "border-emerald-200", label: "Vui vẻ", ring: "ring-emerald-400" },
  Sad: { emoji: "😢", color: "bg-sky-500", text: "text-sky-700", bgLight: "bg-sky-50", border: "border-sky-200", label: "Buồn bã", ring: "ring-sky-400" },
  Angry: { emoji: "😠", color: "bg-rose-500", text: "text-rose-700", bgLight: "bg-rose-50", border: "border-rose-200", label: "Tức giận", ring: "ring-rose-400" },
  Fear: { emoji: "😨", color: "bg-purple-500", text: "text-purple-700", bgLight: "bg-purple-50", border: "border-purple-200", label: "Sợ hãi", ring: "ring-purple-400" },
  Surprise: { emoji: "😮", color: "bg-amber-500", text: "text-amber-700", bgLight: "bg-amber-50", border: "border-amber-200", label: "Ngạc nhiên", ring: "ring-amber-400" },
  Disgust: { emoji: "🤢", color: "bg-teal-600", text: "text-teal-700", bgLight: "bg-teal-50", border: "border-teal-200", label: "Ghê tởm", ring: "ring-teal-400" },
  Neutral: { emoji: "😐", color: "bg-slate-500", text: "text-slate-700", bgLight: "bg-slate-100", border: "border-slate-200", label: "Bình thường", ring: "ring-slate-400" },
};

function getEmotionMeta(emotion) {
  if (!emotion) return { emoji: "🤔", color: "bg-slate-400", text: "text-slate-600", bgLight: "bg-slate-50", border: "border-slate-200", label: "Chưa rõ", ring: "ring-slate-300" };
  const key = Object.keys(EMOTION_META).find(k => k.toLowerCase() === emotion.toLowerCase());
  return key ? EMOTION_META[key] : { emoji: "😐", color: "bg-slate-400", text: "text-slate-600", bgLight: "bg-slate-50", border: "border-slate-200", label: emotion, ring: "ring-slate-300" };
}

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
  } catch {
    return isoString;
  }
}

function StatusDot({ ok }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
    </span>
  );
}

function EmotionBar({ name, percent, color, emoji }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs font-semibold">
        <span className="text-slate-700 flex items-center gap-1.5"><span className="text-sm">{emoji}</span> {name}</span>
        <span className="text-slate-500 font-mono">{(percent * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${(percent * 100).toFixed(1)}%` }} />
      </div>
    </div>
  );
}

function RealtimeTab({ backendOk, currentUser }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const analyzingRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    analyzingRef.current = false;
    setCameraOn(false);
    setFrameCount(0);
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || analyzingRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
    analyzingRef.current = true;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analyze-base64`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64,
          userId: currentUser ? currentUser.id : "guest"
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setFrameCount(c => c + 1);
      } else {
        setError(data.message || "AI không phát hiện được khuôn mặt");
      }
    } catch (e) {
      setError("Không thể kết nối tới Backend API: " + e.message);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, [currentUser]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      intervalRef.current = setInterval(captureAndAnalyze, CAPTURE_INTERVAL_MS);
    } catch (e) {
      setError("Không thể mở webcam: " + e.message);
    }
  }, [captureAndAnalyze]);

  useEffect(() => () => stopCamera(), [stopCamera]);
  const meta = result ? getEmotionMeta(result.emotion) : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Video Container */}
      <div className="flex-1 bg-white border border-slate-200/80 rounded-3xl p-5 flex flex-col shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <StatusDot ok={cameraOn} />
            <span className="text-sm font-semibold text-slate-700">
              {cameraOn ? `Webcam Trực Tiếp - ${frameCount} Khung Hình` : "Trạng thái Camera: Tắt"}
            </span>
            {analyzing && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium border border-indigo-100 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Đang nhận diện...
              </span>
            )}
          </div>
          <button
            onClick={cameraOn ? stopCamera : startCamera}
            disabled={!backendOk && !cameraOn}
            className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${cameraOn
              ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-xs"
              : !backendOk
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95"
              }`}
          >
            {cameraOn ? <><Square className="w-3.5 h-3.5 fill-rose-600" /> Tắt Camera</> : <><Play className="w-3.5 h-3.5 fill-white" /> Bật Camera</>}
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-800 shadow-inner group">
          <video ref={videoRef} playsInline muted className={`w-full h-full object-cover -scale-x-100 ${!cameraOn ? "hidden" : "block"}`} />
          <canvas ref={canvasRef} className="hidden" />

          {!cameraOn && (
            <div className="flex flex-col items-center gap-3 text-slate-500 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-1 border border-slate-700">
                <Camera className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-slate-300">Camera hiện đang tắt</p>
              <p className="text-xs text-slate-500 max-w-xs">Nhấn "Bật Camera" ở góc phải để bắt đầu truyền khung hình phân tích cảm xúc</p>
            </div>
          )}

          {cameraOn && meta && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/10 text-white shadow-xl animate-fade-in">
              <span className="text-2xl">{meta.emoji}</span>
              <div>
                <p className="text-xs font-bold leading-none">{meta.label}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{(result.confidence * 100).toFixed(0)}% khớp</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute bottom-4 left-4 right-4 z-10 p-3 bg-rose-950/80 backdrop-blur-md border border-rose-500/30 rounded-xl text-rose-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Analytics */}
      <div className="w-full lg:w-88 flex flex-col gap-5">
        {/* Current Emotion Hero Card */}
        <div className={`bg-white border rounded-3xl p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all duration-300 ${meta ? `${meta.bgLight} ${meta.border}` : "border-slate-200/80"}`}>
          <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3">Cảm xúc nhận diện</span>

          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-5xl mb-3 shadow-sm transition-transform duration-500 ${meta ? "scale-100 bg-white" : "scale-90 bg-slate-100 opacity-40"}`}>
            {meta?.emoji || "😐"}
          </div>

          <h3 className="text-2xl font-extrabold text-slate-800 mb-1">
            {result ? meta?.label : "Chưa có dữ liệu"}
          </h3>
          <p className="text-xs text-slate-500 mb-4">{result ? `Nhãn: ${result.emotion}` : "Vui lòng bật webcam để phân tích"}</p>

          {result && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-emerald-700 text-xs font-bold border border-emerald-200 shadow-2xs">
              <Activity className="w-3.5 h-3.5 text-emerald-500" /> Độ tin cậy: {(result.confidence * 100).toFixed(1)}%
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-200/50 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            {currentUser ? (
              <span>Lưu lịch sử: <strong className="text-slate-700">{currentUser.fullName || currentUser.username}</strong></span>
            ) : (
              <span className="text-amber-600 font-medium">Chế độ Khách: <strong className="font-normal text-slate-500">Không lưu lịch sử</strong></span>
            )}
          </div>
        </div>

        {/* Probability Breakdown */}
        {result?.probabilities && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" /> Phân bổ xác suất chi tiết
            </h4>
            <div className="flex flex-col gap-3.5">
              {Object.entries(result.probabilities).sort(([, a], [, b]) => b - a).map(([emotion, prob]) => {
                const m = getEmotionMeta(emotion);
                return <EmotionBar key={emotion} name={`${m.label}`} percent={prob} color={m.color} emoji={m.emoji} />;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ currentUser }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMine, setFilterMine] = useState(!!currentUser);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/history`;
      if (filterMine && currentUser?.id) {
        url += `?userId=${currentUser.id}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHistory(await res.json());
    } catch (e) {
      setError("Không thể tải lịch sử: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [filterMine, currentUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" /> Lịch sử nhận diện cảm xúc
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filterMine && currentUser
              ? `Đang lọc lịch sử cá nhân của ${currentUser.fullName || currentUser.username}`
              : "Danh sách 20 lần quét gần nhất từ toàn bộ hệ thống"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser && (
            <button
              onClick={() => setFilterMine(prev => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterMine
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {filterMine ? "Chỉ của tôi (Bật)" : "Tất cả mọi người"}
            </button>
          )}

          <button
            onClick={fetchHistory}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm font-medium">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-indigo-500" /> Đang nạp dữ liệu...
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
          <p className="text-sm font-semibold text-slate-700">{error}</p>
        </div>
      )}
      {!loading && !error && history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Smile className="w-12 h-12 opacity-30 mb-2" />
          <p className="text-sm font-medium">Chưa có bản ghi lịch sử nào phù hợp.</p>
        </div>
      )}

      {!loading && !error && history.length > 0 && (
        <div className="flex flex-col divide-y divide-slate-100">
          {history.map((item, idx) => {
            const meta = getEmotionMeta(item.dominantEmotion);
            const isMe = currentUser && item.userId === currentUser.id;
            return (
              <div key={item.id || idx} className="flex items-center gap-4 py-3.5 hover:bg-slate-50 px-3 rounded-2xl transition group">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-xs border ${meta.border} ${meta.bgLight} shrink-0`}>
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">
                      {meta.label} <span className="text-xs text-slate-400 font-normal">({item.dominantEmotion})</span>
                    </p>
                    {isMe && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                        Của bạn
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium text-emerald-600">
                      <Activity className="w-3 h-3" /> {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : "N/A"}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px] truncate max-w-xs">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      {item.userId === currentUser?.id ? `${currentUser.username} (${item.userId})` : (item.userId || "guest")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> {formatTime(item.createdAt)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardTab({ history }) {
  const counts = history.reduce((acc, item) => {
    if (item.dominantEmotion) acc[item.dominantEmotion] = (acc[item.dominantEmotion] || 0) + 1;
    return acc;
  }, {});
  const total = history.length;
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-5">
          <Zap className="w-5 h-5 text-indigo-600" /> Tổng Quan Chỉ Số
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Tổng số lượt quét", value: total, icon: Smile, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
            { label: "Loại cảm xúc ghi nhận", value: sorted.length, icon: BarChart3, color: "text-violet-600 bg-violet-50 border-violet-100" },
            { label: "Cảm xúc phổ biến nhất", value: sorted[0] ? getEmotionMeta(sorted[0][0]).label : "-", icon: Activity, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { label: "Tỉ lệ phổ biến nhất", value: total > 0 && sorted[0] ? `${((sorted[0][1] / total) * 100).toFixed(0)}%` : "-", icon: RefreshCw, color: "text-amber-600 bg-amber-50 border-amber-100" }
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 flex flex-col justify-between">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border mb-3 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoTab() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm max-w-4xl mx-auto">
      <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Video className="w-5 h-5 text-indigo-600" /> Nhận diện cảm xúc qua Video
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tải lên tệp video (MP4, WebM, AVI) để hệ thống AI tự động phân tích và trích xuất dòng cảm xúc theo từng mốc thời gian.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-3 py-1 rounded-full">
          Sắp ra mắt
        </span>
      </div>

      {/* Upload Zone Mockup */}
      <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl p-10 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors group cursor-pointer">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-2xs">
          <Upload className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 mb-1">
          Kéo thả tệp video vào đây hoặc <span className="text-indigo-600 underline">duyệt từ máy tính</span>
        </h3>
        <p className="text-xs text-slate-400 max-w-md">
          Hỗ trợ định dạng MP4, MOV, WebM với thời lượng tối đa 5 phút (kích thước tối đa 100MB)
        </p>

        <button
          type="button"
          onClick={() => alert("Tính năng nhận diện qua tệp Video đang được hoàn thiện!")}
          className="mt-6 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
        >
          <FileVideo className="w-4 h-4" /> Chọn tệp video phân tích
        </button>
      </div>

      {/* Feature Highlight Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-left">
          <p className="text-xs font-bold text-slate-800">Timeline Cảm xúc</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Biểu đồ biến thiên cảm xúc chi tiết theo từng giây của video.</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-left">
          <p className="text-xs font-bold text-slate-800">Phát hiện nhiều khuôn mặt</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Hỗ trợ nhận dạng cảm xúc đồng thời nhiều nhân vật trong khung hình.</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-left">
          <p className="text-xs font-bold text-slate-800">Xuất báo cáo PDF / Excel</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Tải về tổng kết tỷ lệ các trạng thái vui, buồn, tập trung của video.</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("realtime"); // "realtime" | "video" | "dashboard" | "history"
  const [backendOk, setBackendOk] = useState(false);
  const [history, setHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("app"); // "app" | "auth"
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("emotion_user");
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        setBackendOk(res.ok);
      } catch {
        setBackendOk(false);
      }
    };
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeTab === "dashboard") {
      fetch(`${API_BASE}/history`)
        .then(r => r.json())
        .then(setHistory)
        .catch(() => { });
    }
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem("emotion_auth_token");
    localStorage.removeItem("emotion_user");
    setCurrentUser(null);
    setIsUserMenuOpen(false);
    setActiveTab("realtime");
  };

  if (view === "auth") {
    return (
      <AuthPage
        onBack={() => setView("app")}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setView("app");
        }}
      />
    );
  }

  // Navbar chính: Camera Trực Tiếp và Nhận diện qua Video
  const navItems = [
    { id: "realtime", label: "Camera Trực Tiếp", icon: Camera },
    { id: "video", label: "Nhận Diện Qua Video", icon: Video },
  ];

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Subtle Dot Grid Background for Home */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.55,
        }}
      />

      {/* Header (Màu Bạc Xanh Nhẹ / Soft Ice-Silver với viền border rõ nét) */}
      <header className="relative border-b border-slate-200/90 bg-[#F1F5F9]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        {/* Left: Brand Logo */}
        <div className="flex-1 flex justify-start">
          <button
            onClick={() => setActiveTab("realtime")}
            className="flex flex-col justify-center text-left cursor-pointer group focus:outline-none"
            title="Về trang chủ"
          >
            <div className="flex items-baseline tracking-tight transition-transform duration-200 group-hover:scale-[1.02]">
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">emotion</span>
              <span className="text-lg font-extrabold text-indigo-600 tracking-tight ml-0.5">AI</span>
              <span className="text-lg font-black text-indigo-600 leading-none">.</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium -mt-0.5">Hệ thống nhận diện cảm xúc</p>
          </button>
        </div>

        {/* Center: Main Navigation Items (Centered) */}
        <div className="flex justify-center">
          <nav className="flex items-center gap-1 bg-white/80 p-1 rounded-xl border border-slate-200 shadow-2xs">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Auth Action & User Profile */}
        <div className="flex-1 flex justify-end items-center">
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-800 leading-none">
                  {currentUser.fullName || currentUser.email}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu Modal */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-xl py-2 z-50 animate-fade-in divide-y divide-slate-100">
                  <div className="px-3.5 py-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tài khoản</p>
                    <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{currentUser.fullName || "Người dùng"}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setActiveTab("dashboard");
                        setIsUserMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors text-left ${
                        activeTab === "dashboard"
                          ? "bg-indigo-50 text-indigo-600 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                      <span>Thống Kê Cảm Xúc</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab("history");
                        setIsUserMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors text-left ${
                        activeTab === "history"
                          ? "bg-indigo-50 text-indigo-600 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <History className="w-4 h-4 text-indigo-600" />
                      <span>Lịch Sử Quét</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setView("auth")}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" /> Đăng nhập / Đăng ký
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 z-10">
        {activeTab === "realtime" && <RealtimeTab backendOk={backendOk} currentUser={currentUser} />}
        {activeTab === "video" && <VideoTab />}
        {activeTab === "history" && <HistoryTab currentUser={currentUser} />}
        {activeTab === "dashboard" && <DashboardTab history={history} />}
      </main>

      {/* Footer (Màu Bạc Xanh Nhẹ / Soft Ice-Silver - Đồng bộ với Header) */}
      <footer className="relative z-10 border-t border-slate-200/90 bg-[#F1F5F9]/95 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-baseline tracking-tight">
            <span className="text-sm font-bold text-slate-800">emotion</span>
            <span className="text-sm font-bold text-indigo-600 ml-0.5">AI</span>
            <span className="text-sm font-black text-indigo-600">.</span>
          </div>
          <p className="text-[11px] text-slate-500">© 2026 EmotionAI Studio · Đồ án môn Công nghệ Phần mềm Nâng cao</p>
        </div>
      </footer>
    </div>
  );
}
