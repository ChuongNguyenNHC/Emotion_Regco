import React, { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  UserCheck,
} from "lucide-react";

const API_BASE = "http://localhost:8080/api/v1/auth";

export default function AuthPage({ onBack, onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isLogin = mode === "login";

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = formData.email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Vui lòng nhập địa chỉ email");
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      setError("Địa chỉ email không đúng định dạng (ví dụ: user@example.com)");
      return;
    }

    if (!isLogin && (!formData.fullName || !formData.fullName.trim())) {
      setError("Vui lòng nhập họ và tên của bạn");
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);

    const url = isLogin ? `${API_BASE}/login` : `${API_BASE}/register`;
    const payload = isLogin
      ? { email: cleanEmail, password: formData.password }
      : {
          fullName: formData.fullName.trim(),
          email: cleanEmail,
          password: formData.password,
        };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Đã xảy ra lỗi, vui lòng thử lại.");
      }

      if (data.token && data.user) {
        localStorage.setItem("emotion_auth_token", data.token);
        localStorage.setItem("emotion_user", JSON.stringify(data.user));
        onAuthSuccess(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-slate-50 text-slate-800 selection:bg-indigo-500 selection:text-white overflow-hidden">
      {/* Subtle Dot Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.65,
        }}
      />

      {/* Gentle Radial Ambient Glow behind the card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] bg-indigo-100/60 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors py-2 px-3.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 shadow-2xs backdrop-blur-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Về trang chủ
        </button>

        <button
          onClick={onBack}
          className="flex items-baseline tracking-tight cursor-pointer focus:outline-none transition-transform hover:scale-[1.02]"
          title="Về trang chủ"
        >
          <span className="text-lg font-extrabold text-slate-900 tracking-tight">emotion</span>
          <span className="text-lg font-extrabold text-indigo-600 tracking-tight ml-0.5">AI</span>
          <span className="text-lg font-black text-indigo-600 leading-none">.</span>
        </button>
      </header>

      {/* Centered Main Form Container */}
      <main className="relative z-10 w-full flex items-center justify-center px-4 py-8 my-auto">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 shadow-[0_10px_35px_-5px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] backdrop-blur-md">
          {/* Brand & Heading */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {isLogin ? "Đăng nhập tài khoản" : "Tạo tài khoản mới"}
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              {isLogin
                ? "Đăng nhập để đồng bộ và lưu trữ lịch sử nhận diện cảm xúc"
                : "Đăng ký tài khoản để sở hữu hồ sơ và khóa định danh UUID"}
            </p>
          </div>

          {/* Clean Segmented Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                isLogin
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                !isLogin
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Đăng ký
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                  Họ và tên
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="fullName"
                    required
                    placeholder="Nguyễn Văn A"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  placeholder="Ít nhất 6 ký tự"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm shadow-slate-900/10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : isLogin ? (
                "Đăng nhập ngay"
              ) : (
                "Hoàn tất đăng ký"
              )}
            </button>
          </form>

          {/* Switch Bottom Hint */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
            {isLogin ? (
              <span>
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="font-bold text-slate-900 hover:underline cursor-pointer"
                >
                  Đăng ký tài khoản
                </button>
              </span>
            ) : (
              <span>
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="font-bold text-slate-900 hover:underline cursor-pointer"
                >
                  Đăng nhập tại đây
                </button>
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-5 text-center text-[11px] text-slate-400">
        © 2026 EmotionAI Studio · Đồ án môn CNPM Nâng cao
      </footer>
    </div>
  );
}
