import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { colors, radius, shadow } from "./theme";

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
  }, []);

  const showToast = useCallback(
    (message, tone = "success") => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, tone }]);
      timersRef.current[id] = setTimeout(() => dismiss(id), 3200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 1000,
          maxWidth: "calc(100vw - 40px)",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: colors.surface,
              border: `1.5px solid ${t.tone === "error" ? colors.danger : colors.success}`,
              borderRadius: radius.sm,
              boxShadow: shadow.raised,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              color: t.tone === "error" ? colors.danger : colors.text,
              cursor: "pointer",
              animation: "sehatrx-toast-in 0.18s ease-out",
            }}
          >
            {t.tone === "error" ? (
              <AlertCircle size={16} color={colors.danger} style={{ flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={16} color={colors.success} style={{ flexShrink: 0 }} />
            )}
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes sehatrx-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
