import React, { useEffect, useRef, useState } from "react";
import { Bot, CalendarDays, FileVideo, History, Loader2, MessageSquarePlus, Paperclip, Send, Sparkles, X } from "lucide-react";
import { API_BASE, getEmotionMeta } from "../constants/emotion";

function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function renderMessageText(text) {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function createInitialMessages(isSignedIn) {
  return [{
    id: "welcome",
    role: "assistant",
    text: isSignedIn
      ? "Xin chào! Mình có thể thống kê các biểu cảm trong khoảng thời gian bạn chọn hoặc phân tích video bạn gửi."
      : "Xin chào! Bạn có thể gửi video để phân tích. Để hỏi thống kê lịch sử cá nhân, vui lòng đăng nhập trước nhé.",
  }];
}

export default function ChatTab({ currentUser, selectedVideo, onSelectVideo }) {
  const now = new Date();
  const [from, setFrom] = useState(() => toLocalDateTimeValue(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toLocalDateTimeValue(now));
  const [messages, setMessages] = useState(() => createInitialMessages(Boolean(currentUser)));
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    fetch(`${API_BASE}/chat/history?userId=${encodeURIComponent(currentUser.id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        if (!cancelled) setConversations(data);
      })
      .catch((historyError) => {
        if (!cancelled) setError(`Không thể tải lịch sử chat: ${historyError.message}`);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const startNewConversation = () => {
    setConversationId(null);
    setMessages(createInitialMessages(Boolean(currentUser)));
    setMessage("");
    setSelectedFile(null);
    setError("");
    setHistoryOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openConversation = async (id) => {
    if (!currentUser?.id) return;
    setHistoryLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/chat/history/${encodeURIComponent(id)}?userId=${encodeURIComponent(currentUser.id)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
      setConversationId(data.id);
      setMessages(data.messages || []);
      const previousVideoMessage = [...(data.messages || [])].reverse()
        .find((item) => item.videoAnalysis?.videoId);
      if (previousVideoMessage) {
        onSelectVideo?.({
          videoId: previousVideoMessage.videoAnalysis.videoId,
          filename: previousVideoMessage.videoAnalysis.filename || previousVideoMessage.fileName,
        });
      }
      if (data.periodStart) setFrom(data.periodStart.slice(0, 16));
      if (data.periodEnd) setTo(data.periodEnd.slice(0, 16));
      setHistoryOpen(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (historyError) {
      setError(`Không thể mở cuộc trò chuyện: ${historyError.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Vui lòng chọn một tệp video hợp lệ.");
      event.target.value = "";
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("Dung lượng video tối đa là 100 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setSelectedFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending || (!message.trim() && !selectedFile)) return;
    if (!from || !to || new Date(from) > new Date(to)) {
      setError("Vui lòng chọn khoảng thời gian hợp lệ.");
      return;
    }

    const question = message.trim();
    const attachment = selectedFile;
    const linkedVideo = attachment ? null : selectedVideo;
    const messageIndex = messages.length;
    const userMessage = {
      id: `${messageIndex}-user`,
      role: "user",
      text: question,
      fileName: attachment?.name || linkedVideo?.filename,
      videoId: linkedVideo?.videoId,
    };
    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setSelectedFile(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(true);

    const formData = new FormData();
    formData.append("message", question);
    formData.append("userId", currentUser?.id || "guest");
    if (conversationId) formData.append("conversationId", conversationId);
    formData.append("from", from);
    formData.append("to", to);
    if (attachment) formData.append("file", attachment);
    if (linkedVideo?.videoId) formData.append("videoId", linkedVideo.videoId);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Máy chủ trả về lỗi HTTP ${response.status}.`);
      }
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.videoAnalysis?.videoId) {
        onSelectVideo?.({
          videoId: data.videoAnalysis.videoId,
          filename: data.videoAnalysis.filename || attachment?.name,
        });
      }
      setMessages((current) => [...current, {
        id: `${messageIndex + 1}-assistant`,
        role: "assistant",
        text: data.answer,
        videoAnalysis: data.videoAnalysis,
      }]);
      if (currentUser?.id) {
        const historyResponse = await fetch(
          `${API_BASE}/chat/history?userId=${encodeURIComponent(currentUser.id)}`,
        );
        if (!historyResponse.ok) throw new Error(`Không thể cập nhật lịch sử chat (HTTP ${historyResponse.status}).`);
        setConversations(await historyResponse.json());
      }
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (requestError) {
      setMessages((current) => [...current, {
        id: `${messageIndex + 1}-error`,
        role: "error",
        text: requestError.message || "Không thể kết nối Trợ lý AI.",
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="max-w-4xl mx-auto h-[min(76vh,820px)] min-h-[520px] bg-white border border-slate-200/80 rounded-3xl shadow-sm flex flex-col overflow-hidden">
      <header className="px-5 sm:px-7 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Trợ lý cảm xúc AI</h2>
          <p className="text-xs text-slate-500">
            {!currentUser?.id
              ? "Đăng nhập để lưu và xem lại lịch sử chat"
              : conversationId
              ? conversations.find((item) => item.id === conversationId)?.title || "Cuộc trò chuyện đã lưu"
              : "Thống kê lịch sử · Phân tích biểu cảm video"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          disabled={!currentUser?.id}
          title={currentUser?.id ? "Lịch sử chat" : "Đăng nhập để lưu và xem lịch sử chat"}
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">Lịch sử</span>
        </button>
        <button
          type="button"
          onClick={startNewConversation}
          title="Cuộc trò chuyện mới"
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-indigo-100 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span className="hidden sm:inline">Chat mới</span>
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
          <Bot className="w-3.5 h-3.5" /> Gemini
        </span>
      </header>

      {historyOpen && (
        <div className="border-b border-slate-100 bg-white max-h-56 overflow-y-auto">
          <div className="px-5 sm:px-7 py-3 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">Các cuộc trò chuyện đã lưu</p>
            {!currentUser?.id && (
              <p className="text-[11px] text-slate-500">Đăng nhập để lưu lịch sử chat.</p>
            )}
          </div>
          {historyLoading || !historyLoaded ? (
            <p className="px-5 sm:px-7 pb-4 text-xs text-slate-400">Đang tải lịch sử...</p>
          ) : currentUser?.id && conversations.length ? (
            <div className="px-3 sm:px-5 pb-3 space-y-1">
              {conversations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openConversation(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${
                    conversationId === item.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="block text-xs font-semibold truncate">{item.title}</span>
                  <span className="block mt-0.5 text-[10px] text-slate-400">
                    {item.messageCount} tin nhắn
                    {item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleString("vi-VN")}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : currentUser?.id ? (
            <p className="px-5 sm:px-7 pb-4 text-xs text-slate-400">Chưa có cuộc trò chuyện nào được lưu.</p>
          ) : null}
        </div>
      )}

      <div className="px-5 sm:px-7 py-3 bg-slate-50/80 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold text-slate-600">
          <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
          Khoảng thời gian thống kê
          <span className="font-normal text-slate-400">· Mặc định 7 ngày gần nhất</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-[11px] text-slate-500">
            Từ
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="min-w-0 flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-500">
            Đến
            <input
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="min-w-0 flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4">
        {messages.map((item) => (
          <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              item.role === "user"
                ? "bg-indigo-600 text-white rounded-br-md"
                : item.role === "error"
                  ? "bg-rose-50 border border-rose-200 text-rose-700 rounded-bl-md"
                  : "bg-slate-50 border border-slate-200 text-slate-700 rounded-bl-md"
            }`}>
              {item.text && <p className="whitespace-pre-wrap">{renderMessageText(item.text)}</p>}
              {item.fileName && (
                <div className={`mt-2 flex items-center gap-2 text-xs ${item.role === "user" ? "text-indigo-100" : "text-slate-500"}`}>
                  <FileVideo className="w-4 h-4" /> {item.fileName}
                </div>
              )}
              {item.videoAnalysis?.distribution && (
                <div className="mt-3 pt-3 border-t border-slate-200/80">
                  <p className="text-[11px] font-semibold text-slate-500 mb-2">Kết quả phân tích video</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(item.videoAnalysis.distribution).map(([emotion, percentage]) => {
                      const meta = getEmotionMeta(emotion);
                      return (
                        <span key={emotion} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600">
                          {meta.emoji} {meta.label} {percentage}%
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Đang phân tích và tạo câu trả lời...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-100 p-4 sm:px-6 sm:py-4">
        {error && <p role="alert" className="text-xs text-rose-600 mb-2">{error}</p>}
        {selectedVideo && !selectedFile && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 text-xs text-emerald-700">
            <FileVideo className="w-3.5 h-3.5" />
            Hỏi về video: {selectedVideo.filename}
            <button type="button" aria-label="Bỏ video đang chọn" onClick={() => onSelectVideo?.(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {selectedFile && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 text-xs text-indigo-700">
            <FileVideo className="w-3.5 h-3.5" /> {selectedFile.name}
            <button type="button" aria-label="Bỏ video đã chọn" onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            aria-label="Gửi video"
            title="Gửi video để phân tích"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="shrink-0 w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 flex items-center justify-center"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form.requestSubmit();
              }
            }}
            placeholder="Ví dụ: Trong khoảng này có bao nhiêu biểu cảm tiêu cực?"
            rows={1}
            className="flex-1 resize-none min-h-10 max-h-28 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={sending || (!message.trim() && !selectedFile)}
            className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Gửi tin nhắn"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          Phân loại biểu cảm chỉ mang tính tham khảo, không phải kết luận về cảm xúc thật.
        </p>
      </form>
    </section>
  );
}
