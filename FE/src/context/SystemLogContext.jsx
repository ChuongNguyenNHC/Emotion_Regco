import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { AI_DIRECT } from "../constants/emotion";

const SystemLogContext = createContext(null);

export function SystemLogProvider({ children }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    uptimeSeconds: 0,
    totalRequests: 0,
    totalErrors: 0,
    errorRatePct: 0,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    modelName: "EfficientNet-B0",
    modelLoaded: true,
    activeSubscribers: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const eventSourceRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const isPausedRef = useRef(isPaused);
  const connectSSERef = useRef(null);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${AI_DIRECT}/api/v1/system-logs?limit=150`);
      if (res.ok) {
        const data = await res.json();
        if (data.logs) setLogs(data.logs);
        if (data.stats) setStats(data.stats);
      }
    } catch {
      // Backend may be offline or starting
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource(`${AI_DIRECT}/api/v1/system-logs/stream`);
      eventSourceRef.current = es;

      es.addEventListener("connected", (e) => {
        setIsConnected(true);
        try {
          const payload = JSON.parse(e.data);
          if (payload.stats) setStats(payload.stats);
        } catch {
          // ignore
        }
      });

      es.addEventListener("log", (e) => {
        setIsConnected(true);
        if (isPausedRef.current) return;
        try {
          const entry = JSON.parse(e.data);
          setLogs((prev) => {
            const next = [...prev, entry];
            return next.length > 500 ? next.slice(-500) : next;
          });
          setUnreadCount((c) => c + 1);

          // Update real-time stats if entry has latency or error
          if (entry.details?.latency_ms) {
            setStats((s) => ({
              ...s,
              totalRequests: (s.totalRequests || 0) + 1,
              avgLatencyMs: entry.details.latency_ms,
            }));
          }
          if (entry.level === "ERROR") {
            setStats((s) => ({
              ...s,
              totalErrors: (s.totalErrors || 0) + 1,
            }));
          }
        } catch {
          // ignore
        }
      });

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          connectSSERef.current?.();
        }, 4000);
      };

      es.onopen = () => {
        setIsConnected(true);
      };
    } catch {
      setIsConnected(false);
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        connectSSERef.current?.();
      }, 5000);
    }
  }, []);

  useEffect(() => {
    connectSSERef.current = connectSSE;
  }, [connectSSE]);

  useEffect(() => {
    fetchHistory();
    connectSSE();

    return () => {
      clearTimeout(retryTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fetchHistory, connectSSE]);

  const clearLogs = async () => {
    try {
      await fetch(`${AI_DIRECT}/api/v1/system-logs/clear`, { method: "POST" });
    } catch {
      // ignore
    }
    setLogs([]);
    setUnreadCount(0);
  };

  const triggerTestLog = async () => {
    try {
      const res = await fetch(`${AI_DIRECT}/api/v1/system-logs/test`, { method: "POST" });
      const data = await res.json();
      if (data.stats) setStats(data.stats);
    } catch {
      // ignore
    }
  };

  const refreshStats = async () => {
    fetchHistory();
  };

  return (
    <SystemLogContext.Provider
      value={{
        logs,
        stats,
        isConnected,
        isPaused,
        setIsPaused,
        clearLogs,
        triggerTestLog,
        refreshStats,
        drawerOpen,
        setDrawerOpen,
        unreadCount,
        setUnreadCount,
      }}
    >
      {children}
    </SystemLogContext.Provider>
  );
}

export function useSystemLog() {
  const ctx = useContext(SystemLogContext);
  if (!ctx) {
    throw new Error("useSystemLog must be used within SystemLogProvider");
  }
  return ctx;
}
