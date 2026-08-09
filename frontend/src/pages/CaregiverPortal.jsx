import { useEffect, useState } from "react";
import { FileText, FlaskConical, LogOut, Pill, Stethoscope, Thermometer, Type, User, Users, Utensils } from "lucide-react";
import { colors, fonts, radius } from "../theme";
import { api } from "../api/client";
import { useAuth } from "../AuthContext";
import { useIsMobile } from "../useIsMobile";
import { useUiLang } from "../i18n";
import Card from "../components/Card";
import Badge from "../components/Badge";
import LanguageToggle from "../components/LanguageToggle";
import EditProfileModal from "../components/EditProfileModal";
import AudioPlayButton from "../components/AudioPlayButton";
import DownloadPdfButton from "../components/DownloadPdfButton";

export default function CaregiverPortal() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { toggleUiLang, t } = useUiLang();

  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [largeText, setLargeText] = useState(() => localStorage.getItem("sehatrx_large_text") === "1");

  function toggleLargeText() {
    setLargeText((prev) => {
      const next = !prev;
      localStorage.setItem("sehatrx_large_text", next ? "1" : "0");
      return next;
    });
  }

  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [selectedRxId, setSelectedRxId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [lang, setLang] = useState("en");
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    api
      .get("/caregiver/patients")
      .then((list) => {
        setPatients(list);
        if (list.length > 0) setSelectedPatientId(list[0].id);
      })
      .finally(() => setLoadingPatients(false));
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    setLoadingPrescriptions(true);
    setSelectedRxId(null);
    setDetail(null);
    api
      .get(`/caregiver/patients/${selectedPatientId}/prescriptions`)
      .then((list) => {
        setPrescriptions(list);
        if (list.length > 0) setSelectedRxId(list[0].id);
      })
      .finally(() => setLoadingPrescriptions(false));
  }, [selectedPatientId]);

  useEffect(() => {
    if (!selectedPatientId || !selectedRxId) return;
    setLoadingDetail(true);
    setLang("en");
    api
      .get(`/caregiver/patients/${selectedPatientId}/prescriptions/${selectedRxId}`)
      .then(setDetail)
      .finally(() => setLoadingDetail(false));
  }, [selectedPatientId, selectedRxId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

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

      <main style={{ padding: isMobile ? "24px 20px" : "36px 40px", maxWidth: 1100, margin: "0 auto" }}>
        {isMobile && <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>{t("welcome", user?.name)}</div>}

        <h1 style={{ fontFamily: fonts.display, fontSize: 24, margin: "0 0 6px", color: colors.primaryDark }}>
          {t("familyAccessPageTitle")}
        </h1>
        <p style={{ fontSize: 13.5, color: colors.textSoft, marginBottom: 24 }}>{t("familyAccessPageDesc")}</p>

        {loadingPatients ? (
          <Card style={{ textAlign: "center", color: colors.textFaint, padding: 40 }}>{t("loading")}</Card>
        ) : patients.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 48 }}>
            <Users size={28} color={colors.textFaint} style={{ marginBottom: 10 }} />
            <div style={{ color: colors.textSoft, fontSize: 14.5 }}>{t("noPatientsLinkedDesc")}</div>
          </Card>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 16px 8px 8px",
                    borderRadius: radius.pill,
                    border: `1.5px solid ${selectedPatientId === p.id ? colors.primary : colors.border}`,
                    background: selectedPatientId === p.id ? colors.primarySoft : colors.surface,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: colors.primarySoft,
                      color: colors.primaryDark,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: fonts.display,
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: colors.textSoft }}>
                      {p.relationship_label || "Family member"}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {loadingPrescriptions ? (
              <Card style={{ textAlign: "center", color: colors.textFaint, padding: 40 }}>{t("loading")}</Card>
            ) : prescriptions.length === 0 ? (
              <Card style={{ textAlign: "center", padding: 48 }}>
                <FileText size={28} color={colors.textFaint} style={{ marginBottom: 10 }} />
                <div style={{ color: colors.textSoft, fontSize: 14.5 }}>
                  {t("patientNoPrescriptions", selectedPatient?.name)}
                </div>
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
                      onClick={() => setSelectedRxId(p.id)}
                      style={{
                        cursor: "pointer",
                        minWidth: isMobile ? 240 : undefined,
                        border: `1.5px solid ${selectedRxId === p.id ? colors.primary : colors.border}`,
                        background: selectedRxId === p.id ? colors.primarySoft : colors.surface,
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
                            path={`/caregiver/patients/${selectedPatientId}/prescriptions/${detail.id}/audio?lang=${lang}`}
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
                          <DownloadPdfButton
                            path={`/caregiver/patients/${selectedPatientId}/prescriptions/${detail.id}/pdf?lang=${lang}`}
                            filename={`prescription-${detail.created_at.slice(0, 10)}.pdf`}
                            disabled={lang === "hi" && !detail.chief_complaint_hi}
                            iconOnly={isMobile}
                          />
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

                      {detail.patient_known_allergies && (
                        <div
                          style={{
                            background: colors.dangerSoft,
                            border: `1.5px solid ${colors.danger}`,
                            borderRadius: radius.sm,
                            padding: "10px 14px",
                            marginBottom: 20,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: colors.danger, textTransform: "uppercase", letterSpacing: 0.3 }}>
                            {lang === "hi" ? "ज्ञात एलर्जी" : "Known Allergies"}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: colors.danger, marginTop: 2 }}>
                            {detail.patient_known_allergies}
                          </div>
                        </div>
                      )}

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
          </>
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
