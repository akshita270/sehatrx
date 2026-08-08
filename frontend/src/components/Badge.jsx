import { colors, radius } from "../theme";

const statusMap = {
  default: { bg: colors.primarySoft, fg: colors.primaryDark },
  pending: { bg: colors.accentSoft, fg: "#8A5A16" },
  sent: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export default function Badge({ children, tone = "default" }) {
  const t = statusMap[tone] || statusMap.default;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: radius.pill,
        fontSize: 12.5,
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
