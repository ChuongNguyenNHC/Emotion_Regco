import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, LayoutDashboard, History, Sparkles, Activity, Smile, BarChart3, Wifi, WifiOff, RefreshCw, Clock, User, ChevronRight, AlertCircle } from "lucide-react";

const API_BASE = "http://localhost:8080/api/v1/emotions";
const CAPTURE_INTERVAL_MS = 3000;

const EMOTION_META = {
  Happy: { emoji: "😊", color: "bg-emerald-500", label: "Vui vẻ", ring: "ring-emerald-500" },
  Sad: { emoji: "😢", color: "bg-indigo-500", label: "Buồn bã", ring: "ring-indigo-500" },
  Angry: { emoji: "😠", color: "bg-rose-500", label: "Tức giận", ring: "ring-rose-500" },
  Fear: { emoji: "😨", color: "bg-violet-500", label: "Sợ hãi", ring: "ring-violet-500" },
  Surprise: { emoji: "😮", color: "bg-amber-500", label: "Ngạc nhiên", ring: "ring-amber-500" },
  Disgust: { emoji: "🤢", color: "bg-lime-600", label: "Ghê tởm", ring: "ring-lime-500" },
  Neutral: { emoji: "😐", color: "bg-blue-500", label: "Bình thường", ring: "ring-blue-500" },
};

function getEmotionMeta(emotion) {
  if (!emotion) return { emoji: "??", color: "bg-slate-500", label: "Chưa rõ", ring: "ring-slate-500" };
  const key = Object.keys(EMOTION_META).find(k => k.toLowerCase() === emotion.toLowerCase());
  return key ? EMOTION_META[key] : { emoji: "??", color: "bg-slate-500", label: emotion, ring: "ring-slate-500" };
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
      <div className="flex justify-between text-xs font-medium">
        <span className="text-slate-300 flex items-center gap-1.5"><span>{emoji}</span> {name}</span>
        <span className="text-slate-400 tabular-nums">{(percent * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
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
    } catch (e) { setError("Không thể kết nối tới Java Backend: " + e.message); }
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
      <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <StatusDot ok={cameraOn} />
            <span className="text-sm font-medium text-slate-300">{cameraOn ? `Webcam đang phát - ${frameCount} frames` : "Webcam tắt"}</span>
            {analyzing && <span className="flex items-center gap-1 text-xs text-indigo-400 animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /> Dang phân tích...</span>}
          </div>
          <button
            onClick={cameraOn ? stopCamera : startCamera}
            disabled={!backendOk && !cameraOn}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${cameraOn ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30" : !backendOk ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"}`}
          >
            {cameraOn ? "Tắt Camera" : !backendOk ? "Backend chưa sẵn sàng" : "Bật Camera"}
          </button>
        </div>
        <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${cameraOn ? "opacity-100" : "opacity-0"}`} muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {cameraOn && result && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <span className="text-lg">{meta?.emoji}</span>
              <span className="text-xs font-semibold text-white">{meta?.label}</span>
              <span className="text-xs text-emerald-400">{(result.confidence * 100).toFixed(1)}%</span>
            </div>
          )}
          {!cameraOn && !error && (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Camera className="w-12 h-12 opacity-40" />
              <p className="text-sm">Bật camera để bắt đầu nhận diện cảm xúc thật</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center">
              <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
              <p className="text-sm text-rose-300 font-medium">Loi</p>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
            </div>
          )}
        </div>
      </div>
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <div className={`bg-gradient-to-br from-indigo-950/40 to-slate-900 border ${meta ? "border-indigo-500/30" : "border-slate-800"} rounded-2xl p-6 flex flex-col items-center text-center shadow-xl transition-all duration-500`}>
          <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase mb-2">Cảm xúc hiện tại</span>
          <div className={`text-6xl mb-3 transition-all duration-500 ${meta ? "scale-100" : "scale-75 opacity-30"}`}>{meta?.emoji || "??"}</div>
          <h3 className="text-2xl font-bold text-white mb-2">{result ? `${meta?.label} (${result.emotion})` : "Chưa phân tích"}</h3>
          {result && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
              <Activity className="w-3.5 h-3.5" /> Độ tin cậy: {(result.confidence * 100).toFixed(1)}%
            </div>
          )}
          {!result && <p className="text-xs text-slate-500">Bật camera để bắt đầu</p>}
        </div>
        {result?.probabilities && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-400" /> Phân bổ xác suất</h4>
            <div className="flex flex-col gap-3">
              {Object.entries(result.probabilities).sort(([, a], [, b]) => b - a).map(([emotion, prob]) => {
                const m = getEmotionMeta(emotion);
                return <EmotionBar key={emotion} name={`${m.label} (${emotion})`} percent={prob} color={m.color} emoji={m.emoji} />;
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
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2"><History className="w-4 h-4 text-indigo-400" /> Lịch sử nhận diện (20 gần nhất)</h2>
        <button onClick={fetchHistory} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Làm mới
        </button>
      </div>
      {loading && <div className="flex items-center justify-center py-16 text-slate-500"><RefreshCw className="w-6 h-6 animate-spin mr-2" /> Đang tải...</div>}
      {error && <div className="flex flex-col items-center justify-center py-16"><AlertCircle className="w-10 h-10 text-rose-400 mb-3" /><p className="text-sm text-rose-300">{error}</p></div>}
      {!loading && !error && history.length === 0 && <div className="flex flex-col items-center justify-center py-16 text-slate-500"><Smile className="w-12 h-12 opacity-30 mb-3" /><p className="text-sm">Chưa có dữ liệu lịch sử.</p></div>}
      {!loading && !error && history.length > 0 && (
        <div className="flex flex-col divide-y divide-slate-800">
          {history.map((item, idx) => {
            const meta = getEmotionMeta(item.dominantEmotion);
            return (
              <div key={item.id || idx} className="flex items-center gap-4 py-3.5 hover:bg-slate-800/30 px-2 rounded-lg transition group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ring-2 ${meta.ring} ring-opacity-40 bg-slate-800 shrink-0`}>{meta.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">{meta.label} <span className="text-slate-500 font-normal">({item.dominantEmotion})</span></p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : "N/A"}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.userId || "guest"}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(item.createdAt)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition shrink-0" />
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
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-5"><BarChart3 className="w-4 h-4 text-indigo-400" /> Thống kê cảm xúc</h2>
        {total === 0 ? <p className="text-sm text-slate-500 text-center py-10">Chưa có dữ liệu</p> : (
          <div className="flex flex-col gap-3">{sorted.map(([emotion, count]) => { const m = getEmotionMeta(emotion); return <EmotionBar key={emotion} name={`${m.label} (${emotion})`} percent={count / total} color={m.color} emoji={m.emoji} />; })}</div>
        )}
      </div>
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-5"><Activity className="w-4 h-4 text-indigo-400" /> Tổng quan</h2>
        <div className="grid grid-cols-2 gap-4">
          {[{ label: "Tổng phân tích", value: total, icon: Smile }, { label: "Loại cảm xúc", value: sorted.length, icon: BarChart3 }, { label: "Cảm xúc phổ biến", value: sorted[0]?.[0] || "", icon: Activity }, { label: "Tỉ lệ cao nhất", value: sorted[0] ? `${((sorted[0][1] / total) * 100).toFixed(0)}%` : "", icon: RefreshCw }].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <Icon className="w-4 h-4 text-indigo-400 mb-2" />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
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
    { id: "realtime", label: "Realtime Camera", icon: Camera },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "history", label: "Lịch sử quét", icon: History },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20"><Sparkles className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">EmotionAI Studio</h1>
            <p className="text-xs text-slate-400">Hệ thống nhận diện cảm xúc khuôn mặt Realtime</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${backendOk ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
            {backendOk ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {backendOk ? "Backend Online" : "Backend Offline"}
          </div>
          <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === id ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {activeTab === "realtime" && <RealtimeTab backendOk={backendOk} />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "dashboard" && <DashboardTab history={history} />}
      </main>
      <footer className="border-t border-slate-800 py-3 text-center text-xs text-slate-600">EmotionAI Studio - React + Spring Boot + FastAPI + MongoDB Atlas</footer>
    </div>
  );
}
