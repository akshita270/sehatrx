import { colors, radius } from "../theme";

export default function LanguageToggle({ lang, onChange, hindiAvailable = true }) {
  return (
    <div style={{ display: "flex", background: colors.primarySoft, borderRadius: radius.pill, padding: 3 }}>
      {[
        { key: "en", label: "English" },
        { key: "hi", label: "हिंदी" },
      ].map(({ key, label }) => {
        const disabled = key === "hi" && !hindiAvailable;
        return (
          <button
            key={key}
            disabled={disabled}
            onClick={() => onChange(key)}
            title={disabled ? "Hindi translation isn't available for this prescription" : undefined}
            style={{
              padding: "6px 14px",
              borderRadius: radius.pill,
              border: "none",
              cursor: disabled ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 12.5,
              background: lang === key ? colors.primary : "transparent",
              color: lang === key ? "#fff" : disabled ? colors.textFaint : colors.primaryDark,
              opacity: disabled ? 0.6 : 1,
              transition: "background 0.15s ease",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
