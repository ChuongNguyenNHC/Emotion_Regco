import React, { useEffect, useState, useRef } from "react";
import {
  BarChart3,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronUp,
  Award,
  AlertTriangle,
  RefreshCw,
  Info,
} from "lucide-react";

const AI_DIRECT = "http://localhost:8000";

// Metric gauge ring component
function GaugeRing({ value, color, size = 56 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - circ * value;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

// Mini sparkline SVG for training curve
function Sparkline({ data, keyY, color, width = 260, height = 60 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => d[keyY]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });
  const lastPt = pts[pts.length - 1].split(",");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={color} />
    </svg>
  );
}

const METRIC_COLORS = {
  precision: "#6366f1",
  recall: "#10b981",
  f1: "#f59e0b",
};

const EMOTION_COLOR_MAP = {
  Angry: "#ef4444",
  Disgust: "#14b8a6",
  Fear: "#a855f7",
  Happy: "#22c55e",
  Neutral: "#94a3b8",
  Sad: "#38bdf8",
  Surprise: "#f59e0b",
};

function MetricBadge({ value, low = 0.2, high = 0.5 }) {
  const pct = (value * 100).toFixed(1);
  let cls = "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (value < low) cls = "bg-rose-100 text-rose-700 border-rose-200";
  else if (value < high) cls = "bg-amber-100 text-amber-700 border-amber-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border font-mono ${cls}`}>
      {pct}%
    </span>
  );
}

export default function ModelMetricsPanel({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeMetric, setActiveMetric] = useState("f1");
  const fetchedRef = useRef(false);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AI_DIRECT}/api/v1/model-metrics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetrics(data);
      fetchedRef.current = true;
    } catch (e) {
      setError("Khong the tai metrics mo hinh: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !fetchedRef.current) fetchMetrics();
  }, [open]);

  const report = metrics?.classificationReport;
  const history = metrics?.trainingHistory || [];

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors group cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">Hieu suat Mo hinh AI</p>
            <p className="text-[11px] text-slate-500">
              {metrics
                ? `Accuracy: ${(report.accuracy * 100).toFixed(1)}% · Best Val: ${metrics.bestValAccuracy?.toFixed(2)}%`
                : "Precision · Recall · F1-Score theo tung cam xuc"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {metrics && (
            <span className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-semibold text-emerald-700">
              <Award className="w-3 h-3" />
              {metrics.model}
            </span>
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-6 pt-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Dang tai du lieu metrics...
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2.5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold">Khong ket noi duoc FastAPI backend (port 8000)</p>
                <p className="text-amber-700 mt-0.5">{error}</p>
                <button
                  onClick={fetchMetrics}
                  className="mt-2 px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Thu lai
                </button>
              </div>
            </div>
          )}

          {metrics && !loading && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Accuracy", value: report.accuracy, color: "#6366f1", desc: "Tong the" },
                  { label: "Macro F1", value: report.macro_avg.f1, color: "#f59e0b", desc: "Trung binh deu" },
                  { label: "Weighted F1", value: report.weighted_avg.f1, color: "#10b981", desc: "Theo support" },
                  { label: "Best Val Acc", value: (metrics.bestValAccuracy || 0) / 100, color: "#8b5cf6", desc: "Epoch tot nhat" },
                ].map(({ label, value, color, desc }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 flex items-center gap-3">
                    <div className="relative flex items-center justify-center shrink-0">
                      <GaugeRing value={value} color={color} size={52} />
                      <span className="absolute text-[10px] font-black" style={{ color }}>
                        {(value * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate">{label}</p>
                      <p className="text-[10px] text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                    Metrics theo tung cam xuc
                  </h4>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-semibold">
                    {["precision", "recall", "f1"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setActiveMetric(m)}
                        className={`px-3 py-1.5 capitalize transition-colors cursor-pointer ${
                          activeMetric === m ? "text-white" : "text-slate-600 hover:bg-slate-50"
                        }`}
                        style={activeMetric === m ? { backgroundColor: METRIC_COLORS[m] } : {}}
                      >
                        {m === "f1" ? "F1-Score" : m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {report.classes.map((cls) => {
                    const val = cls[activeMetric];
                    const barColor = EMOTION_COLOR_MAP[cls.emotion] || "#6366f1";
                    return (
                      <div key={cls.emotion} className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 w-28 shrink-0">
                          <span className="text-base">{cls.emoji}</span>
                          <span className="text-xs font-semibold text-slate-700 truncate">{cls.emotion}</span>
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(val * 100).toFixed(1)}%`, backgroundColor: barColor }}
                          />
                        </div>
                        <MetricBadge value={val} />
                        <span className="text-[10px] text-slate-400 w-12 text-right shrink-0 font-mono">
                          n={cls.support.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  Classification Report day du
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/70">
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Class</th>
                        <th className="text-center px-3 py-2.5 font-semibold" style={{ color: METRIC_COLORS.precision }}>Precision</th>
                        <th className="text-center px-3 py-2.5 font-semibold" style={{ color: METRIC_COLORS.recall }}>Recall</th>
                        <th className="text-center px-3 py-2.5 font-semibold" style={{ color: METRIC_COLORS.f1 }}>F1-Score</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500">Support</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.classes.map((cls, i) => (
                        <tr key={cls.emotion} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/20"}`}>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            <span className="flex items-center gap-2">
                              <span>{cls.emoji}</span>
                              <span>{cls.emotion}</span>
                            </span>
                          </td>
                          <td className="text-center px-3 py-2.5"><MetricBadge value={cls.precision} /></td>
                          <td className="text-center px-3 py-2.5"><MetricBadge value={cls.recall} /></td>
                          <td className="text-center px-3 py-2.5"><MetricBadge value={cls.f1} /></td>
                          <td className="text-center px-3 py-2.5 text-slate-500 font-mono">{cls.support.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="border-b-2 border-slate-200"><td colSpan={5} /></tr>
                      <tr className="bg-slate-50/40 border-b border-slate-100">
                        <td className="px-4 py-2.5 font-bold text-slate-700">Accuracy</td>
                        <td className="text-center px-3 py-2.5 text-slate-300">—</td>
                        <td className="text-center px-3 py-2.5 text-slate-300">—</td>
                        <td className="text-center px-3 py-2.5"><MetricBadge value={report.accuracy} /></td>
                        <td className="text-center px-3 py-2.5 text-slate-500 font-mono">{report.total_support.toLocaleString()}</td>
                      </tr>
                      <tr className="bg-slate-50/40 border-b border-slate-100">
                        <td className="px-4 py-2.5 font-bold text-slate-700">Macro Avg</td>
                        <td className="text-center px-3 py-2.5"><MetricBadge value={report.macro_avg.precision} /></td>
                        <td className="text-center px-3 py-2.5"><MetricBadge value={report.macro_avg.recall} /></td>
                        <td className="text-center px-3 py-2.5"><MetricBadge value={report.macro_avg.f1} /></td>
                        <td className="text-center px-3 py-2.5 text-slate-500 font-mono">{report.total_support.toLocaleString()}</td>
                      </tr>
                      <tr className="bg-slate-50/40">
                        <td className="px-4 py-2.5 font-bold text-slate-700">Weighted Avg</td>
                        <td className="text-center px-3 py-2.5"><MetricBadge value={report.weighted_avg.precision} /></td>
                        <td className="text-center px-3 py-2.5"><MetricBadge value={report.weighted_avg.recall} /></td>
                        <td className="text-center px-3 py-2.5"><MetricBadge value={report.weighted_avg.f1} /></td>
                        <td className="text-center px-3 py-2.5 text-slate-500 font-mono">{report.total_support.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {history.length > 1 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    Duong cong Training ({history.length} epochs)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Validation Accuracy (%)", keyY: "valAcc", color: "#6366f1" },
                      { label: "Training Accuracy (%)", keyY: "trainAcc", color: "#10b981" },
                    ].map(({ label, keyY, color }) => (
                      <div key={keyY} className="bg-slate-50 rounded-xl p-4 border border-slate-200/70">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-slate-600">{label}</p>
                          <span className="text-xs font-black font-mono" style={{ color }}>
                            {history[history.length - 1][keyY].toFixed(2)}%
                          </span>
                        </div>
                        <div className="w-full overflow-hidden">
                          <Sparkline data={history} keyY={keyY} color={color} width={260} height={55} />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-mono">
                          <span>Epoch 1</span>
                          <span>Epoch {history.length}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
