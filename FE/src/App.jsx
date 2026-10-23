import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  LayoutDashboard,
  History,
  LogIn,
  LogOut,
  Video,
  Sparkles,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import AuthPage from "./AuthPage";
import { API_BASE } from "./constants/emotion";
import RealtimeTab from "./components/RealtimeTab";
import VideoTab from "./components/VideoTab";
import HistoryTab from "./components/HistoryTab";
import ChatTab from "./components/ChatTab";

export default function App() {
  const [activeTab, setActiveTab] = useState("realtime"); // "realtime" | "video" | "chat" | "history"
  const [backendOk, setBackendOk] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [view, setView] = useState("app"); // "app" | "auth"
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("emotion_user");
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        setBackendOk(res.ok);
      } catch {
        setBackendOk(false);
      }
    };
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);


  const handleLogout = () => {
    localStorage.removeItem("emotion_auth_token");
    localStorage.removeItem("emotion_user");
    setCurrentUser(null);
    setSelectedVideo(null);
    setIsUserMenuOpen(false);
    setActiveTab("realtime");
  };

  const handleVideoSelection = (video) => {
    setSelectedVideo(video ? {
      ...video,
      userId: currentUser?.id || "guest",
    } : null);
  };

  const activeSelectedVideo = selectedVideo?.userId === (currentUser?.id || "guest")
    ? selectedVideo
    : null;

  if (view === "auth") {
    return (
      <AuthPage
        onBack={() => setView("app")}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setView("app");
        }}
      />
    );
  }

  // Navbar chính: Camera Trực Tiếp và Nhận diện qua Video
  const navItems = [
    { id: "realtime", label: "Camera Trực Tiếp", icon: Camera },
    { id: "video", label: "Nhận Diện Qua Video", icon: Video },
    { id: "chat", label: "Trợ Lý AI", icon: Sparkles },
  ];

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Subtle Dot Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.55,
        }}
      />

      {/* Header (Màu Bạc Xanh Nhẹ / Soft Ice-Silver với viền border rõ nét) */}
      <header className="relative border-b border-slate-200/90 bg-[#F1F5F9]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        {/* Left: Brand Logo */}
        <div className="flex-1 flex justify-start">
          <button
            onClick={() => setActiveTab("realtime")}
            className="flex flex-col justify-center text-left cursor-pointer group focus:outline-none"
            title="Về trang chủ"
          >
            <div className="flex items-baseline tracking-tight transition-transform duration-200 group-hover:scale-[1.02]">
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">emotion</span>
              <span className="text-lg font-extrabold text-indigo-600 tracking-tight ml-0.5">AI</span>
              <span className="text-lg font-black text-indigo-600 leading-none">.</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium -mt-0.5">Hệ thống nhận diện cảm xúc</p>
          </button>
        </div>

        {/* Center: Main Navigation Items */}
        <div className="flex justify-center">
          <nav className="flex items-center gap-1 bg-white/80 p-1 rounded-xl border border-slate-200 shadow-2xs">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Auth Action & User Profile */}
        <div className="flex-1 flex justify-end items-center">
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-800 leading-none">
                  {currentUser.fullName || currentUser.email}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu Modal */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-xl py-2 z-50 animate-fade-in divide-y divide-slate-100">
                  <div className="px-3.5 py-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tài khoản</p>
                    <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{currentUser.fullName || "Người dùng"}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setActiveTab("history");
                        setIsUserMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors text-left cursor-pointer ${
                        activeTab === "history"
                          ? "bg-indigo-50 text-indigo-600 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                      <span>Thống Kê & Lịch Sử</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setView("auth")}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" /> Đăng nhập / Đăng ký
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 z-10">
        {activeTab === "realtime" && <RealtimeTab backendOk={backendOk} currentUser={currentUser} />}
        {activeTab === "video" && (
          <VideoTab currentUser={currentUser} onVideoAnalyzed={handleVideoSelection} />
        )}
        {activeTab === "chat" && (
          <ChatTab
            key={currentUser?.id || "guest"}
            currentUser={currentUser}
            selectedVideo={activeSelectedVideo}
            onSelectVideo={handleVideoSelection}
          />
        )}
        {activeTab === "history" && <HistoryTab currentUser={currentUser} />}
      </main>

      {/* Footer (Màu Bạc Xanh Nhẹ / Soft Ice-Silver - Đồng bộ với Header) */}
      <footer className="relative z-10 border-t border-slate-200/90 bg-[#F1F5F9]/95 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-baseline tracking-tight">
            <span className="text-sm font-bold text-slate-800">emotion</span>
            <span className="text-sm font-bold text-indigo-600 ml-0.5">AI</span>
            <span className="text-sm font-black text-indigo-600">.</span>
          </div>
          <p className="text-[11px] text-slate-500">© 2026 EmotionAI Studio · Đồ án môn Công nghệ Phần mềm Nâng cao</p>
        </div>
      </footer>
    </div>
  );
}
