import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, LayoutDashboard, History, Sparkles, Activity, Smile, BarChart3, Wifi, WifiOff, RefreshCw, Clock, User, ChevronRight, AlertCircle, Play, Square, Eye, Zap } from "lucide-react";

const API_BASE = "http://localhost:8080/api/v1/emotions";
const CAPTURE_INTERVAL_MS = 3000;

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
  try { return new Date(isoString).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return isoString; }
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

function RealtimeTab({ backendOk }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setFrameCount(0);
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analyze-base64`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, userId: "guest" }),
      });
      const data = await res.json();
      if (data.success) { setResult(data); setFrameCount(c => c + 1); }
      else setError(data.message || "AI không phát hiện được khuôn mặt");
    } catch (e) { setError("Không thể kết nối tới Backend API: " + e.message); }
    finally { setAnalyzing(false); }
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true);
      intervalRef.current = setInterval(captureAndAnalyze, CAPTURE_INTERVAL_MS);
    } catch (e) { setError("Không thể mở webcam: " + e.message); }
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
            className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              cameraOn
                ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-xs"
                : !backendOk
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95"
            }`}
          >
            {cameraOn ? <><Square className="w-3.5 h-3.5 fill-rose-600" /> Tắt Camera</> : <><Play className="w-3.5 h-3.5 fill-white" /> Bật Camera</>}
          </button>
        </div>

        <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/60 shadow-inner flex items-center justify-center">
          <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${cameraOn ? "opacity-100" : "opacity-0"}`} muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          {cameraOn && result && (
            <div className="absolute bottom-4 left-4 flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/40 shadow-lg">
              <span className="text-2xl">{meta?.emoji}</span>
              <div>
                <p className="text-xs font-bold text-slate-800">{meta?.label}</p>
                <p className="text-[10px] text-slate-500">Độ tin cậy: <span className="font-semibold text-emerald-600">{(result.confidence * 100).toFixed(1)}%</span></p>
              </div>
            </div>
          )}

          {!cameraOn && !error && (
            <div className="flex flex-col items-center gap-3 text-slate-400 p-8 text-center">
              <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <Camera className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-300">Nhấn nút "Bật Camera" để bắt đầu nhận diện cảm xúc</p>
              <p className="text-xs text-slate-500">Hệ thống sẽ quét khuôn mặt trực tiếp từ Webcam của bạn</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center backdrop-blur-xs">
              <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
              <p className="text-sm font-semibold text-rose-300">Có lỗi xảy ra</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
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
          <p className="text-xs text-slate-500 mb-4">{result ? `Nhãn kỹ thuật: ${result.emotion}` : "Vui lòng bật webcam để phân tích"}</p>

          {result && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-emerald-700 text-xs font-bold border border-emerald-200 shadow-2xs">
              <Activity className="w-3.5 h-3.5 text-emerald-500" /> Độ tin cậy: {(result.confidence * 100).toFixed(1)}%
            </div>
          )}
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

function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHistory(await res.json());
    } catch (e) { setError("Không thể tải lịch sử: " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" /> Lịch sử nhận diện cảm xúc
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Danh sách 20 lần quét gần nhất từ hệ thống</p>
        </div>
        <button onClick={fetchHistory} className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Làm mới
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-slate-400 text-sm font-medium"><RefreshCw className="w-5 h-5 animate-spin mr-2 text-indigo-500" /> Đang nạp dữ liệu...</div>}
      {error && <div className="flex flex-col items-center justify-center py-16 text-center"><AlertCircle className="w-10 h-10 text-rose-500 mb-2" /><p className="text-sm font-semibold text-slate-700">{error}</p></div>}
      {!loading && !error && history.length === 0 && <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Smile className="w-12 h-12 opacity-30 mb-2" /><p className="text-sm font-medium">Chưa có bản ghi lịch sử nào.</p></div>}
      
      {!loading && !error && history.length > 0 && (
        <div className="flex flex-col divide-y divide-slate-100">
          {history.map((item, idx) => {
            const meta = getEmotionMeta(item.dominantEmotion);
            return (
              <div key={item.id || idx} className="flex items-center gap-4 py-3.5 hover:bg-slate-50 px-3 rounded-2xl transition group">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-xs border ${meta.border} ${meta.bgLight} shrink-0`}>
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {meta.label} <span className="text-xs text-slate-400 font-normal">({item.dominantEmotion})</span>
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium text-emerald-600"><Activity className="w-3 h-3" /> {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : "N/A"}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400" /> {item.userId || "guest"}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> {formatTime(item.createdAt)}</span>
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
  const counts = history.reduce((acc, item) => { if (item.dominantEmotion) acc[item.dominantEmotion] = (acc[item.dominantEmotion] || 0) + 1; return acc; }, {});
  const total = history.length;
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-indigo-600" /> Phân Bổ Tần Suất Cảm Xúc
        </h2>
        {total === 0 ? <p className="text-sm text-slate-400 text-center py-12">Chưa có đủ dữ liệu thống kê</p> : (
          <div className="flex flex-col gap-4">
            {sorted.map(([emotion, count]) => {
              const m = getEmotionMeta(emotion);
              return <EmotionBar key={emotion} name={`${m.label}`} percent={count / total} color={m.color} emoji={m.emoji} />;
            })}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-5">
          <Zap className="w-5 h-5 text-indigo-600" /> Tổng Quan Chỉ Số
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Tổng số lượt quét", value: total, icon: Smile, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
            { label: "Loại cảm xúc ghi nhận", value: sorted.length, icon: BarChart3, color: "text-violet-600 bg-violet-50 border-violet-100" },
            { label: "Cảm xúc phổ biến nhất", value: sorted[0] ? getEmotionMeta(sorted[0][0]).label : "-", icon: Activity, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { label: "Tỉ lệ phổ biến nhất", value: sorted[0] ? `${((sorted[0][1] / total) * 100).toFixed(0)}%` : "-", icon: RefreshCw, color: "text-amber-600 bg-amber-50 border-amber-100" }
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

export default function App() {
  const [activeTab, setActiveTab] = useState("realtime");
  const [backendOk, setBackendOk] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const check = async () => {
      try { const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) }); setBackendOk(res.ok); }
      catch { setBackendOk(false); }
    };
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeTab === "dashboard") fetch(`${API_BASE}/history`).then(r => r.json()).then(setHistory).catch(() => { });
  }, [activeTab]);

  const tabs = [
    { id: "realtime", label: "Camera Trực Tiếp", icon: Camera },
    { id: "dashboard", label: "Thống Kê", icon: LayoutDashboard },
    { id: "history", label: "Lịch Sử Quét", icon: History },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl shadow-md shadow-indigo-500/20 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">EmotionAI Studio</h1>
            <p className="text-xs text-slate-500">Hệ Thống Nhận Diện Biểu Cảm Khuôn Mặt Realtime</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-full border ${backendOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {backendOk ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-rose-600" />}
            {backendOk ? "Backend Hoạt Động" : "Backend Ngoại Tuyến"}
          </div>

          <nav className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === id
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {activeTab === "realtime" && <RealtimeTab backendOk={backendOk} />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "dashboard" && <DashboardTab history={history} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-4 text-center text-xs text-slate-400 font-medium">
        EmotionAI Studio — React + Spring Boot + FastAPI + PyTorch MobileNetV3
      </footer>
    </div>
  );
}
