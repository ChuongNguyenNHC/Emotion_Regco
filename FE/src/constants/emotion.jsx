import React from "react";

export const API_BASE = "http://localhost:8080/api/v1/emotions";
export const AI_DIRECT = "http://localhost:8000";
export const CAPTURE_INTERVAL_MS = 1500;

export const EMOTION_META = {
  Happy: { emoji: "😊", color: "bg-emerald-500", text: "text-emerald-700", bgLight: "bg-emerald-50", border: "border-emerald-200", label: "Vui vẻ", ring: "ring-emerald-400" },
  Sad: { emoji: "😢", color: "bg-sky-500", text: "text-sky-700", bgLight: "bg-sky-50", border: "border-sky-200", label: "Buồn bã", ring: "ring-sky-400" },
  Angry: { emoji: "😠", color: "bg-rose-500", text: "text-rose-700", bgLight: "bg-rose-50", border: "border-rose-200", label: "Tức giận", ring: "ring-rose-400" },
  Fear: { emoji: "😨", color: "bg-purple-500", text: "text-purple-700", bgLight: "bg-purple-50", border: "border-purple-200", label: "Sợ hãi", ring: "ring-purple-400" },
  Surprise: { emoji: "😮", color: "bg-amber-500", text: "text-amber-700", bgLight: "bg-amber-50", border: "border-amber-200", label: "Ngạc nhiên", ring: "ring-amber-400" },
  Disgust: { emoji: "🤢", color: "bg-teal-600", text: "text-teal-700", bgLight: "bg-teal-50", border: "border-teal-200", label: "Ghê tởm", ring: "ring-teal-400" },
  Neutral: { emoji: "😐", color: "bg-slate-500", text: "text-slate-700", bgLight: "bg-slate-100", border: "border-slate-200", label: "Bình thường", ring: "ring-slate-400" },
};

export function getEmotionMeta(emotion) {
  if (!emotion) return { emoji: "🤔", color: "bg-slate-400", text: "text-slate-600", bgLight: "bg-slate-50", border: "border-slate-200", label: "Chưa rõ", ring: "ring-slate-300" };
  const key = Object.keys(EMOTION_META).find(k => k.toLowerCase() === emotion.toLowerCase());
  return key ? EMOTION_META[key] : { emoji: "😐", color: "bg-slate-400", text: "text-slate-600", bgLight: "bg-slate-50", border: "border-slate-200", label: emotion, ring: "ring-slate-300" };
}

export function formatTime(isoString) {
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

export function StatusDot({ ok }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
    </span>
  );
}

export function EmotionBar({ name, percent, color, emoji }) {
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
