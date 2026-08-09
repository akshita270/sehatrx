import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ClipboardList, Clock, LogOut, Plus, Search, Send, Stethoscope, Trash2, X } from "lucide-react";
import { colors, fonts, radius } from "../theme";
import { api } from "../api/client";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { useIsMobile } from "../useIsMobile";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Button from "../components/Button";
import PatientPickerModal from "../components/PatientPickerModal";
import EditProfileModal from "../components/EditProfileModal";

const STATUS_META = {
  recording: { label: "In Progress", tone: "default" },
  transcribing: { label: "In Progress", tone: "default" },
  transcript_ready: { label: "In Progress", tone: "default" },
  generating: { label: "In Progress", tone: "default" },
  drafted: { label: "Approval Pending", tone: "pending" },
  sent: { label: "Sent to Patient", tone: "sent" },
};

const IN_PROGRESS_STATUSES = ["recording", "transcribing", "transcript_ready", "generating"];

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In Progress" },
  { key: "drafted", label: "Approval Pending" },
  { key: "sent", label: "Sent to Patient" },
];

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const showToast = useToast();

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    loadConsultations();
  }, []);

  function loadConsultations() {
    setLoading(true);
    api
      .get("/consultations")
      .then(setConsultations)
      .finally(() => setLoading(false));
  }

  const stats = {
    total: consultations.length,
    pending: consultations.filter((c) => c.status === "drafted").length,
    sent: consultations.filter((c) => c.status === "sent").length,
  };

  const filteredConsultations = useMemo(() => {
    return consultations
      .filter((c) => {
        const matchesQuery = c.patient_name.toLowerCase().includes(query.trim().toLowerCase());
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "in_progress" ? IN_PROGRESS_STATUSES.includes(c.status) : c.status === statusFilter);
        const consultationDate = c.created_at.slice(0, 10);
        const matchesFrom = !dateFrom || consultationDate >= dateFrom;
        const matchesTo = !dateTo || consultationDate <= dateTo;
        return matchesQuery && matchesStatus && matchesFrom && matchesTo;
      })
      .sort((a, b) => (a.status === "drafted" ? -1 : 0) - (b.status === "drafted" ? -1 : 0));
  }, [consultations, query, statusFilter, dateFrom, dateTo]);

  const hasDateFilter = dateFrom || dateTo;

  function handleStartConsultation(consultation) {
    setShowPicker(false);
    navigate(`/consultation/${consultation.id}`);
  }

  function handleDeleteClick(e, consultationId) {
    e.stopPropagation();
    setConfirmingId(consultationId);
  }

  function handleCancelDelete(e) {
    e.stopPropagation();
    setConfirmingId(null);
  }

  async function handleConfirmDelete(e, consultation) {
    e.stopPropagation();
    setDeletingId(consultation.id);
    try {
      await api.delete(`/consultations/${consultation.id}`);
      setConsultations((prev) => prev.filter((c) => c.id !== consultation.id));
      showToast(`Consultation with ${consultation.patient_name} deleted.`);
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete this consultation. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
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
        <div>
          <div style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 800 }}>
            <span style={{ color: colors.primaryDark }}>Sehat</span>
            <span style={{ color: colors.accent }}>Rx</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {!isMobile && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Welcome, {user?.name}</div>
              <div style={{ fontSize: 12, color: colors.textSoft }}>{user?.clinic}</div>
            </div>
          )}
          <button
            onClick={() => setShowEditProfile(true)}
            title="Edit profile"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: colors.primarySoft,
              color: colors.primaryDark,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fonts.display,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {user?.name?.charAt(0).toUpperCase()}
          </button>
          <button
            onClick={logout}
            title="Log out"
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSoft, padding: 4 }}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <main style={{ padding: isMobile ? "24px 20px" : "36px 40px", maxWidth: 1100, margin: "0 auto" }}>
        {isMobile && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Welcome, {user?.name}</div>
            <div style={{ fontSize: 12.5, color: colors.textSoft }}>{user?.clinic}</div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h1 style={{ fontFamily: fonts.display, fontSize: 24, margin: 0, color: colors.primaryDark }}>
            Dashboard
          </h1>
          <Button icon={Plus} onClick={() => setShowPicker(true)}>
            New Consultation
          </Button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <StatCard icon={ClipboardList} label="Total Consultations" value={stats.total} tint={colors.primary} />
          <StatCard icon={Clock} label="Approval Pending" value={stats.pending} tint={colors.accent} />
          <StatCard icon={Send} label="Sent to Patient" value={stats.sent} tint={colors.success} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2 style={{ fontFamily: fonts.display, fontSize: 17, color: colors.primaryDark, margin: 0 }}>
            Recent Consultations
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: colors.textFaint }}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by patient…"
                style={{
                  padding: "8px 12px 8px 32px",
                  fontSize: 13.5,
                  border: `1.5px solid ${colors.border}`,
                  borderRadius: radius.pill,
                  outline: "none",
                  background: colors.surface,
                  width: isMobile ? "100%" : 200,
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                fontSize: 13.5,
                border: `1.5px solid ${colors.border}`,
                borderRadius: radius.pill,
                outline: "none",
                background: colors.surface,
                color: colors.text,
              }}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              title="From date"
              style={{
                padding: "7px 10px",
                fontSize: 13,
                border: `1.5px solid ${colors.border}`,
                borderRadius: radius.pill,
                outline: "none",
                background: colors.surface,
                color: dateFrom ? colors.text : colors.textFaint,
              }}
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              title="To date"
              style={{
                padding: "7px 10px",
                fontSize: 13,
                border: `1.5px solid ${colors.border}`,
                borderRadius: radius.pill,
                outline: "none",
                background: colors.surface,
                color: dateTo ? colors.text : colors.textFaint,
              }}
            />
            {hasDateFilter && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                title="Clear date filter"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: colors.textSoft,
                  padding: "4px 6px",
                  fontSize: 12.5,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {deleteError && (
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
            {deleteError}
          </div>
        )}

        {loading ? (
          <Card style={{ textAlign: "center", color: colors.textFaint, padding: 40 }}>Loading…</Card>
        ) : consultations.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "48px 32px" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: colors.primarySoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Stethoscope size={26} color={colors.primary} />
            </div>
            <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: colors.primaryDark, marginBottom: 6 }}>
              Welcome to SehatRx, Dr. {user?.name?.split(" ").slice(-1)[0] || ""}
            </div>
            <div style={{ color: colors.textSoft, fontSize: 14, maxWidth: 380, margin: "0 auto 20px" }}>
              Record a consultation and SehatRx will transcribe it and draft a prescription for you to review and send.
            </div>
            <Button icon={Plus} onClick={() => setShowPicker(true)}>
              Record Your First Consultation
            </Button>
          </Card>
        ) : filteredConsultations.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <div style={{ color: colors.textSoft, fontSize: 14.5 }}>
              No consultations match your search.
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredConsultations.map((c) => {
              const meta = STATUS_META[c.status] || STATUS_META.recording;
              const canDelete = c.status !== "sent";
              return (
                <Card
                  key={c.id}
                  padding={16}
                  onClick={() => navigate(`/consultation/${c.id}`)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    borderLeft: c.status === "drafted" ? `4px solid ${colors.accent}` : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: colors.primarySoft,
                      color: colors.primaryDark,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: fonts.display,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {c.patient_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{c.patient_name}</div>
                    <div style={{ fontSize: 12.5, color: colors.textSoft }}>
                      {new Date(c.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {confirmingId === c.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 12.5, color: colors.danger, fontWeight: 600, whiteSpace: "nowrap" }}>
                        Delete?
                      </span>
                      <button
                        onClick={(e) => handleConfirmDelete(e, c)}
                        disabled={deletingId === c.id}
                        title="Confirm delete"
                        style={{
                          background: colors.danger,
                          border: "none",
                          borderRadius: "50%",
                          width: 26,
                          height: 26,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: deletingId === c.id ? "not-allowed" : "pointer",
                          color: "#fff",
                        }}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        title="Cancel"
                        style={{
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                          borderRadius: "50%",
                          width: 26,
                          height: 26,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: colors.textSoft,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {canDelete && (
                        <button
                          onClick={(e) => handleDeleteClick(e, c.id)}
                          title="Delete this consultation"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: colors.textFaint,
                            padding: 4,
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {showPicker && (
        <PatientPickerModal onClose={() => setShowPicker(false)} onStart={handleStartConsultation} />
      )}

      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: radius.md,
          background: `${tint}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={tint} />
      </div>
      <div>
        <div style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 700, color: colors.text, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12.5, color: colors.textSoft, marginTop: 4 }}>{label}</div>
      </div>
    </Card>
  );
}
