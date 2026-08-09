import { useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { colors, radius } from "../theme";
import { getToken } from "../api/client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function DownloadPdfButton({ path, filename = "prescription.pdf", disabled = false, iconOnly = false }) {
  const [status, setStatus] = useState("idle"); // idle | loading | error

  async function handleClick() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Couldn't download PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  const isLoading = status === "loading";
  const isError = status === "error";

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      title={isError ? "Couldn't download PDF" : "Download this prescription as a PDF"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: iconOnly ? 0 : 6,
        padding: iconOnly ? 8 : "6px 12px",
        borderRadius: radius.pill,
        border: `1px solid ${isError ? colors.danger : colors.border}`,
        background: colors.surface,
        color: isError ? colors.danger : colors.primaryDark,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {isLoading ? (
        <Loader2 size={14} className="sehatrx-spin" />
      ) : isError ? (
        <AlertCircle size={14} />
      ) : (
        <Download size={14} />
      )}
      {!iconOnly && (isLoading ? "Preparing…" : isError ? "Couldn't download" : "Download")}
      <style>{`
        .sehatrx-spin { animation: sehatrx-pdf-spin 0.8s linear infinite; }
        @keyframes sehatrx-pdf-spin { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
