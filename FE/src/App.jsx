import React, { useState } from 'react';
import { Camera, LayoutDashboard, History, Sparkles, Activity, Smile, BarChart3, Settings } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('realtime');
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Mock emotion stats
  const emotions = [
    { name: 'Vui vẻ (Happy)', percent: 78, color: 'bg-emerald-500', emoji: '😊' },
    { name: 'Bình thường (Neutral)', percent: 14, color: 'bg-blue-500', emoji: '😐' },
    { name: 'Ngạc nhiên (Surprise)', percent: 5, color: 'bg-amber-500', emoji: '😮' },
    { name: 'Buồn (Sad)', percent: 3, color: 'bg-indigo-500', emoji: '😢' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header / Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              EmotionAI Studio
            </h1>
            <p className="text-xs text-slate-400">Hệ thống nhận diện cảm xúc khuôn mặt Realtime</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('realtime')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'realtime'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Camera className="w-4 h-4" /> Realtime Camera
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard Thống kê
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-4 h-4" /> Lịch sử Quét
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Center Section: Camera Stream */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isCameraActive ? 'bg-emerald-400' : 'bg-slate-500'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isCameraActive ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                </span>
                <span className="text-sm font-medium text-slate-300">
                  {isCameraActive ? 'Webcam đang phát (3 FPS)' : 'Webcam tắt'}
                </span>
              </div>
              <button
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isCameraActive
                    ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                    : 'bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                }`}
              >
                {isCameraActive ? 'Tắt Camera' : 'Bật Camera Demo'}
              </button>
            </div>

            {/* Video Canvas Container */}
            <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {isCameraActive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-center p-6">
                  <div className="w-24 h-24 rounded-full border-4 border-dashed border-indigo-500/50 flex items-center justify-center animate-spin-slow mb-4">
                    <Smile className="w-12 h-12 text-indigo-400" />
                  </div>
                  <p className="text-sm text-slate-300 font-medium">Đang sẵn sàng kết nối OpenCV / MediaPipe...</p>
                  <p className="text-xs text-slate-500 mt-1">Gõ `npm run dev` để kiểm tra hot-reload.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Camera className="w-12 h-12 opacity-50" />
                  <p className="text-sm">Bấm "Bật Camera Demo" để bắt đầu nhận diện</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Realtime Results & Stats */}
        <div className="flex flex-col gap-6">
          {/* Active Emotion Card */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 flex flex-col items-center text-center shadow-xl">
            <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase mb-2">Cảm xúc hiện tại</span>
            <div className="text-6xl mb-3">😊</div>
            <h3 className="text-2xl font-bold text-white mb-1">Vui vẻ (Happy)</h3>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
              <Activity className="w-3.5 h-3.5" /> Độ tin cậy: 87.5%
            </div>
          </div>

          {/* Emotion Distribution */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Phân bổ xác suất
            </h4>

            <div className="flex flex-col gap-3">
              {emotions.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <span>{item.emoji}</span> {item.name}
                    </span>
                    <span className="text-slate-400">{item.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                      style={{ width: `${item.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

