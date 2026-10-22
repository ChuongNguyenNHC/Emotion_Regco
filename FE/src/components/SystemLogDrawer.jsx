import React, { useRef, useEffect } from "react";
import {
  Terminal,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Trash2,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import { useSystemLog } from "../context/SystemLogContext";

function formatShortTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  } catch {
    return "";
  }
}

const LEVEL_COLORS = {
  INFO: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  SUCCESS: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  WARN: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  ERROR: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export default function SystemLogDrawer({ onOpenFullTab }) {
  const {
    logs,
    stats,
    isConnected,
    isPaused,
    setIsPaused,
    clearLogs,
    triggerTestLog,
    drawerOpen,
    setDrawerOpen,
    unreadCount,
    setUnreadCount,
  } = useSystemLog();

  const scrollRef = useRef(null);

  // Auto-scroll inside drawer
  useEffect(() => {
    if (drawerOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, drawerOpen]);

  const handleToggle = () => {
    if (!drawerOpen) {
      setUnreadCount(0);
    }
    setDrawerOpen((prev) => !prev);
  };

  return (
    <div className="fixed bottom-0 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Drawer Window (when opened) */}
      {drawerOpen && (
        <div className="pointer-events-auto w-[92vw] sm:w-[620px] md:w-[720px] bg-[#090E17]/95 backdrop-blur-xl border border-slate-700/80 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up transition-all mb-0">
          {/* Header */}
          <div className="bg-[#050810] px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200">System Logs Live Console</span>
              <span className="text-[11px] font-mono text-slate-500">
                ({logs.length} logs · {stats.avgLatencyMs ? `${stats.avgLatencyMs.toFixed(1)}ms` : "0ms"})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={triggerTestLog}
                title="Gửi log mẫu"
                className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                title={isPaused ? "Tiếp tục stream" : "Tạm dừng"}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={clearLogs}
                title="Xóa nhật ký"
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-3 bg-slate-700 mx-1" />

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  if (onOpenFullTab) onOpenFullTab();
                }}
                title="Mở toàn màn hình trang Nhật ký"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Toàn màn hình</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Console Output Scroll Area */}
          <div
            ref={scrollRef}
            className="p-3 font-mono text-xs overflow-y-auto h-52 space-y-1.5 text-slate-300 scrollbar-thin scrollbar-thumb-slate-700"
          >
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                Chờ đợi sự kiện... Bật camera hoặc gửi log mẫu để xem luồng dữ liệu.
              </div>
            ) : (
              logs.slice(-60).map((log) => {
                const badge = LEVEL_COLORS[log.level] || LEVEL_COLORS.INFO;
                return (
                  <div key={log.id} className="flex items-start gap-2 leading-tight py-0.5">
                    <span className="text-slate-500 shrink-0 text-[11px]">
                      {formatShortTime(log.timestamp)}
                    </span>
                    <span className={`px-1 py-0.2 rounded text-[10px] font-bold border shrink-0 ${badge}`}>
                      {log.level}
                    </span>
                    <span className="text-slate-400 shrink-0 text-[11px]">[{log.module}]</span>
                    <span className="break-all text-slate-200">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating Pill Toggle Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="pointer-events-auto mb-3 flex items-center gap-2.5 px-3.5 py-2 bg-slate-900/95 hover:bg-slate-800 text-white rounded-2xl shadow-xl border border-slate-700/80 backdrop-blur-md transition-all cursor-pointer group hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="relative flex items-center">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span
            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-tight">System Logs</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-semibold border border-slate-700">
            {logs.length}
          </span>
          {stats.avgLatencyMs > 0 && (
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              {stats.avgLatencyMs.toFixed(0)}ms
            </span>
          )}
        </div>

        {unreadCount > 0 && !drawerOpen && (
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold animate-pulse">
            +{unreadCount}
          </span>
        )}

        <ChevronUp
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 group-hover:text-white ${
            drawerOpen ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}
