import { useEffect, useState } from "react";
import { Search, User, UserPlus, X } from "lucide-react";
import { colors, fonts, radius, shadow } from "../theme";
import { api } from "../api/client";
import Button from "./Button";
import Field from "./Field";

export default function PatientPickerModal({ onClose, onStart }) {
  const [tab, setTab] = useState("existing");
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ name: "", age: "", gender: "", phone: "", email: "" });

  useEffect(() => {
    if (tab !== "existing") return;
    setLoading(true);
    const timeout = setTimeout(() => {
      api
        .get(`/patients${query ? `?q=${encodeURIComponent(query)}` : ""}`)
        .then(setPatients)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timeout);
  }, [tab, query]);

  async function handleSelectPatient(patient) {
    setStarting(true);
    setError("");
    try {
      const consultation = await api.post("/consultations", { patient_id: patient.id });
      onStart(consultation);
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  async function handleCreatePatient(e) {
    e.preventDefault();
    setStarting(true);
    setError("");
    try {
      const patient = await api.post("/patients", {
        name: form.name,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        phone: form.phone || null,
        email: form.email || null,
      });
      const consultation = await api.post("/consultations", { patient_id: patient.id });
      onStart(consultation);
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(9, 63, 68, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface,
          borderRadius: radius.lg,
          boxShadow: shadow.raised,
          width: 480,
          maxWidth: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px 0",
          }}
        >
          <h2 style={{ fontFamily: fonts.display, fontSize: 20, margin: 0, color: colors.primaryDark }}>
            New Consultation
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSoft, padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "16px 24px 0" }}>
          <TabButton active={tab === "existing"} onClick={() => setTab("existing")} icon={User}>
            Existing Patient
          </TabButton>
          <TabButton active={tab === "new"} onClick={() => setTab("new")} icon={UserPlus}>
            Add New Patient
          </TabButton>
        </div>

        <div style={{ padding: 24, overflowY: "auto" }}>
          {error && (
            <div
              style={{
                background: colors.dangerSoft,
                color: colors.danger,
                borderRadius: radius.sm,
                padding: "10px 14px",
                fontSize: 13.5,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          {tab === "existing" ? (
            <>
              <div style={{ position: "relative", marginBottom: 14 }}>
                <Search
                  size={16}
                  style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textFaint }}
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search patients by name..."
                  style={{
                    width: "100%",
                    padding: "11px 14px 11px 38px",
                    fontSize: 14.5,
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: radius.sm,
                    outline: "none",
                    background: colors.bg,
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {loading && <div style={{ color: colors.textFaint, fontSize: 13.5, padding: 8 }}>Searching…</div>}
                {!loading && patients.length === 0 && (
                  <div style={{ color: colors.textFaint, fontSize: 13.5, padding: 8 }}>No patients found.</div>
                )}
                {patients.map((p) => (
                  <button
                    key={p.id}
                    disabled={starting}
                    onClick={() => handleSelectPatient(p)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.sm,
                      cursor: starting ? "not-allowed" : "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: colors.primarySoft,
                        color: colors.primaryDark,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: fonts.display,
                        fontWeight: 700,
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</div>
                      <div style={{ fontSize: 12.5, color: colors.textSoft }}>
                        {[p.age && `${p.age} yrs`, p.gender, p.phone].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={handleCreatePatient} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Full Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div style={{ display: "flex", gap: 12 }}>
                <Field
                  label="Age"
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  style={{ flex: 1 }}
                />
                <Field
                  label="Gender"
                  as="select"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  style={{ flex: 1 }}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </Field>
              </div>
              <Field label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Field
                label="Email (optional)"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Button type="submit" disabled={starting || !form.name} fullWidth>
                {starting ? "Starting…" : "Add Patient & Start Consultation"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 16px",
        borderRadius: radius.pill,
        border: "none",
        background: active ? colors.primary : colors.primarySoft,
        color: active ? "#fff" : colors.primaryDark,
        fontWeight: 600,
        fontSize: 13.5,
        cursor: "pointer",
      }}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}
