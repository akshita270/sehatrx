import { useEffect, useState } from "react";
import { AlertTriangle, Copy, KeyRound, Search, User, UserPlus, X } from "lucide-react";
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
  const [claimCodeToShow, setClaimCodeToShow] = useState(null);

  const [form, setForm] = useState({ name: "", age: "", gender: "", phone: "", email: "", known_allergies: "" });

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
        known_allergies: form.known_allergies || null,
      });
      if (patient.claim_code) {
        setClaimCodeToShow(patient);
        setStarting(false);
        return;
      }
      const consultation = await api.post("/consultations", { patient_id: patient.id });
      onStart(consultation);
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  async function handleContinueAfterClaimCode() {
    setStarting(true);
    setError("");
    try {
      const consultation = await api.post("/consultations", { patient_id: claimCodeToShow.id });
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

        {!claimCodeToShow && (
          <div style={{ display: "flex", gap: 8, padding: "16px 24px 0" }}>
            <TabButton active={tab === "existing"} onClick={() => setTab("existing")} icon={User}>
              Existing Patient
            </TabButton>
            <TabButton active={tab === "new"} onClick={() => setTab("new")} icon={UserPlus}>
              Add New Patient
            </TabButton>
          </div>
        )}

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

          {claimCodeToShow ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13.5, color: colors.text }}>
                <strong>{claimCodeToShow.name}</strong> has been added. To set up their online portal, they'll need
                this one-time code — write it down or read it out to them now (it won't be shown again after you
                continue):
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  background: colors.primarySoft,
                  border: `1.5px solid ${colors.primary}`,
                  borderRadius: radius.sm,
                  padding: "18px 16px",
                }}
              >
                <KeyRound size={20} color={colors.primaryDark} />
                <span
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: 4,
                    color: colors.primaryDark,
                  }}
                >
                  {claimCodeToShow.claim_code}
                </span>
                <button
                  onClick={() => navigator.clipboard?.writeText(claimCodeToShow.claim_code)}
                  title="Copy code"
                  style={{ background: "none", border: "none", cursor: "pointer", color: colors.primaryDark, padding: 4 }}
                >
                  <Copy size={16} />
                </button>
              </div>
              <Button onClick={handleContinueAfterClaimCode} disabled={starting} fullWidth>
                {starting ? "Starting…" : "Continue to Consultation"}
              </Button>
            </div>
          ) : tab === "existing" ? (
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
                      {p.known_allergies && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: colors.danger,
                            marginTop: 3,
                          }}
                        >
                          <AlertTriangle size={11} />
                          Allergic: {p.known_allergies}
                        </div>
                      )}
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
              <Field
                label="Known Allergies (optional)"
                placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                value={form.known_allergies}
                onChange={(e) => setForm({ ...form, known_allergies: e.target.value })}
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
