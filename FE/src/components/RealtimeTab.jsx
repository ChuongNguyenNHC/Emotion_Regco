import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Activity,
  BarChart3,
  RefreshCw,
  User,
  AlertCircle,
  Play,
  Square,
} from "lucide-react";
import {
  API_BASE,
  CAPTURE_INTERVAL_MS,
  getEmotionMeta,
  StatusDot,
  EmotionBar,
} from "../constants/emotion";

export default function RealtimeTab({ backendOk, currentUser }) {
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
              ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-xs cursor-pointer"
              : !backendOk
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
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
