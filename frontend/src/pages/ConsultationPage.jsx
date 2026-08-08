import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Mic,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Thermometer,
  Trash2,
  Utensils,
} from "lucide-react";
import { colors, fonts, radius } from "../theme";
import { api, ApiError } from "../api/client";
import { useAuth } from "../AuthContext";
import { useIsMobile } from "../useIsMobile";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Field from "../components/Field";
import Waveform from "../components/Waveform";
import LanguageToggle from "../components/LanguageToggle";

const STEPS = ["Record", "Transcript", "Prescription"];

function pickMimeType() {
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function emptyMedicine() {
  return { name: "", dose: "", freq: "", duration: "", durationInferred: false, timing: "", timingWhen: "" };
}

function emptyTest() {
  return { name: "", instructions: "" };
}

function emptyVitals() {
  return { temperature: "", bloodPressure: "", pulse: "", weight: "" };
}

const TIMING_OPTIONS = ["", "Before Food", "After Food", "With Food", "Empty Stomach", "Anytime"];
const TIMING_WHEN_OPTIONS = ["", "Morning", "Afternoon", "Evening", "Night", "Anytime"];

const MAX_RECORDING_SECONDS = 600; // 10 minutes - keeps Whisper cost/upload size predictable
const RECORDING_WARNING_SECONDS = MAX_RECORDING_SECONDS - 60;

export default function ConsultationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const [stage, setStage] = useState("loading");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState(null);
  const [patientGender, setPatientGender] = useState(null);
  const [patientKnownAllergies, setPatientKnownAllergies] = useState(null);
  const [patientId, setPatientId] = useState(null);
  const [newAllergyMentioned, setNewAllergyMentioned] = useState(null);
  const [savingAllergy, setSavingAllergy] = useState(false);
  const [consultationDate, setConsultationDate] = useState(null);
  const [error, setError] = useState("");
  const [readOnly, setReadOnly] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioLevels, setAudioLevels] = useState([]);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const levelsAnimationRef = useRef(null);

  // Transcript state
  const [transcript, setTranscript] = useState("");

  // Prescription state
  const [rx, setRx] = useState({
    chiefComplaint: "",
    diagnosis: "",
    vitals: emptyVitals(),
    medicines: [emptyMedicine()],
    tests: [],
    dietAdvice: "",
    advice: "",
  });
  const [lang, setLang] = useState("en");

  useEffect(() => {
    loadConsultation();
    return () => {
      clearInterval(timerRef.current);
      stopAudioLevelAnalysis();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadConsultation() {
    try {
      const list = await api.get("/consultations");
      const consultation = list.find((c) => c.id === id);
      if (!consultation) {
        setError("Consultation not found.");
        setStage("record");
        return;
      }
      setPatientName(consultation.patient_name);
      setPatientAge(consultation.patient_age);
      setPatientGender(consultation.patient_gender);
      setPatientKnownAllergies(consultation.patient_known_allergies);
      setPatientId(consultation.patient_id);
      setConsultationDate(consultation.created_at);
      if (consultation.status === "sent") {
        setRx(mapPrescriptionToForm(consultation.prescription));
        setTranscript(consultation.transcript_text || "");
        setReadOnly(true);
        setLang("en");
        setStage("view-sent");
      } else if (consultation.prescription) {
        setRx(mapPrescriptionToForm(consultation.prescription));
        setTranscript(consultation.transcript_text || "");
        setStage("prescription");
      } else if (consultation.transcript_text) {
        setTranscript(consultation.transcript_text);
        setStage("transcript");
      } else {
        setStage("record");
      }
    } catch (e) {
      setError(e.message);
      setStage("record");
    }
  }

  function mapPrescriptionToForm(prescription) {
    return {
      chiefComplaint: prescription.chief_complaint || "",
      diagnosis: prescription.diagnosis || "",
      dietAdvice: prescription.diet_advice || "",
      advice: prescription.advice || "",
      chiefComplaintHi: prescription.chief_complaint_hi || "",
      diagnosisHi: prescription.diagnosis_hi || "",
      dietAdviceHi: prescription.diet_advice_hi || "",
      adviceHi: prescription.advice_hi || "",
      vitals: {
        temperature: prescription.temperature || "",
        bloodPressure: prescription.blood_pressure || "",
        pulse: prescription.pulse || "",
        weight: prescription.weight || "",
      },
      medicines: prescription.medicines.length
        ? prescription.medicines.map((m) => ({
            name: m.name,
            dose: m.dose,
            freq: m.frequency,
            duration: m.duration,
            durationInferred: m.duration_inferred || false,
            timing: m.timing || "",
            timingWhen: m.timing_when || "",
            freqHi: m.frequency_hi || "",
            durationHi: m.duration_hi || "",
            timingHi: m.timing_hi || "",
            timingWhenHi: m.timing_when_hi || "",
          }))
        : [emptyMedicine()],
      tests: prescription.tests.map((t) => ({
        name: t.name,
        instructions: t.instructions || "",
        instructionsHi: t.instructions_hi || "",
      })),
    };
  }

  function startAudioLevelAnalysis(stream) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContext.resume?.();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const barCount = 24;
      const step = Math.max(1, Math.floor(dataArray.length / barCount));

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const levels = [];
        for (let i = 0; i < barCount; i++) {
          levels.push(dataArray[i * step] / 255);
        }
        setAudioLevels(levels);
        levelsAnimationRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Live waveform is a nice-to-have; recording itself doesn't depend on it.
    }
  }

  function stopAudioLevelAnalysis() {
    if (levelsAnimationRef.current) cancelAnimationFrame(levelsAnimationRef.current);
    levelsAnimationRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevels([]);
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setAudioBlob(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        handleTranscribe(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      startAudioLevelAnalysis(stream);
      setIsRecording(true);
      elapsedRef.current = 0;
      setElapsed(0);
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch (e) {
      setError("Couldn't access your microphone. Please grant permission and try again.");
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    stopAudioLevelAnalysis();
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  }

  async function handleTranscribe(blob) {
    setStage("transcribing");
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "consultation.webm");
      const res = await api.postForm(`/consultations/${id}/transcribe`, formData);
      setTranscript(res.transcript_text);
      setStage("transcript");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't transcribe the recording. Please try again.");
      setStage("record");
    }
  }

  function retryTranscription() {
    if (audioBlob) handleTranscribe(audioBlob);
  }

  async function handleGenerateDraft() {
    setStage("generating");
    setError("");
    try {
      await api.patch(`/consultations/${id}/transcript`, { transcript_text: transcript });
      const draft = await api.post(`/consultations/${id}/draft-rx`, {});
      setRx(mapPrescriptionToForm(draft));
      setNewAllergyMentioned(draft.new_allergy_mentioned || null);
      setStage("prescription");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't generate a prescription draft. Please try again.");
      setStage("transcript");
    }
  }

  async function handleSaveMentionedAllergy() {
    if (!patientId || !newAllergyMentioned) return;
    setSavingAllergy(true);
    try {
      const updatedAllergies = patientKnownAllergies
        ? `${patientKnownAllergies}, ${newAllergyMentioned}`
        : newAllergyMentioned;
      await api.patch(`/patients/${patientId}/allergies`, { known_allergies: updatedAllergies });
      setPatientKnownAllergies(updatedAllergies);
      setNewAllergyMentioned(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this allergy. Please try again.");
    } finally {
      setSavingAllergy(false);
    }
  }

  function updateMedicine(index, field, value) {
    setRx((prev) => {
      const medicines = [...prev.medicines];
      medicines[index] = { ...medicines[index], [field]: value };
      if (field === "duration") medicines[index].durationInferred = false;
      return { ...prev, medicines };
    });
  }

  function addMedicine() {
    setRx((prev) => ({ ...prev, medicines: [...prev.medicines, emptyMedicine()] }));
  }

  function removeMedicine(index) {
    setRx((prev) => ({ ...prev, medicines: prev.medicines.filter((_, i) => i !== index) }));
  }

  function updateTest(index, field, value) {
    setRx((prev) => {
      const tests = [...prev.tests];
      tests[index] = { ...tests[index], [field]: value };
      return { ...prev, tests };
    });
  }

  function addTest() {
    setRx((prev) => ({ ...prev, tests: [...prev.tests, emptyTest()] }));
  }

  function removeTest(index) {
    setRx((prev) => ({ ...prev, tests: prev.tests.filter((_, i) => i !== index) }));
  }

  async function handleApprove() {
    setError("");
    try {
      const cleanMedicines = rx.medicines.filter((m) => m.name.trim());
      const cleanTests = rx.tests.filter((t) => t.name.trim());
      await api.patch(`/consultations/${id}/prescription`, { ...rx, medicines: cleanMedicines, tests: cleanTests });
      await api.post(`/consultations/${id}/approve`, {});
      setStage("sent");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the prescription. Please try again.");
    }
  }

  const stepIndex =
    { record: 0, transcribing: 0, transcript: 1, generating: 1, prescription: 2, "view-sent": 2, sent: 2 }[stage] ?? 0;

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: isMobile ? "16px 20px" : "18px 40px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          onClick={() => navigate("/dashboard")}
          style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSoft, padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{patientName || "Consultation"}</div>
          <div style={{ fontSize: 12, color: colors.textSoft }}>Consultation in progress</div>
        </div>
      </header>

      <main style={{ padding: isMobile ? "24px 20px" : "36px 40px", maxWidth: 720, margin: "0 auto" }}>
        {patientKnownAllergies && stage !== "sent" && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: colors.dangerSoft,
              border: `1.5px solid ${colors.danger}`,
              borderRadius: radius.sm,
              padding: "12px 16px",
              marginBottom: 24,
            }}
          >
            <AlertTriangle size={18} color={colors.danger} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: colors.danger }}>
                Known Allergies — {patientName}
              </div>
              <div style={{ fontSize: 13, color: colors.danger, marginTop: 2 }}>{patientKnownAllergies}</div>
            </div>
          </div>
        )}

        {stage !== "sent" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
            {STEPS.map((label, i) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12.5,
                      fontWeight: 700,
                      background: i <= stepIndex ? colors.primary : colors.primarySoft,
                      color: i <= stepIndex ? "#fff" : colors.primaryDark,
                    }}
                  >
                    {i + 1}
                  </div>
                  {!isMobile && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: i <= stepIndex ? colors.primaryDark : colors.textFaint,
                      }}
                    >
                      {label}
                    </span>
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: isMobile ? 20 : 36, height: 2, background: i < stepIndex ? colors.primary : colors.border }} />
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              background: colors.dangerSoft,
              color: colors.danger,
              borderRadius: radius.sm,
              padding: "12px 16px",
              fontSize: 13.5,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {stage === "record" && (
          <Card style={{ textAlign: "center", padding: 48 }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: 20, color: colors.primaryDark, marginTop: 0 }}>
              {isRecording ? "Recording…" : "Ready to record"}
            </h2>
            <p style={{ fontSize: 13.5, color: colors.textSoft, marginBottom: 32 }}>
              {isRecording && elapsed >= RECORDING_WARNING_SECONDS
                ? `Approaching the ${MAX_RECORDING_SECONDS / 60}-minute limit — recording will stop automatically.`
                : isRecording
                ? "Speak naturally. Tap the button again when the consultation is done."
                : "Tap the button to start recording the consultation."}
            </p>

            <Waveform active={isRecording} height={56} levels={audioLevels} />

            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 28,
                fontWeight: 700,
                color: isRecording && elapsed >= RECORDING_WARNING_SECONDS ? colors.danger : colors.text,
                margin: "20px 0",
              }}
            >
              {formatTime(elapsed)}
            </div>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                width: 84,
                height: 84,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                background: isRecording ? colors.danger : colors.accent,
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 8px 24px ${isRecording ? colors.danger : colors.accent}55`,
                transition: "transform 0.15s ease",
              }}
            >
              {isRecording ? <Square size={28} fill="currentColor" /> : <Mic size={32} />}
            </button>

            {audioBlob && !isRecording && (
              <div style={{ marginTop: 24 }}>
                <Button variant="outline" icon={RefreshCw} onClick={retryTranscription} size="sm">
                  Retry Transcription
                </Button>
              </div>
            )}
          </Card>
        )}

        {stage === "transcribing" && <LoadingState text="Transcribing the conversation…" />}
        {stage === "generating" && <LoadingState text="Drafting prescription…" />}

        {stage === "transcript" && (
          <Card>
            <h2 style={{ fontFamily: fonts.display, fontSize: 18, color: colors.primaryDark, marginTop: 0 }}>
              Transcript
            </h2>
            <p style={{ fontSize: 13, color: colors.textSoft, marginBottom: 16 }}>
              {readOnly
                ? "This consultation has already been sent to the patient."
                : "Review and correct the transcript below before generating the prescription draft."}
            </p>
            <Field
              as="textarea"
              rows={12}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Transcript will appear here…"
              readOnly={readOnly}
              inputStyle={readOnly ? { background: colors.bg, color: colors.textSoft } : undefined}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              {readOnly ? (
                <Button variant="outline" onClick={() => setStage("view-sent")}>
                  Back to Prescription
                </Button>
              ) : (
                <Button onClick={handleGenerateDraft} disabled={!transcript.trim()} icon={Send}>
                  Generate Prescription Draft
                </Button>
              )}
            </div>
          </Card>
        )}

        {stage === "prescription" && (
          <Card>
            <h2 style={{ fontFamily: fonts.display, fontSize: 18, color: colors.primaryDark, marginTop: 0 }}>
              Prescription Draft
            </h2>

            {newAllergyMentioned && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  background: colors.dangerSoft,
                  border: `1.5px solid ${colors.danger}`,
                  borderRadius: radius.sm,
                  padding: "12px 16px",
                  marginBottom: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AlertTriangle size={18} color={colors.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: colors.danger }}>
                      Possible new allergy mentioned
                    </div>
                    <div style={{ fontSize: 13, color: colors.danger, marginTop: 2 }}>
                      The patient mentioned <strong>{newAllergyMentioned}</strong> during this consultation. Save it
                      to their profile so future prescriptions warn about it too?
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Button size="sm" onClick={handleSaveMentionedAllergy} disabled={savingAllergy}>
                    {savingAllergy ? "Saving…" : "Save to Profile"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setNewAllergyMentioned(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 8 }}>
              <Field
                as="textarea"
                label="Chief Complaint"
                rows={2}
                value={rx.chiefComplaint}
                onChange={(e) => setRx({ ...rx, chiefComplaint: e.target.value })}
              />
              <Field
                label="Diagnosis"
                value={rx.diagnosis}
                onChange={(e) => setRx({ ...rx, diagnosis: e.target.value })}
              />

              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSoft }}>
                  Vitals (optional)
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <input
                    style={inputStyle}
                    placeholder="Temp (e.g. 101°F)"
                    value={rx.vitals.temperature}
                    onChange={(e) => setRx({ ...rx, vitals: { ...rx.vitals, temperature: e.target.value } })}
                  />
                  <input
                    style={inputStyle}
                    placeholder="BP (e.g. 120/80)"
                    value={rx.vitals.bloodPressure}
                    onChange={(e) => setRx({ ...rx, vitals: { ...rx.vitals, bloodPressure: e.target.value } })}
                  />
                  <input
                    style={inputStyle}
                    placeholder="Pulse (e.g. 88 bpm)"
                    value={rx.vitals.pulse}
                    onChange={(e) => setRx({ ...rx, vitals: { ...rx.vitals, pulse: e.target.value } })}
                  />
                  <input
                    style={inputStyle}
                    placeholder="Weight (e.g. 68 kg)"
                    value={rx.vitals.weight}
                    onChange={(e) => setRx({ ...rx, vitals: { ...rx.vitals, weight: e.target.value } })}
                  />
                </div>
              </div>

              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSoft }}>Medicines</span>
                <datalist id="timing-when-suggestions">
                  {TIMING_WHEN_OPTIONS.filter(Boolean).map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
                <datalist id="timing-suggestions">
                  {TIMING_OPTIONS.filter(Boolean).map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {rx.medicines.map((med, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1.4fr 0.9fr 0.9fr 0.9fr 1fr 1.1fr auto",
                        gap: 8,
                        alignItems: "center",
                        background: colors.bg,
                        padding: 10,
                        borderRadius: radius.sm,
                      }}
                    >
                      <input style={inputStyle} placeholder="Name" value={med.name} onChange={(e) => updateMedicine(i, "name", e.target.value)} />
                      <input style={inputStyle} placeholder="Dose" value={med.dose} onChange={(e) => updateMedicine(i, "dose", e.target.value)} />
                      <input style={inputStyle} placeholder="Frequency" value={med.freq} onChange={(e) => updateMedicine(i, "freq", e.target.value)} />
                      <div style={{ position: "relative" }}>
                        <input
                          style={med.durationInferred ? { ...inputStyle, paddingRight: 28 } : inputStyle}
                          placeholder="Duration"
                          value={med.duration}
                          onChange={(e) => updateMedicine(i, "duration", e.target.value)}
                        />
                        {med.durationInferred && (
                          <span
                            title="AI inferred this duration from a follow-up window, not an explicit instruction — please confirm it's right."
                            style={{
                              position: "absolute",
                              right: 8,
                              top: "50%",
                              transform: "translateY(-50%)",
                              display: "flex",
                              color: colors.accent,
                              cursor: "help",
                            }}
                          >
                            <Sparkles size={14} />
                          </span>
                        )}
                      </div>
                      <input
                        style={inputStyle}
                        list="timing-when-suggestions"
                        placeholder="When (e.g. Morning)"
                        value={med.timingWhen}
                        onChange={(e) => updateMedicine(i, "timingWhen", e.target.value)}
                      />
                      <input
                        style={inputStyle}
                        list="timing-suggestions"
                        placeholder="How (e.g. After Food)"
                        value={med.timing}
                        onChange={(e) => updateMedicine(i, "timing", e.target.value)}
                      />
                      <button
                        onClick={() => removeMedicine(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: colors.danger, padding: 6, justifySelf: isMobile ? "end" : "center" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" icon={Plus} onClick={addMedicine} style={{ marginTop: 10 }}>
                  Add Medicine
                </Button>
              </div>

              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSoft }}>
                  Tests / Investigations
                </span>
                {rx.tests.length === 0 && (
                  <div style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>
                    None recommended in this consultation.
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {rx.tests.map((test, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1.3fr 2fr auto",
                        gap: 8,
                        alignItems: "center",
                        background: colors.bg,
                        padding: 10,
                        borderRadius: radius.sm,
                      }}
                    >
                      <input
                        style={inputStyle}
                        placeholder="Test name (e.g. CBC)"
                        value={test.name}
                        onChange={(e) => updateTest(i, "name", e.target.value)}
                      />
                      <input
                        style={inputStyle}
                        placeholder="Instructions (optional, e.g. fasting required)"
                        value={test.instructions}
                        onChange={(e) => updateTest(i, "instructions", e.target.value)}
                      />
                      <button
                        onClick={() => removeTest(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: colors.danger, padding: 6, justifySelf: isMobile ? "end" : "center" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" icon={Plus} onClick={addTest} style={{ marginTop: 10 }}>
                  Add Test
                </Button>
              </div>

              <Field
                as="textarea"
                label="Diet Advice"
                icon={Utensils}
                placeholder="e.g. Bland diet, khichdi for two days, drink ORS, avoid spicy and oily food"
                rows={2}
                value={rx.dietAdvice}
                onChange={(e) => setRx({ ...rx, dietAdvice: e.target.value })}
              />

              <Field
                as="textarea"
                label="Advice"
                rows={3}
                value={rx.advice}
                onChange={(e) => setRx({ ...rx, advice: e.target.value })}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 28,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Button variant="outline" onClick={() => setStage("transcript")}>
                View Transcript
              </Button>
              <Button icon={Send} onClick={handleApprove}>
                Approve &amp; Send to Patient
              </Button>
            </div>
          </Card>
        )}

        {stage === "view-sent" && (
          <Card id="printable-rx">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontFamily: fonts.display, fontSize: 18, color: colors.primaryDark, margin: 0 }}>
                  Prescription
                </h2>
                <Badge tone="sent">Sent to Patient</Badge>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="no-print"
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
                <span className="no-print">
                  <LanguageToggle lang={lang} onChange={setLang} hindiAvailable={!!rx.chiefComplaintHi} />
                </span>
              </div>
            </div>
            <p className="no-print" style={{ fontSize: 13, color: colors.textSoft, marginBottom: 20 }}>
              This prescription has already been sent and can no longer be edited.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
                padding: "16px 0",
                marginBottom: 8,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{user?.name}</div>
                <div style={{ fontSize: 12.5, color: colors.textSoft }}>
                  {user?.specialization} · {user?.clinic}
                </div>
                <div style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>Reg. No {user?.reg_no}</div>
              </div>
              <div style={{ textAlign: isMobile ? "left" : "right" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{patientName}</div>
                {(patientAge || patientGender) && (
                  <div style={{ fontSize: 12.5, color: colors.textSoft }}>
                    {[patientAge && `${patientAge} yrs`, patientGender].filter(Boolean).join(", ")}
                  </div>
                )}
                {consultationDate && (
                  <div style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                    {new Date(consultationDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <ReadOnlySection label={lang === "hi" ? "मुख्य शिकायत" : "Chief Complaint"}>
                {(lang === "hi" ? rx.chiefComplaintHi : rx.chiefComplaint) || "—"}
              </ReadOnlySection>
              <ReadOnlySection label={lang === "hi" ? "निदान" : "Diagnosis"}>
                {(lang === "hi" ? rx.diagnosisHi : rx.diagnosis) || "—"}
              </ReadOnlySection>

              {(rx.vitals.temperature || rx.vitals.bloodPressure || rx.vitals.pulse || rx.vitals.weight) && (
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSoft, display: "flex", alignItems: "center", gap: 5 }}>
                    <Thermometer size={13} />
                    {lang === "hi" ? "वाइटल्स" : "Vitals"}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {rx.vitals.temperature && <Badge tone="default">Temp: {rx.vitals.temperature}</Badge>}
                    {rx.vitals.bloodPressure && <Badge tone="default">BP: {rx.vitals.bloodPressure}</Badge>}
                    {rx.vitals.pulse && <Badge tone="default">Pulse: {rx.vitals.pulse}</Badge>}
                    {rx.vitals.weight && <Badge tone="default">Weight: {rx.vitals.weight}</Badge>}
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSoft }}>
                  {lang === "hi" ? "दवाइयाँ" : "Medicines"}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {rx.medicines.filter((m) => m.name).length === 0 ? (
                    <div style={{ fontSize: 13.5, color: colors.textFaint }}>No medicines prescribed.</div>
                  ) : (
                    rx.medicines
                      .filter((m) => m.name)
                      .map((m, i) => (
                        <div
                          key={i}
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
                                lang === "hi" ? m.freqHi || m.freq : m.freq,
                                (lang === "hi" ? m.timingWhenHi || m.timingWhen : m.timingWhen) || null,
                                (lang === "hi" ? m.timingHi || m.timing : m.timing) || null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {m.durationInferred && (
                              <span title="AI inferred this duration from context, not an explicit instruction" style={{ display: "flex", color: colors.accent }}>
                                <Sparkles size={13} />
                              </span>
                            )}
                            <Badge tone="default">{lang === "hi" ? m.durationHi || m.duration : m.duration}</Badge>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {rx.tests.length > 0 && (
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSoft }}>
                    {lang === "hi" ? "जांच" : "Tests / Investigations"}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {rx.tests.map((t, i) => (
                      <div
                        key={i}
                        style={{
                          background: colors.bg,
                          borderRadius: radius.sm,
                          padding: "10px 14px",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                        {(lang === "hi" ? t.instructionsHi || t.instructions : t.instructions) && (
                          <div style={{ fontSize: 12.5, color: colors.textSoft, marginTop: 2 }}>
                            {lang === "hi" ? t.instructionsHi || t.instructions : t.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(rx.dietAdvice || rx.dietAdviceHi) && (
                <ReadOnlySection label={lang === "hi" ? "खान-पान" : "Diet Advice"} icon={Utensils}>
                  {(lang === "hi" ? rx.dietAdviceHi : rx.dietAdvice) || "—"}
                </ReadOnlySection>
              )}

              <ReadOnlySection label={lang === "hi" ? "सलाह" : "Advice"}>
                {(lang === "hi" ? rx.adviceHi : rx.advice) || "—"}
              </ReadOnlySection>
            </div>

            <div
              className="no-print"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 28,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Button variant="outline" onClick={() => setStage("transcript")}>
                View Transcript
              </Button>
              <Button variant="secondary" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        )}

        {stage === "sent" && (
          <Card style={{ textAlign: "center", padding: 48 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: colors.successSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle2 size={32} color={colors.success} />
            </div>
            <h2 style={{ fontFamily: fonts.display, fontSize: 20, color: colors.primaryDark, marginTop: 0 }}>
              Prescription Sent
            </h2>
            <p style={{ fontSize: 13.5, color: colors.textSoft, marginBottom: 28 }}>
              {patientName} can now view this prescription in their patient portal.
            </p>
            <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </Card>
        )}
      </main>
    </div>
  );
}

function ReadOnlySection({ label, icon: Icon, children }) {
  return (
    <div>
      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: colors.textSoft }}>
        {Icon && <Icon size={13} />}
        {label}
      </span>
      <div style={{ fontSize: 14.5, color: colors.text, lineHeight: 1.6, marginTop: 6, whiteSpace: "pre-wrap" }}>
        {children}
      </div>
    </div>
  );
}

function LoadingState({ text }) {
  return (
    <Card style={{ textAlign: "center", padding: 56 }}>
      <div
        style={{
          width: 40,
          height: 40,
          margin: "0 auto 20px",
          borderRadius: "50%",
          border: `3px solid ${colors.primarySoft}`,
          borderTopColor: colors.primary,
          animation: "sehatrx-spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes sehatrx-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 14.5, color: colors.textSoft, fontWeight: 500 }}>{text}</div>
    </Card>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13.5,
  border: `1.5px solid ${colors.border}`,
  borderRadius: radius.sm,
  outline: "none",
  background: colors.surface,
};
