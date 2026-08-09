import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { colors, radius } from "../theme";
import { api } from "../api/client";

export default function PatientHistoryPanel({ patientId }) {
  const [history, setHistory] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    setHistory(null);
    api
      .get(`/patients/${patientId}/history`)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [patientId]);

  if (!history || history.length === 0) return null;

  return (
    <div
      style={{
        background: colors.primarySoft,
        border: `1.5px solid ${colors.primary}`,
        borderRadius: radius.sm,
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <History size={18} color={colors.primaryDark} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 13.5, color: colors.primaryDark }}>
            Past Visits — {history.length} previous {history.length === 1 ? "visit" : "visits"}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={16} color={colors.primaryDark} />
        ) : (
          <ChevronDown size={16} color={colors.primaryDark} />
        )}
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {history.map((item) => (
            <div
              key={item.consultation_id}
              style={{
                background: colors.surface,
                borderRadius: radius.sm,
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span style={{ fontSize: 12, color: colors.textSoft }}>Dr. {item.doctor_name.replace(/^Dr\.\s*/, "")}</span>
              </div>
              {item.diagnosis && (
                <div style={{ fontSize: 13, color: colors.text, marginTop: 4 }}>{item.diagnosis}</div>
              )}
              {item.medicines.length > 0 && (
                <div style={{ fontSize: 12.5, color: colors.textSoft, marginTop: 4 }}>
                  {item.medicines.map((m) => `${m.name} (${m.dose}${m.duration ? `, ${m.duration}` : ""})`).join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
