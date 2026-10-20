import React, { useState, useRef } from "react";
import {
  Video,
  CheckCircle2,
  Upload,
  FileVideo,
  Loader2,
  Zap,
  AlertCircle,
  BarChart3,
  Clock,
  Filter,
} from "lucide-react";
import { API_BASE, getEmotionMeta, EMOTION_META } from "../constants/emotion";

export default function VideoTab({ currentUser, onVideoAnalyzed }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [noticeMsg, setNoticeMsg] = useState(null);
  const [filterEmotion, setFilterEmotion] = useState("ALL");
  const fileInputRef = useRef(null);
  const playerRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setErrorMsg("Vui lòng chọn một tệp video hợp lệ (.mp4, .webm, .mov).");
      return;
    }
    setErrorMsg(null);
    setNoticeMsg(null);
    setAnalysisResult(null);
    setSelectedFile(file);
    onVideoAnalyzed?.(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handleAnalyzeVideo = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setErrorMsg(null);
    setNoticeMsg(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    const userId = currentUser?.id || "guest";
    const videoId = crypto.randomUUID();
    formData.append("userId", userId);
    formData.append("videoId", videoId);

    try {
      let data = null;
      try {
        const response = await fetch(`${API_BASE}/analyze-video`, {
          method: "POST",
          body: formData,
        });
        if (response.ok) {
          data = await response.json();
        }
      } catch {
        // Fallback directly to FastAPI if Java gateway has issues
      }

      if (!data || !data.success) {
        // Try direct call to FastAPI AI Microservice (Port 8000)
        const directAiUrl = "http://localhost:8000/api/v1/predict-video";
        const aiFormData = new FormData();
        aiFormData.append("file", selectedFile);
        const directRes = await fetch(directAiUrl, {
          method: "POST",
          body: aiFormData,
        });
        data = await directRes.json();
        if (!directRes.ok || !data.success) {
          throw new Error(data.detail || data.message || "Phân tích video thất bại.");
        }
      }

      setAnalysisResult(data);
      onVideoAnalyzed?.(
        data.videoId ? { videoId: data.videoId, filename: selectedFile.name } : null,
      );
      if (!data.videoId) {
        setNoticeMsg(
          "Video đã được phân tích nhưng chưa được lưu để chat truy vấn. Hãy kiểm tra backend Java rồi phân tích lại video.",
        );
      }
    } catch (err) {
      setErrorMsg(err.message || "Có lỗi xảy ra khi kết nối máy chủ AI.");
    } finally {
      setAnalyzing(false);
    }
  };

  const seekToSecond = (sec) => {
    if (playerRef.current) {
      playerRef.current.currentTime = sec;
      playerRef.current.play();
    }
  };

  const filteredTimeline = analysisResult?.timeline?.filter((item) => {
    if (filterEmotion === "ALL") return true;
    return item.emotion.toLowerCase() === filterEmotion.toLowerCase();
  }) || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="pb-5 mb-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Video className="w-5 h-5 text-indigo-600" /> Nhận diện cảm xúc qua Video
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tải lên tệp video để hệ thống AI tự động phân tích khung hình theo từng giây và lập biểu đồ cảm xúc.
          </p>
        </div>

        {/* Upload Zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl p-10 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors group cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-2xs">
              <Upload className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              Kéo thả tệp video vào đây hoặc <span className="text-indigo-600 underline">duyệt từ máy tính</span>
            </h3>
            <p className="text-xs text-slate-400 max-w-md">
              Hỗ trợ MP4, WebM, MOV. Tối ưu nhất cho các clip có khuôn mặt rõ nét.
            </p>
            <button
              type="button"
              className="mt-5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2"
            >
              <FileVideo className="w-4 h-4" /> Chọn tệp video
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Video Player */}
              <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-800 shadow-md">
                <video
                  ref={playerRef}
                  src={videoPreviewUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>

              {/* File Info & Action */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/70 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tệp video đã chọn</h4>
                  <p className="text-sm font-bold text-slate-800 truncate mt-1">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleAnalyzeVideo}
                    disabled={analyzing}
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang phân tích các khung hình...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" /> Bắt đầu phân tích AI
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={analyzing}
                    className="px-4 py-3 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Đổi video
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {noticeMsg && (
                  <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    {noticeMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Results Section */}
            {analysisResult && (
              <div className="pt-6 border-t border-slate-100 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-4">
                    <div className="text-4xl">{analysisResult.emoji}</div>
                    <div>
                      <p className="text-xs text-indigo-600 font-semibold">Cảm xúc chủ đạo</p>
                      <h3 className="text-lg font-black text-slate-800">{getEmotionMeta(analysisResult.dominantEmotion).label}</h3>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <p className="text-xs text-slate-500 font-medium">Thời lượng phân tích</p>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">{analysisResult.durationSeconds} giây</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">{analysisResult.sampledFrames} mốc thời gian (1 FPS)</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <p className="text-xs text-slate-500 font-medium">Model AI</p>
                    <h3 className="text-base font-bold text-slate-800 mt-1 truncate">{analysisResult.model || "EfficientNet-B0"}</h3>
                    <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Xử lý tự động theo frame</p>
                  </div>
                </div>

                {/* Distribution Breakdown */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/70">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" /> Tỷ lệ phân bổ cảm xúc qua video
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                    {Object.entries(analysisResult.distribution || {}).map(([emo, pct]) => {
                      const meta = getEmotionMeta(emo);
                      return (
                        <div key={emo} className="bg-white rounded-xl p-3 border border-slate-200/80 text-center shadow-2xs">
                          <span className="text-xl">{meta.emoji}</span>
                          <p className="text-xs font-bold text-slate-700 mt-1">{meta.label}</p>
                          <p className="text-xs font-semibold text-indigo-600 mt-0.5">{pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timeline Section */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" /> Dòng thời gian cảm xúc (Click mốc để tua video)
                    </h4>

                    {/* Filter by emotion */}
                    <div className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={filterEmotion}
                        onChange={(e) => setFilterEmotion(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-hidden"
                      >
                        <option value="ALL">Tất cả cảm xúc</option>
                        {Object.keys(EMOTION_META).map((emo) => (
                          <option key={emo} value={emo}>{EMOTION_META[emo].label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {filteredTimeline.map((item, idx) => {
                      const meta = getEmotionMeta(item.emotion);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => seekToSecond(item.second)}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/40 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{item.emoji}</span>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{item.timestamp}</p>
                              <p className="text-[10px] text-slate-500">{meta.label}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-indigo-600">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
