import { useState } from "react";
import { X } from "lucide-react";
import { colors, fonts, radius, shadow } from "../theme";
import { api, ApiError } from "../api/client";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import Button from "./Button";
import Field from "./Field";

export default function EditProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const showToast = useToast();
  const isDoctor = user?.role === "doctor";
  const isCaregiver = user?.role === "caregiver";

  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    specialization: user?.specialization || "",
    clinic: user?.clinic || "",
    age: user?.age ?? "",
    gender: user?.gender || "",
    known_allergies: user?.known_allergies || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = isDoctor
        ? { name: form.name, phone: form.phone, specialization: form.specialization, clinic: form.clinic }
        : isCaregiver
        ? { name: form.name, phone: form.phone }
        : {
            name: form.name,
            phone: form.phone,
            age: form.age ? Number(form.age) : null,
            gender: form.gender || null,
            known_allergies: form.known_allergies || null,
          };
      const updated = await api.patch("/auth/me", payload);
      updateUser(updated);
      showToast("Profile updated.");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
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
          width: 420,
          maxWidth: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 0" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: 20, margin: 0, color: colors.primaryDark }}>
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSoft, padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div
              style={{
                background: colors.dangerSoft,
                color: colors.danger,
                borderRadius: radius.sm,
                padding: "10px 14px",
                fontSize: 13.5,
              }}
            >
              {error}
            </div>
          )}

          <Field
            label="Full Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Field
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          {isDoctor ? (
            <>
              <Field
                label="Specialization"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              />
              <Field
                label="Clinic Name"
                value={form.clinic}
                onChange={(e) => setForm({ ...form, clinic: e.target.value })}
              />
              <p style={{ fontSize: 12, color: colors.textFaint, margin: 0 }}>
                Email and registration number can't be changed here.
              </p>
            </>
          ) : isCaregiver ? (
            <p style={{ fontSize: 12, color: colors.textFaint, margin: 0 }}>Email can't be changed here.</p>
          ) : (
            <>
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
              <Field
                label="Known Allergies"
                placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                value={form.known_allergies}
                onChange={(e) => setForm({ ...form, known_allergies: e.target.value })}
              />
              <p style={{ fontSize: 12, color: colors.textFaint, margin: 0 }}>
                Email can't be changed here. Your doctor will see your known allergies before prescribing.
              </p>
            </>
          )}

          <Button type="submit" disabled={saving || !form.name.trim()} fullWidth style={{ marginTop: 8 }}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </div>
    </div>
  );
}
