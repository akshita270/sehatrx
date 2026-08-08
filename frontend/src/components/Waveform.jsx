import { colors } from "../theme";

const BAR_COUNT = 24;
// Deterministic pseudo-random heights so idle/fallback bars look organic but don't reshuffle every render.
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const seed = Math.sin(i * 12.9898) * 43758.5453;
  return 0.3 + (Math.abs(seed) % 1) * 0.7;
});

// `levels`: optional array of 0-1 values (one per bar) sampled from the live mic input via
// Web Audio API. When present and active, bars reflect real volume instead of a decorative loop.
export default function Waveform({ active = false, height = 64, levels = null }) {
  const live = active && Array.isArray(levels) && levels.length > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        height,
      }}
    >
      <style>{`
        @keyframes sehatrx-bar-pulse {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      {BAR_HEIGHTS.map((fallbackHeight, i) => {
        const liveLevel = live ? levels[i % levels.length] : null;
        const scale = liveLevel !== null ? Math.max(0.08, liveLevel) : 1;
        return (
          <div
            key={i}
            style={{
              width: 3.5,
              height: `${fallbackHeight * 100}%`,
              borderRadius: 4,
              background: active ? colors.accent : colors.border,
              transformOrigin: "center",
              transform: live ? `scaleY(${scale})` : undefined,
              transition: live ? "transform 0.06s ease-out, background 0.2s ease" : "background 0.2s ease",
              animation: active && !live ? `sehatrx-bar-pulse ${0.6 + (i % 5) * 0.12}s ease-in-out infinite` : "none",
              animationDelay: `${(i % 7) * 0.05}s`,
            }}
          />
        );
      })}
    </div>
  );
}
