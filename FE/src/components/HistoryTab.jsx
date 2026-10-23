import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  History,
  Camera,
  Video,
  FileVideo,
  RefreshCw,
  User,
  Activity,
  Clock,
  AlertCircle,
  Smile,
  ChevronLeft,
  ChevronRight,
  Zap,
  BarChart3,
  TrendingUp,
  PieChart,
  ChevronDown,
  ChevronUp,
  Film,
  Sparkles,
  Play,
} from "lucide-react";
import { API_BASE, getEmotionMeta, formatTime, EMOTION_META } from "../constants/emotion";

export default function HistoryTab({ currentUser }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSource, setActiveSource] = useState("all"); // "all" | "camera" | "video"
  
  // State quản lý xem chi tiết timeline của video
  const [expandedRecordId, setExpandedRecordId] = useState(null);
  const [timelineDetails, setTimelineDetails] = useState({}); // { [recordId]: { loading: boolean, data: Array, error: string } }

  const pageSize = 15;

  const fetchHistory = useCallback(async () => {
    if (!currentUser?.id) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/history?userId=${currentUser.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
      setCurrentPage(1);
    } catch (e) {
      setError("Không thể tải dữ liệu lịch sử và thống kê: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Lazy fetch timeline khi người dùng bấm xem chi tiết video
  const toggleExpandTimeline = async (recordId) => {
    if (expandedRecordId === recordId) {
      setExpandedRecordId(null);
      return;
    }
    setExpandedRecordId(recordId);

    // Nếu đã tải timeline cho record này rồi thì không tải lại
    if (timelineDetails[recordId]?.data) return;

    setTimelineDetails((prev) => ({
      ...prev,
      [recordId]: { loading: true, data: null, error: null },
    }));

    try {
      const res = await fetch(`${API_BASE}/history/${recordId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail = await res.json();
      setTimelineDetails((prev) => ({
        ...prev,
        [recordId]: {
          loading: false,
          data: detail.videoTimeline || [],
          probabilities: detail.probabilities || null,
          videoFileName: detail.videoFileName,
          error: null,
        },
      }));
    } catch (err) {
      setTimelineDetails((prev) => ({
        ...prev,
        [recordId]: { loading: false, data: null, error: err.message },
      }));
    }
  };

  // Lọc lịch sử theo nguồn
  const filteredHistory = useMemo(() => {
    if (activeSource === "video") {
      return history.filter((item) => item.sourceType === "UPLOADED_VIDEO");
    }
    if (activeSource === "camera") {
      return history.filter((item) => item.sourceType !== "UPLOADED_VIDEO");
    }
    return history;
  }, [history, activeSource]);

  // Tính toán thống kê từ lịch sử
  const stats = useMemo(() => {
    const total = filteredHistory.length;
    const counts = filteredHistory.reduce((acc, item) => {
      const emo = item.dominantEmotion || "Unknown";
      acc[emo] = (acc[emo] || 0) + 1;
      return acc;
    }, {});

    const sortedEmotions = Object.entries(counts).sort(([, a], [, b]) => b - a);
    const topEmotion = sortedEmotions[0];
    const topEmotionMeta = topEmotion ? getEmotionMeta(topEmotion[0]) : null;

    let sumConfidence = 0;
    let confidenceCount = 0;
    filteredHistory.forEach((item) => {
      const conf = item.confidence ?? item.probabilities?.[item.dominantEmotion];
      if (conf != null && !isNaN(conf)) {
        sumConfidence += conf;
        confidenceCount++;
      }
    });
    const avgConfidence = confidenceCount > 0 ? (sumConfidence / confidenceCount) * 100 : 0;

    return {
      total,
      counts,
      sortedEmotions,
      topEmotion,
      topEmotionMeta,
      distinctCount: sortedEmotions.length,
      avgConfidence,
    };
  }, [filteredHistory]);

  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-sm max-w-lg mx-auto">
        <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Vui lòng đăng nhập</h3>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Bạn cần đăng nhập tài khoản để xem thống kê và lịch sử nhận diện cảm xúc cá nhân của mình.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(filteredHistory.length / pageSize) || 1;
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const cameraCount = history.filter((i) => i.sourceType !== "UPLOADED_VIDEO").length;
  const videoCount = history.filter((i) => i.sourceType === "UPLOADED_VIDEO").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" /> Thống Kê & Lịch Sử Cảm Xúc
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dữ liệu phân tích thực tế từ lịch sử quét của{" "}
              <span className="font-semibold text-slate-700">{currentUser.fullName || currentUser.username}</span> ({history.length} bản ghi tổng cộng)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} /> Làm mới
            </button>
          </div>
        </div>

        {/* Tổng quan chỉ số (KPI cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {[
            {
              label: "Tổng lượt quét",
              value: stats.total,
              subtext: activeSource === "all" ? "Tất cả nguồn" : activeSource === "camera" ? "Camera trực tiếp" : "Từ file video",
              icon: Smile,
              color: "text-indigo-600 bg-indigo-50 border-indigo-100",
            },
            {
              label: "Cảm xúc phổ biến nhất",
              value: stats.topEmotionMeta ? stats.topEmotionMeta.label : "-",
              subtext: stats.topEmotion && stats.total > 0
                ? `${((stats.topEmotion[1] / stats.total) * 100).toFixed(1)}% (${stats.topEmotion[1]} lượt)`
                : "Chưa có dữ liệu",
              icon: TrendingUp,
              color: "text-emerald-600 bg-emerald-50 border-emerald-100",
            },
            {
              label: "Độ tin cậy TB",
              value: stats.total > 0 ? `${stats.avgConfidence.toFixed(1)}%` : "-",
              subtext: stats.total > 0 ? "Dựa trên mô hình AI" : "Chưa có dữ liệu",
              icon: Activity,
              color: "text-violet-600 bg-violet-50 border-violet-100",
            },
            {
              label: "Loại cảm xúc ghi nhận",
              value: stats.distinctCount,
              subtext: `${stats.distinctCount} / ${Object.keys(EMOTION_META).length} cảm xúc`,
              icon: BarChart3,
              color: "text-amber-600 bg-amber-50 border-amber-100",
            },
          ].map(({ label, value, subtext, icon: Icon, color }) => (
            <div key={label} className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">{value}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">{subtext}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Phân bố các cảm xúc */}
        {stats.total > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-indigo-600" /> Phân Bố Tần Suất Cảm Xúc ({stats.total} mẫu)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.sortedEmotions.map(([emotion, count]) => {
                const meta = getEmotionMeta(emotion);
                const percent = (count / stats.total) * 100;
                return (
                  <div key={emotion} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span>{meta.emoji}</span> {meta.label}
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {count} <span className="text-[11px] font-normal text-slate-400">({percent.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${meta.color}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Danh sách bản ghi lịch sử quét chi tiết */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" /> Danh Sách Lịch Sử Chi Tiết
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Lọc theo phương thức nhận diện</p>
          </div>

          {/* Source Filter Switch */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/70">
            {[
              { id: "all", label: "Tất cả", count: history.length },
              { id: "camera", label: "Camera", icon: Camera, count: cameraCount },
              { id: "video", label: "Video", icon: Video, count: videoCount },
            ].map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveSource(id);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSource === id
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeSource === id ? "bg-indigo-50 text-indigo-600 font-bold" : "text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm font-medium">
            <RefreshCw className="w-5 h-5 animate-spin mr-2 text-indigo-500" /> Đang tải lịch sử...
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
            <p className="text-sm font-semibold text-slate-700">{error}</p>
          </div>
        )}

        {!loading && !error && filteredHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Smile className="w-12 h-12 opacity-30 mb-2" />
            <p className="text-sm font-medium">
              {activeSource === "video"
                ? "Chưa có bản ghi nào từ tệp video."
                : activeSource === "camera"
                ? "Chưa có bản ghi nào từ camera trực tiếp."
                : "Chưa có bản ghi nhận diện cảm xúc nào."}
            </p>
          </div>
        )}

        {!loading && !error && filteredHistory.length > 0 && (
          <>
            <div className="flex flex-col divide-y divide-slate-100">
              {paginatedHistory.map((item, idx) => {
                const meta = getEmotionMeta(item.dominantEmotion);
                const isVideo = item.sourceType === "UPLOADED_VIDEO";
                const isExpanded = expandedRecordId === item.id;
                const detail = item.id ? timelineDetails[item.id] : null;

                return (
                  <div key={item.id || idx} className="py-3 px-2 rounded-2xl transition hover:bg-slate-50/60">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-xs border ${meta.border} ${meta.bgLight} shrink-0`}
                      >
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold text-slate-800">
                            {meta.label}{" "}
                            <span className="text-[11px] text-slate-400 font-normal">({item.dominantEmotion})</span>
                          </p>
                          {isVideo ? (
                            <span className="text-[10px] bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                              <FileVideo className="w-3 h-3 text-purple-600" /> Video
                            </span>
                          ) : (
                            <span className="text-[10px] bg-sky-50 text-sky-700 font-semibold px-2 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                              <Camera className="w-3 h-3 text-sky-600" /> Trực tiếp
                            </span>
                          )}

                          {/* Hiển thị tên file video nếu có */}
                          {isVideo && (item.videoFileName || item.filename) && (
                            <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[200px] sm:max-w-xs flex items-center gap-1 border border-slate-200">
                              <Film className="w-3 h-3 text-slate-400 shrink-0" />
                              {item.videoFileName || item.filename}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-1 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 font-semibold text-emerald-600">
                            <Activity className="w-3 h-3" />
                            {(() => {
                              const conf = item.confidence ?? item.probabilities?.[item.dominantEmotion];
                              return conf != null ? `${(conf * 100).toFixed(1)}%` : "N/A";
                            })()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" /> {formatTime(item.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Nút xem chi tiết Timeline nếu là Video */}
                      {isVideo && item.id && (
                        <button
                          type="button"
                          onClick={() => toggleExpandTimeline(item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                            isExpanded
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          }`}
                        >
                          <Play className={`w-3 h-3 ${isExpanded ? "fill-white" : "fill-indigo-600"}`} />
                          <span className="hidden sm:inline">Chi tiết</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>

                    {/* Vùng mở rộng xem Timeline chi tiết của Video */}
                    {isVideo && isExpanded && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-100 pl-2 sm:pl-14">
                        {detail?.loading && (
                          <div className="py-4 text-xs text-slate-500 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                            Đang tải biểu đồ diễn biến từng frame của video...
                          </div>
                        )}

                        {detail?.error && (
                          <div className="py-2 text-xs text-rose-500 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" />
                            Không thể tải chi tiết: {detail.error}
                          </div>
                        )}

                        {detail && !detail.loading && (!detail.data || detail.data.length === 0) && (
                          <p className="text-xs text-slate-400 py-2">
                            Video này không ghi nhận timeline từng frame.
                          </p>
                        )}

                        {detail?.data && detail.data.length > 0 && (
                          <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/70">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/50">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-xs font-bold text-slate-800">
                                  Timeline Cảm Xúc ({detail.data.length} mốc lấy mẫu)
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Nhấp chọn mốc để xem chi tiết
                              </span>
                            </div>

                            {/* Horizontal timeline chip list */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                              {detail.data.map((frame, fIdx) => {
                                const frameMeta = getEmotionMeta(frame.emotion);
                                const confPercent = frame.confidence != null ? Math.round(frame.confidence * 100) : null;
                                return (
                                  <div
                                    key={fIdx}
                                    className="flex flex-col items-center bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-xs shrink-0 hover:border-indigo-300 transition"
                                  >
                                    <span className="text-[10px] font-mono font-bold text-slate-400 mb-1">
                                      {typeof frame.timestamp === "number" ? `${frame.timestamp}s` : frame.timestamp}
                                    </span>
                                    <span className="text-lg mb-0.5">{frameMeta.emoji}</span>
                                    <span className="text-[11px] font-bold text-slate-700">
                                      {frameMeta.label}
                                    </span>
                                    {confPercent != null && (
                                      <span className="text-[10px] font-semibold text-emerald-600 font-mono">
                                        {confPercent}%
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 text-xs text-slate-500">
                <p>
                  Trang <span className="font-bold text-slate-800">{currentPage}</span> /{" "}
                  <span className="font-bold text-slate-800">{totalPages}</span> (Tổng {filteredHistory.length} mục)
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Trước
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (page) =>
                          page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                      )
                      .map((page, i, arr) => {
                        const prev = arr[i - 1];
                        return (
                          <React.Fragment key={page}>
                            {prev && page - prev > 1 && (
                              <span className="px-1 text-slate-400">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer ${
                                currentPage === page
                                  ? "bg-indigo-600 text-white"
                                  : "text-slate-600 hover:bg-slate-100 border border-slate-200"
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium cursor-pointer"
                  >
                    Sau <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
