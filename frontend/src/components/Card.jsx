import { colors, radius, shadow } from "../theme";

export default function Card({ children, style, padding = 24, ...rest }) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        boxShadow: shadow.card,
        border: `1px solid ${colors.border}`,
        padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
