import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Terminal,
  Activity,
  Play,
  Pause,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  Cpu,
  Sparkles,
  ArrowDownCircle,
  Copy,
  Check,
  Server,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useSystemLog } from "../context/SystemLogContext";

// Format seconds into human readable duration
function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return "0s";
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// Format ISO date into HH:mm:ss.SSS
function formatLogTime(isoString) {
  if (!isoString) return "--:--:--";
  try {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${h}:${m}:${s}.${ms}`;
  } catch {
    return isoString;
  }
}

const LEVEL_STYLES = {
  INFO: {
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    text: "text-sky-300",
    dot: "bg-sky-400",
    icon: Info,
  },
  SUCCESS: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    icon: CheckCircle2,
  },
  WARN: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    text: "text-amber-300",
    dot: "bg-amber-400",
    icon: AlertTriangle,
  },
  ERROR: {
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    text: "text-rose-300",
    dot: "bg-rose-400",
    icon: XCircle,
  },
};

const MODULE_COLORS = {
  INFERENCE: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  DETECTION: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  VIDEO: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  MODEL: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  SYSTEM: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  API: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function SystemLogsTab() {
  const {
    logs,
    stats,
    isConnected,
    isPaused,
    setIsPaused,
    clearLogs,
    triggerTestLog,
  } = useSystemLog();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [testSending, setTestSending] = useState(false);

  const consoleEndRef = useRef(null);

  // Auto-scroll when new logs arrive if enabled
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Filter logs by search, level, and module
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "ALL" && log.level !== levelFilter) return false;
      if (moduleFilter !== "ALL" && log.module !== moduleFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchMsg = log.message?.toLowerCase().includes(query);
        const matchModule = log.module?.toLowerCase().includes(query);
        const matchDetails = log.details && JSON.stringify(log.details).toLowerCase().includes(query);
        if (!matchMsg && !matchModule && !matchDetails) return false;
      }
      return true;
    });
  }, [logs, levelFilter, moduleFilter, search]);

  // Compute counts per level
  const counts = useMemo(() => {
    const res = { ALL: logs.length, INFO: 0, SUCCESS: 0, WARN: 0, ERROR: 0 };
    logs.forEach((l) => {
      if (res[l.level] !== undefined) res[l.level]++;
    });
    return res;
  }, [logs]);

  // Available modules present in logs
  const availableModules = useMemo(() => {
    const set = new Set(["ALL"]);
    logs.forEach((l) => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set);
  }, [logs]);

  // Copy individual log line to clipboard
  const handleCopy = (log) => {
    const text = `[${log.timestamp}] [${log.level}] [${log.module}] ${log.message} ${
      log.details && Object.keys(log.details).length ? JSON.stringify(log.details) : ""
    }`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export logs to download
  const handleExport = (format) => {
    let content = "";
    let mime = "text/plain";
    let filename = `system-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;

    if (format === "json") {
      content = JSON.stringify(filteredLogs, null, 2);
      mime = "application/json";
      filename += ".json";
    } else {
      content = filteredLogs
        .map(
          (l) =>
            `[${formatLogTime(l.timestamp)}] [${l.level.padEnd(7)}] [${l.module.padEnd(9)}] ${l.message} ${
              l.details && Object.keys(l.details).length ? " | Details: " + JSON.stringify(l.details) : ""
            }`
        )
        .join("\n");
      filename += ".txt";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendTest = async () => {
    setTestSending(true);
    await triggerTestLog();
    setTimeout(() => setTestSending(false), 500);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-indigo-400 shadow-md shadow-slate-900/10">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900">Nhật Ký & Giám Sát Hệ Thống</h1>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    isConnected
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  {isConnected ? (isPaused ? "Đang tạm dừng (SSE)" : "Trực tiếp (SSE)") : "Mất kết nối"}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi sự kiện xử lý camera, nhận diện video, mô hình AI và độ trễ theo thời gian thực
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testSending}
            title="Tạo log mẫu để kiểm tra hiển thị thời gian thực"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
          >
            <Sparkles className={`w-3.5 h-3.5 ${testSending ? "animate-spin text-indigo-600" : ""}`} />
            Gửi log mẫu
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
              isPaused
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? "Tiếp tục" : "Tạm dừng"}
          </button>

          <button
            type="button"
            onClick={clearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa nhật ký
          </button>

          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => handleExport("txt")}
              title="Tải log dạng file văn bản (.txt)"
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              .TXT
            </button>
            <div className="w-px h-3 bg-slate-200" />
            <button
              type="button"
              onClick={() => handleExport("json")}
              title="Tải log dạng file JSON (.json)"
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              .JSON
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Machine & Uptime */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-500" /> Máy Chủ AI & Model
            </span>
            <div className="text-lg font-extrabold text-slate-800">
              {stats.modelName || "EfficientNet-B0"}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Uptime: <strong className="text-slate-700 font-mono">{formatUptime(stats.uptimeSeconds)}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-600 font-medium">Cổng 8000</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Inferences */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-500" /> Tổng Lượt Phân Tích
            </span>
            <div className="text-2xl font-black text-slate-800 font-mono">
              {(stats.totalRequests || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">
              Bộ đệm log: <strong className="text-slate-700 font-mono">{logs.length}</strong> sự kiện
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Inference Latency */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Độ Trễ Trung Bình
            </span>
            <div className="text-2xl font-black text-slate-800 font-mono flex items-baseline gap-1">
              {stats.avgLatencyMs ? stats.avgLatencyMs.toFixed(1) : "0.0"}
              <span className="text-xs font-semibold text-slate-500">ms</span>
            </div>
            <div className="text-xs text-slate-500">
              P95: <strong className="text-slate-700 font-mono">{stats.p95LatencyMs ? stats.p95LatencyMs.toFixed(1) : "0.0"} ms</strong>
              <span className="ml-2 inline-block px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">
                {stats.avgLatencyMs && stats.avgLatencyMs < 60 ? "Rất nhanh" : "Tốt"}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Error Rate */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Tỷ Lệ Lỗi
            </span>
            <div className="text-2xl font-black text-slate-800 font-mono flex items-baseline gap-1">
              {stats.errorRatePct !== undefined ? stats.errorRatePct.toFixed(1) : "0.0"}
              <span className="text-xs font-semibold text-slate-500">%</span>
            </div>
            <div className="text-xs text-slate-500">
              Tổng số lỗi: <strong className={`font-mono ${stats.totalErrors > 0 ? "text-rose-600" : "text-emerald-600"}`}>{stats.totalErrors || 0}</strong>
            </div>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
            stats.totalErrors > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
          }`}>
            {stats.totalErrors > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung, mô-đun hoặc chi tiết (latency, emotion)..."
            className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs text-slate-800 pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Center: Level pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: "Tất cả", color: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
            { id: "INFO", label: "Info", color: "bg-sky-50 text-sky-700 border-sky-200" },
            { id: "SUCCESS", label: "Success", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { id: "WARN", label: "Warning", color: "bg-amber-50 text-amber-700 border-amber-200" },
            { id: "ERROR", label: "Error", color: "bg-rose-50 text-rose-700 border-rose-200" },
          ].map(({ id, label, color }) => {
            const count = counts[id] || 0;
            const active = levelFilter === id;
            return (
              <button
                key={id}
                onClick={() => setLevelFilter(id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : `${color} border border-transparent`
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    active ? "bg-slate-800 text-slate-300" : "bg-black/5 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Module selector & Auto-scroll toggle */}
        <div className="flex items-center gap-2 justify-end">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="ALL">Mọi module ({availableModules.length - 1})</option>
            {availableModules
              .filter((m) => m !== "ALL")
              .map((mod) => (
                <option key={mod} value={mod}>
                  [{mod}]
                </option>
              ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span>Cuộn tự động</span>
          </label>
        </div>
      </div>

      {/* Terminal Console Viewport */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Terminal Window Header Bar */}
        <div className="bg-[#070D19] px-4 py-3 border-b border-slate-800 flex items-center justify-between select-none">
          {/* macOS-style Dots */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-xs font-mono text-slate-400 ml-2 font-medium">
              bash — emotion-ai-microservice:8000/api/v1/system-logs
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>
              Hiển thị: <strong className="text-slate-200">{filteredLogs.length}</strong> / {logs.length} dòng
            </span>
            {isPaused && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-sans font-semibold text-[11px]">
                PAUSED
              </span>
            )}
          </div>
        </div>

        {/* Terminal Log Rows Container */}
        <div className="p-4 font-mono text-xs overflow-y-auto max-h-[580px] min-h-[380px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <Terminal className="w-10 h-10 text-slate-700" />
              <p className="text-slate-400 text-sm font-sans font-medium">
                {logs.length === 0
                  ? "Chưa có sự kiện log nào được ghi nhận. Khởi động camera hoặc gửi log mẫu."
                  : "Không tìm thấy nhật ký nào phù hợp với bộ lọc hiện tại."}
              </p>
              {logs.length === 0 && (
                <button
                  type="button"
                  onClick={handleSendTest}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer shadow-sm"
                >
                  Gửi log thử nghiệm
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.INFO;
              const moduleStyle = MODULE_COLORS[log.module] || MODULE_COLORS.API;
              const hasDetails = log.details && Object.keys(log.details).length > 0;
              const isExpanded = expandedLogId === log.id;
              const isCopied = copiedId === log.id;

              return (
                <div
                  key={log.id}
                  className="group rounded-lg hover:bg-slate-800/40 p-1.5 transition-colors flex flex-col border border-transparent hover:border-slate-800/80"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Timestamp */}
                    <span className="text-slate-500 shrink-0 text-[11px] select-none pt-0.5">
                      {formatLogTime(log.timestamp)}
                    </span>

                    {/* Level Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${style.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      {log.level}
                    </span>

                    {/* Module Tag */}
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${moduleStyle}`}
                    >
                      [{log.module}]
                    </span>

                    {/* Message Body */}
                    <span className={`flex-1 break-all pt-0.5 ${style.text}`}>
                      {log.message}
                    </span>

                    {/* Action buttons (Copy & Expand details) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {hasDetails && (
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          JSON
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopy(log)}
                        title="Sao chép dòng log"
                        className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable JSON Details */}
                  {hasDetails && isExpanded && (
                    <div className="mt-2 ml-16 mr-2 bg-[#060A14] border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-300 font-mono shadow-inner animate-fade-in">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
                        <span>Chi tiết payload</span>
                        <span className="text-slate-600 font-mono">id: {log.id}</span>
                      </div>
                      <pre className="overflow-x-auto text-indigo-300/90 whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>

        {/* Terminal Footer Quick Bar */}
        <div className="bg-[#070D19] px-4 py-2 border-t border-slate-800/90 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>SSE Stream: /api/v1/system-logs/stream</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <ArrowDownCircle className="w-3.5 h-3.5 text-indigo-400" />
              Cuộn xuống cuối
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
