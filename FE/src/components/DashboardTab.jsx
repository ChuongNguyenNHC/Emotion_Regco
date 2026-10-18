import React from "react";
import { Zap, Smile, BarChart3, Activity, RefreshCw } from "lucide-react";
import { getEmotionMeta } from "../constants/emotion";

export default function DashboardTab({ history }) {
  const counts = (history || []).reduce((acc, item) => {
    if (item.dominantEmotion) acc[item.dominantEmotion] = (acc[item.dominantEmotion] || 0) + 1;
    return acc;
  }, {});
  const total = history?.length || 0;
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
