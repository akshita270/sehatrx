import { colors, fonts, radius } from "../theme";

const variants = {
  primary: {
    background: colors.primary,
    color: "#fff",
    border: "none",
  },
  accent: {
    background: colors.accent,
    color: "#fff",
    border: "none",
  },
  secondary: {
    background: colors.primarySoft,
    color: colors.primaryDark,
    border: "none",
  },
  outline: {
    background: "transparent",
    color: colors.primary,
    border: `1.5px solid ${colors.border}`,
  },
  danger: {
    background: colors.dangerSoft,
    color: colors.danger,
    border: "none",
  },
  ghost: {
    background: "transparent",
    color: colors.textSoft,
    border: "none",
  },
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  disabled = false,
  fullWidth = false,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const v = variants[variant] || variants.primary;
  const padding = size === "sm" ? "8px 16px" : size === "lg" ? "14px 28px" : "11px 22px";
  const fontSize = size === "sm" ? 13 : size === "lg" ? 16 : 14.5;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding,
        fontSize,
        fontFamily: fonts.body,
        fontWeight: 600,
        borderRadius: radius.pill,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        width: fullWidth ? "100%" : undefined,
        transition: "transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease",
        ...v,
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}
