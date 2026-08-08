import { useEffect, useState } from "react";
import { AlertTriangle, FileText, FlaskConical, LogOut, Pill, Plus, Printer, Stethoscope, Thermometer, Trash2, Type, User, Users, Utensils } from "lucide-react";
import { colors, fonts, radius } from "../theme";
import { api, ApiError } from "../api/client";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { useIsMobile } from "../useIsMobile";
import { useUiLang } from "../i18n";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Field from "../components/Field";
import LanguageToggle from "../components/LanguageToggle";
import EditProfileModal from "../components/EditProfileModal";
import AudioPlayButton from "../components/AudioPlayButton";

const emptyCaregiverForm = { name: "", email: "", phone: "", relationship_label: "" };

export default function PatientPortal() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const showToast = useToast();
  const { uiLang, toggleUiLang, t } = useUiLang();

  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [lang, setLang] = useState("en");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [largeText, setLargeText] = useState(() => localStorage.getItem("sehatrx_large_text") === "1");

  function toggleLargeText() {
    setLargeText((prev) => {
      const next = !prev;
      localStorage.setItem("sehatrx_large_text", next ? "1" : "0");
      return next;
    });
  }

  const [caregivers, setCaregivers] = useState([]);
  const [loadingCaregivers, setLoadingCaregivers] = useState(true);
  const [showAddCaregiver, setShowAddCaregiver] = useState(false);
  const [caregiverForm, setCaregiverForm] = useState(emptyCaregiverForm);
  const [addingCaregiver, setAddingCaregiver] = useState(false);
  const [caregiverError, setCaregiverError] = useState("");

  useEffect(() => {
    api
      .get("/patients/me/prescriptions")
      .then((list) => {
        setPrescriptions(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .finally(() => setLoading(false));
    loadCaregivers();
  }, []);

  function loadCaregivers() {
    setLoadingCaregivers(true);
    api
      .get("/patients/me/caregivers")
      .then(setCaregivers)
      .finally(() => setLoadingCaregivers(false));
  }

  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    setLang("en");
    api
      .get(`/patients/me/prescriptions/${selectedId}`)
      .then(setDetail)
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  async function handleAddCaregiver(e) {
    e.preventDefault();
    setAddingCaregiver(true);
    setCaregiverError("");
    try {
      await api.post("/patients/me/caregivers", caregiverForm);
      showToast(`${caregiverForm.name} added to your family access list.`);
      setCaregiverForm(emptyCaregiverForm);
      setShowAddCaregiver(false);
      loadCaregivers();
    } catch (e) {
      setCaregiverError(e instanceof ApiError ? e.message : "Couldn't add this family member. Please try again.");
    } finally {
      setAddingCaregiver(false);
    }
  }

  async function handleRevokeCaregiver(caregiverId) {
    await api.delete(`/patients/me/caregivers/${caregiverId}`);
    setCaregivers((prev) => prev.filter((c) => c.id !== caregiverId));
    showToast("Family member access removed.");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: isMobile ? "16px 20px" : "18px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 800 }}>
          <span style={{ color: colors.primaryDark }}>Sehat</span>
          <span style={{ color: colors.accent }}>Rx</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {!isMobile && <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("welcome", user?.name)}</div>}
          <button
            onClick={toggleUiLang}
            title="Switch app language"
            style={{
              padding: "6px 12px",
              borderRadius: radius.pill,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.primaryDark,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("uiLangToggleLabel")}
          </button>
          <button
            onClick={() => setShowEditProfile(true)}
            title={t("editProfile")}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: colors.primarySoft,
              color: colors.primaryDark,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {user?.name?.charAt(0).toUpperCase()}
          </button>
          <button
            onClick={logout}
            title={t("logOut")}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSoft, padding: 4 }}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <main style={{ padding: isMobile ? "24px 20px" : "36px 40px", maxWidth: 1000, margin: "0 auto" }}>
        {isMobile && (
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>{t("welcome", user?.name)}</div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            background: colors.dangerSoft,
            border: `1.5px solid ${colors.danger}`,
            borderRadius: radius.sm,
            padding: "12px 16px",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertTriangle size={18} color={colors.danger} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: colors.danger }}>{t("knownAllergies")}</div>
              <div style={{ fontSize: 13, color: colors.danger, marginTop: 2 }}>
                {user?.known_allergies || t("noAllergiesOnFile")}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowEditProfile(true)}
            style={{
              background: "none",
              border: "none",
              color: colors.danger,
              fontSize: 12.5,
              fontWeight: 600,
              textDecoration: "underline",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {t("edit")}
          </button>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Users size={17} color={colors.primary} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t("familyAccess")}</div>
                <div style={{ fontSize: 12.5, color: colors.textSoft }}>{t("familyAccessDesc")}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" icon={Plus} onClick={() => setShowAddCaregiver((v) => !v)}>
              {t("addFamilyMember")}
            </Button>
          </div>

          {caregiverError && (
            <div
              style={{
                background: colors.dangerSoft,
                color: colors.danger,
                borderRadius: radius.sm,
                padding: "10px 14px",
                fontSize: 13.5,
                marginTop: 14,
              }}
            >
              {caregiverError}
            </div>
          )}

          {showAddCaregiver && (
            <form
              onSubmit={handleAddCaregiver}
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${colors.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                <Field
                  label="Name"
                  required
                  value={caregiverForm.name}
                  onChange={(e) => setCaregiverForm({ ...caregiverForm, name: e.target.value })}
                  style={{ flex: 1 }}
                />
                <Field
                  label="Relationship"
                  placeholder="e.g. Son, Daughter"
                  value={caregiverForm.relationship_label}
                  onChange={(e) => setCaregiverForm({ ...caregiverForm, relationship_label: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                <Field
                  label="Email"
                  type="email"
                  required
                  value={caregiverForm.email}
                  onChange={(e) => setCaregiverForm({ ...caregiverForm, email: e.target.value })}
                  style={{ flex: 1 }}
                />
                <Field
                  label="Phone (optional)"
                  value={caregiverForm.phone}
                  onChange={(e) => setCaregiverForm({ ...caregiverForm, phone: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
              <Button type="submit" size="sm" disabled={addingCaregiver} style={{ alignSelf: "flex-start" }}>
                {addingCaregiver ? "Adding…" : "Give Access"}
              </Button>
            </form>
          )}

          {!loadingCaregivers && caregivers.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
              {caregivers.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: colors.bg,
                    borderRadius: radius.sm,
                    padding: "10px 14px",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                      {c.name} {c.relationship_label && <span style={{ color: colors.textSoft, fontWeight: 500 }}>· {c.relationship_label}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSoft, marginTop: 1 }}>{c.email}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Badge tone={c.has_registered ? "sent" : "pending"}>{c.has_registered ? t("active") : t("pending")}</Badge>
                    <button
                      onClick={() => handleRevokeCaregiver(c.id)}
                      title="Remove access"
                      style={{ background: "none", border: "none", cursor: "pointer", color: colors.danger, padding: 4 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <h1 style={{ fontFamily: fonts.display, fontSize: 24, margin: "0 0 24px", color: colors.primaryDark }}>
          {t("yourPrescriptions")}
        </h1>

        {loading ? (
          <Card style={{ textAlign: "center", color: colors.textFaint, padding: 40 }}>{t("loading")}</Card>
        ) : prescriptions.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 48 }}>
            <FileText size={28} color={colors.textFaint} style={{ marginBottom: 10 }} />
            <div style={{ color: colors.textSoft, fontSize: 14.5 }}>{t("noPrescriptionsDesc")}</div>
          </Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "320px 1fr",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 10, overflowX: isMobile ? "auto" : "visible" }}>
              {prescriptions.map((p) => (
                <Card
                  key={p.id}
                  padding={14}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    cursor: "pointer",
                    minWidth: isMobile ? 240 : undefined,
                    border: `1.5px solid ${selectedId === p.id ? colors.primary : colors.border}`,
                    background: selectedId === p.id ? colors.primarySoft : colors.surface,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.doctor_name || "Doctor"}</div>
                      <div style={{ fontSize: 12, color: colors.textSoft, marginTop: 2 }}>
                        {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    <Badge tone="sent">Approved</Badge>
                  </div>
                </Card>
              ))}
            </div>

            <div>
              {loadingDetail || !detail ? (
                <Card style={{ textAlign: "center", color: colors.textFaint, padding: 40 }}>
                  {loadingDetail ? t("loading") : t("selectPrescription")}
                </Card>
              ) : (
                <Card id="printable-rx" style={{ zoom: largeText ? 1.18 : 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: colors.primarySoft,
                          color: colors.primaryDark,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: fonts.display,
                          fontWeight: 700,
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        {detail.doctor_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.doctor_name}</div>
                        <div style={{ fontSize: 12.5, color: colors.textSoft }}>
                          {detail.doctor_specialization} · {detail.doctor_clinic}
                        </div>
                        <div style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                          Reg. No {detail.doctor_reg_no} ·{" "}
                          {new Date(detail.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                    </div>
                    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <AudioPlayButton
                        path={`/patients/me/prescriptions/${detail.id}/audio?lang=${lang}`}
                        disabled={lang === "hi" && !detail.chief_complaint_hi}
                        iconOnly={isMobile}
                      />
                      <button
                        onClick={toggleLargeText}
                        title={largeText ? "Switch to normal text size" : "Switch to larger text size"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: isMobile ? 0 : 6,
                          padding: isMobile ? 8 : "6px 12px",
                          borderRadius: radius.pill,
                          border: `1px solid ${largeText ? colors.primary : colors.border}`,
                          background: largeText ? colors.primarySoft : colors.surface,
                          color: colors.primaryDark,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Type size={14} />
                        {!isMobile && "Larger Text"}
                      </button>
                      <button
                        onClick={() => window.print()}
                        title="Print or save as PDF"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: isMobile ? 0 : 6,
                          padding: isMobile ? 8 : "6px 12px",
                          borderRadius: radius.pill,
                          border: `1px solid ${colors.border}`,
                          background: colors.surface,
                          color: colors.primaryDark,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Printer size={14} />
                        {!isMobile && "Print"}
                      </button>
                      <LanguageToggle lang={lang} onChange={setLang} hindiAvailable={!!detail.chief_complaint_hi} />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      color: colors.textSoft,
                      marginBottom: 20,
                    }}
                  >
                    <User size={14} color={colors.textFaint} />
                    <span style={{ fontWeight: 600, color: colors.text }}>{detail.patient_name}</span>
                    {(detail.patient_age || detail.patient_gender) && (
                      <span>
                        · {[detail.patient_age && `${detail.patient_age} yrs`, detail.patient_gender].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>

                  <Section title={lang === "hi" ? "मुख्य शिकायत" : "Chief Complaint"}>
                    {(lang === "hi" ? detail.chief_complaint_hi : detail.chief_complaint) || "—"}
                  </Section>
                  <Section title={lang === "hi" ? "निदान" : "Diagnosis"}>
                    {(lang === "hi" ? detail.diagnosis_hi : detail.diagnosis) || "—"}
                  </Section>

                  {(detail.temperature || detail.blood_pressure || detail.pulse || detail.weight) && (
                    <div style={{ marginBottom: 20 }}>
                      <SectionLabel icon={Thermometer}>{lang === "hi" ? "वाइटल्स" : "Vitals"}</SectionLabel>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {detail.temperature && <Badge tone="default">Temp: {detail.temperature}</Badge>}
                        {detail.blood_pressure && <Badge tone="default">BP: {detail.blood_pressure}</Badge>}
                        {detail.pulse && <Badge tone="default">Pulse: {detail.pulse}</Badge>}
                        {detail.weight && <Badge tone="default">Weight: {detail.weight}</Badge>}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: 20 }}>
                    <SectionLabel icon={Pill}>{lang === "hi" ? "दवाइयाँ" : "Medicines"}</SectionLabel>
                    {detail.medicines.length === 0 ? (
                      <div style={{ fontSize: 13.5, color: colors.textFaint }}>No medicines prescribed.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {detail.medicines.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              background: colors.bg,
                              borderRadius: radius.sm,
                              padding: "10px 14px",
                              gap: 12,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                              <div style={{ fontSize: 12.5, color: colors.textSoft }}>
                                {[
                                  m.dose,
                                  lang === "hi" ? m.frequency_hi || m.frequency : m.frequency,
                                  (lang === "hi" ? m.timing_when_hi || m.timing_when : m.timing_when) || null,
                                  (lang === "hi" ? m.timing_hi || m.timing : m.timing) || null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                            <Badge tone="default">{lang === "hi" ? m.duration_hi || m.duration : m.duration}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {detail.tests.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <SectionLabel icon={FlaskConical}>{lang === "hi" ? "जांच" : "Tests / Investigations"}</SectionLabel>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {detail.tests.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              background: colors.bg,
                              borderRadius: radius.sm,
                              padding: "10px 14px",
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                            {(lang === "hi" ? t.instructions_hi || t.instructions : t.instructions) && (
                              <div style={{ fontSize: 12.5, color: colors.textSoft, marginTop: 2 }}>
                                {lang === "hi" ? t.instructions_hi || t.instructions : t.instructions}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(detail.diet_advice || detail.diet_advice_hi) && (
                    <Section title={lang === "hi" ? "खान-पान" : "Diet Advice"} icon={Utensils}>
                      {(lang === "hi" ? detail.diet_advice_hi : detail.diet_advice) || "—"}
                    </Section>
                  )}

                  <Section title={lang === "hi" ? "सलाह" : "Advice"}>
                    {(lang === "hi" ? detail.advice_hi : detail.advice) || "—"}
                  </Section>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>

      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
    </div>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      {Icon && <Icon size={14} color={colors.primary} />}
      <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {children}
      </span>
    </div>
  );
}

function Section({ title, icon = Stethoscope, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel icon={icon}>{title}</SectionLabel>
      <div style={{ fontSize: 14, color: colors.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{children}</div>
    </div>
  );
}
