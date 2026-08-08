import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Pause, Volume2 } from "lucide-react";
import { colors, radius } from "../theme";
import { getToken } from "../api/client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function AudioPlayButton({ path, disabled = false, iconOnly = false }) {
  const [status, setStatus] = useState("idle"); // idle | loading | playing | error
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  useEffect(() => {
    setStatus("idle");
    audioRef.current?.pause();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    audioRef.current = null;
  }, [path]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function handleClick() {
    if (status === "playing") {
      audioRef.current?.pause();
      setStatus("idle");
      return;
    }
    if (status === "loading") return;

    if (audioRef.current && urlRef.current) {
      audioRef.current.play();
      setStatus("playing");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Couldn't load audio");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => setStatus("idle");
      audioRef.current = audio;
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  const isLoading = status === "loading";
  const isPlaying = status === "playing";
  const isError = status === "error";

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      title={isError ? "Couldn't play audio" : isPlaying ? "Pause" : "Listen to this prescription"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: iconOnly ? 0 : 6,
        padding: iconOnly ? 8 : "6px 12px",
        borderRadius: radius.pill,
        border: `1px solid ${isError ? colors.danger : colors.border}`,
        background: isPlaying ? colors.primarySoft : colors.surface,
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
      ) : isPlaying ? (
        <Pause size={14} />
      ) : (
        <Volume2 size={14} />
      )}
      {!iconOnly && (isLoading ? "Loading…" : isError ? "Couldn't play" : isPlaying ? "Pause" : "Listen")}
      <style>{`
        .sehatrx-spin { animation: sehatrx-audio-spin 0.8s linear infinite; }
        @keyframes sehatrx-audio-spin { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
