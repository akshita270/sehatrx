import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Mic, Send, Stethoscope, User, Users } from "lucide-react";
import { colors, fonts, radius } from "../theme";
import { api, ApiError } from "../api/client";
import { useAuth } from "../AuthContext";
import { useIsMobile } from "../useIsMobile";
import Button from "../components/Button";
import Field from "../components/Field";

const FEATURES = [
  { icon: Mic, text: "Record consultations and get instant AI transcripts" },
  { icon: Stethoscope, text: "Review AI-drafted prescriptions before you approve them" },
  { icon: Send, text: "Send prescriptions straight to your patient's portal" },
];

const HOME_BY_ROLE = { doctor: "/dashboard", patient: "/portal", caregiver: "/family" };

const emptyDoctorForm = { name: "", email: "", password: "", specialization: "", clinic: "", reg_no: "", phone: "" };
const emptyPatientForm = { name: "", email: "", password: "", phone: "", age: "", claim_code: "" };
const emptyCaregiverForm = { name: "", email: "", password: "", phone: "", claim_code: "" };
const emptyLoginForm = { email: "", password: "" };

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | register
  const [role, setRole] = useState("doctor");
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [doctorForm, setDoctorForm] = useState(emptyDoctorForm);
  const [patientForm, setPatientForm] = useState(emptyPatientForm);
  const [caregiverForm, setCaregiverForm] = useState(emptyCaregiverForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isMobile = useIsMobile();

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { ...loginForm, role });
      login(res.access_token, res.user);
      navigate(HOME_BY_ROLE[role]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const path = { doctor: "/auth/register/doctor", patient: "/auth/register/patient", caregiver: "/auth/register/caregiver" }[role];
      const payload =
        role === "doctor"
          ? doctorForm
          : role === "caregiver"
          ? caregiverForm
          : { ...patientForm, age: patientForm.age ? Number(patientForm.age) : null };
      const res = await api.post(path, payload);
      login(res.access_token, res.user);
      navigate(HOME_BY_ROLE[role]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      }}
    >
      {/* Left hero panel */}
      <div
        style={{
          background: `linear-gradient(150deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
          color: "#fff",
          padding: isMobile ? "40px 28px" : "64px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 32,
        }}
      >
        <div>
          <div style={{ fontFamily: fonts.display, fontSize: 32, fontWeight: 800, marginBottom: 18 }}>
            <span style={{ color: "#fff" }}>Sehat</span>
            <span style={{ color: colors.accent }}>Rx</span>
          </div>
          <h1
            style={{
              fontFamily: fonts.display,
              fontSize: isMobile ? 26 : 34,
              fontWeight: 700,
              lineHeight: 1.25,
              margin: 0,
              maxWidth: 440,
            }}
          >
            Consultations to prescriptions, without the paperwork.
          </h1>
          <p style={{ fontSize: 15.5, color: "rgba(255,255,255,0.78)", maxWidth: 420, marginTop: 14, lineHeight: 1.6 }}>
            SehatRx listens to your consultation, drafts the prescription, and puts it in front of
            your patient the moment you approve it.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.md,
                  background: "rgba(255,255,255,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} color={colors.accent} />
              </div>
              <span style={{ fontSize: 14.5, color: "rgba(255,255,255,0.9)" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "40px 24px" : "56px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div
            style={{
              display: "flex",
              background: colors.primarySoft,
              borderRadius: radius.pill,
              padding: 4,
              marginBottom: 28,
            }}
          >
            {[
              { key: "doctor", label: "Doctor", icon: Stethoscope },
              { key: "patient", label: "Patient", icon: User },
              { key: "caregiver", label: "Family", icon: Users },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setRole(key)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "9px 0",
                  borderRadius: radius.pill,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  background: role === key ? colors.primary : "transparent",
                  color: role === key ? "#fff" : colors.primaryDark,
                  transition: "background 0.15s ease",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <h2 style={{ fontFamily: fonts.display, fontSize: 24, margin: "0 0 4px", color: colors.primaryDark }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p style={{ fontSize: 13.5, color: colors.textSoft, marginBottom: 24 }}>
            {mode === "login"
              ? `Sign in as a ${role === "caregiver" ? "family member" : role} to continue.`
              : role === "caregiver"
              ? "A patient must add your email from their portal before you can register here."
              : `Register as a ${role} to get started.`}
          </p>

          {error && (
            <div
              style={{
                background: colors.dangerSoft,
                color: colors.danger,
                borderRadius: radius.sm,
                padding: "10px 14px",
                fontSize: 13.5,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field
                label="Email"
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                placeholder="you@example.com"
              />
              <Field
                label="Password"
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••"
              />
              <Button type="submit" disabled={loading} fullWidth style={{ marginTop: 8 }}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          ) : role === "doctor" ? (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Full Name" required value={doctorForm.name} onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })} />
              <Field label="Email" type="email" required value={doctorForm.email} onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })} />
              <Field label="Password" type="password" required value={doctorForm.password} onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })} />
              <Field label="Specialization" required value={doctorForm.specialization} onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })} />
              <Field label="Clinic Name" required value={doctorForm.clinic} onChange={(e) => setDoctorForm({ ...doctorForm, clinic: e.target.value })} />
              <Field label="Registration Number" required value={doctorForm.reg_no} onChange={(e) => setDoctorForm({ ...doctorForm, reg_no: e.target.value })} />
              <Field label="Phone" required value={doctorForm.phone} onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })} />
              <Button type="submit" disabled={loading} fullWidth style={{ marginTop: 8 }}>
                {loading ? "Creating account…" : "Create Doctor Account"}
              </Button>
            </form>
          ) : role === "patient" ? (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Full Name" required value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} />
              <Field label="Email" type="email" required value={patientForm.email} onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })} />
              <Field label="Password" type="password" required value={patientForm.password} onChange={(e) => setPatientForm({ ...patientForm, password: e.target.value })} />
              <Field label="Phone" value={patientForm.phone} onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })} />
              <Field label="Age" type="number" value={patientForm.age} onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })} />
              <Field
                label="Claim Code (given by your doctor at your visit)"
                required
                value={patientForm.claim_code}
                onChange={(e) => setPatientForm({ ...patientForm, claim_code: e.target.value })}
              />
              <Button type="submit" disabled={loading} fullWidth style={{ marginTop: 8 }}>
                {loading ? "Creating account…" : "Create Patient Account"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Full Name" required value={caregiverForm.name} onChange={(e) => setCaregiverForm({ ...caregiverForm, name: e.target.value })} />
              <Field
                label="Email (must match what the patient added)"
                type="email"
                required
                value={caregiverForm.email}
                onChange={(e) => setCaregiverForm({ ...caregiverForm, email: e.target.value })}
              />
              <Field label="Password" type="password" required value={caregiverForm.password} onChange={(e) => setCaregiverForm({ ...caregiverForm, password: e.target.value })} />
              <Field label="Phone" value={caregiverForm.phone} onChange={(e) => setCaregiverForm({ ...caregiverForm, phone: e.target.value })} />
              <Field
                label="Claim Code (given by the patient in their Family Access section)"
                required
                value={caregiverForm.claim_code}
                onChange={(e) => setCaregiverForm({ ...caregiverForm, claim_code: e.target.value })}
              />
              <Button type="submit" disabled={loading} fullWidth style={{ marginTop: 8 }}>
                {loading ? "Creating account…" : "Create Family Account"}
              </Button>
            </form>
          )}

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13.5, color: colors.textSoft }}>
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  style={linkStyle}
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  style={linkStyle}
                >
                  Sign In
                </button>
              </>
            )}
          </div>

          {mode === "login" && (
            <div
              style={{
                marginTop: 24,
                padding: "12px 14px",
                background: colors.bg,
                borderRadius: radius.sm,
                fontSize: 12.5,
                color: colors.textFaint,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} color={colors.textFaint} />
              <span>
                Demo login —{" "}
                {role === "doctor"
                  ? "doctor@demo.com / demo123"
                  : role === "patient"
                  ? "patient@demo.com / demo123"
                  : "amit.son@example.com / caregiver123"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const linkStyle = {
  background: "none",
  border: "none",
  color: "#0D5C63",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  fontSize: 13.5,
};
