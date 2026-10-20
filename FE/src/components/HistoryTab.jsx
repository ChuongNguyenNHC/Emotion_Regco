import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { API_BASE, getEmotionMeta, formatTime } from "../constants/emotion";

export default function HistoryTab({ currentUser }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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
      setHistory(await res.json());
      setCurrentPage(1);
    } catch (e) {
      setError("Không thể tải lịch sử: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-sm max-w-lg mx-auto">
        <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Vui lòng đăng nhập</h3>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Bạn cần đăng nhập tài khoản để lưu trữ và xem lại lịch sử nhận diện cảm xúc cá nhân của mình.
        </p>
      </div>
    );
  }

  const [activeSource, setActiveSource] = useState("camera"); // "camera" | "video"

  const filteredHistory = history.filter((item) => {
    if (activeSource === "video") {
      return item.sourceType === "UPLOADED_VIDEO";
    }
    return item.sourceType !== "UPLOADED_VIDEO"; // default camera
  });

  const totalPages = Math.ceil(filteredHistory.length / pageSize) || 1;
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" /> Lịch sử nhận diện cảm xúc
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Lịch sử quét cảm xúc cá nhân của <span className="font-semibold text-slate-700">{currentUser.fullName || currentUser.username}</span> ({history.length} bản ghi)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới
          </button>
        </div>
      </div>

      {/* 2 Sub Tabs: Camera vs Video (Full size & Indigo/Brand theme) */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100/90 rounded-2xl mb-6 border border-slate-200/70">
        <button
          type="button"
          onClick={() => { setActiveSource("camera"); setCurrentPage(1); }}
          className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSource === "camera"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-indigo-600 hover:bg-white/60"
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Lịch sử Camera Trực Tiếp</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeSource === "camera" ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
          }`}>
            {history.filter(i => i.sourceType !== "UPLOADED_VIDEO").length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveSource("video"); setCurrentPage(1); }}
          className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSource === "video"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-indigo-600 hover:bg-white/60"
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Lịch sử Phân Tích Video</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeSource === "video" ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
          }`}>
            {history.filter(i => i.sourceType === "UPLOADED_VIDEO").length}
          </span>
        </button>
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
      {!loading && !error && filteredHistory.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Smile className="w-12 h-12 opacity-30 mb-2" />
          <p className="text-sm font-medium">
            {activeSource === "video"
              ? "Chưa có lịch sử quét từ tệp video nào."
              : "Chưa có lịch sử quét từ camera trực tiếp nào."}
          </p>
        </div>
      )}

      {!loading && !error && filteredHistory.length > 0 && (
        <>
          <div className="flex flex-col divide-y divide-slate-100">
            {paginatedHistory.map((item, idx) => {
              const meta = getEmotionMeta(item.dominantEmotion);
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
                      {item.sourceType === "UPLOADED_VIDEO" ? (
                        <span className="text-[10px] bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                          <FileVideo className="w-3 h-3 text-purple-600" /> Video
                        </span>
                      ) : (
                        <span className="text-[10px] bg-sky-50 text-sky-700 font-semibold px-2 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                          <Camera className="w-3 h-3 text-sky-600" /> Trực tiếp
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium text-emerald-600">
                        <Activity className="w-3 h-3" />
                        {(() => {
                          const conf = item.confidence ?? item.probabilities?.[item.dominantEmotion];
                          return conf != null ? `${(conf * 100).toFixed(1)}%` : "N/A";
                        })()}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-slate-600 truncate max-w-xs">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        {currentUser.fullName || currentUser.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> {formatTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-5 mt-4 border-t border-slate-100 text-xs text-slate-500">
              <p>
                Trang <span className="font-bold text-slate-800">{currentPage}</span> / <span className="font-bold text-slate-800">{totalPages}</span> (Tổng {filteredHistory.length} mục)
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Trước
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                    .map((page, i, arr) => {
                      const prev = arr[i - 1];
                      return (
                        <React.Fragment key={page}>
                          {prev && page - prev > 1 && <span className="px-1 text-slate-400">...</span>}
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium cursor-pointer"
                >
                  Sau <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
