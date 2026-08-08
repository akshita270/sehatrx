import { colors, fonts, radius } from "../theme";

const baseInputStyle = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 14.5,
  fontFamily: fonts.body,
  color: colors.text,
  background: colors.bg,
  border: `1.5px solid ${colors.border}`,
  borderRadius: radius.sm,
  outline: "none",
  transition: "border-color 0.12s ease",
};

export default function Field({
  label,
  icon: Icon,
  as = "input",
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  rows,
  style,
  inputStyle,
  ...rest
}) {
  const Component = as;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: colors.textSoft }}>
          {Icon && <Icon size={13} />}
          {label}
        </span>
      )}
      <Component
        value={value}
        onChange={onChange}
        type={as === "input" ? type : undefined}
        placeholder={placeholder}
        required={required}
        rows={as === "textarea" ? rows || 4 : undefined}
        onFocus={(e) => (e.target.style.borderColor = colors.primary)}
        onBlur={(e) => (e.target.style.borderColor = colors.border)}
        style={{ ...baseInputStyle, resize: as === "textarea" ? "vertical" : undefined, ...inputStyle }}
        {...rest}
      />
    </label>
  );
}
