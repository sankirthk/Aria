import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { User, Phone, Calendar, Mail, Pencil, Check, X } from "lucide-react";
import NavBar from "../components/layout/Navbar";
import { getProfile, updateProfile, type PatientProfile } from "../api/patient";
import { useAuth } from "../context/useAuth";
import { showToast } from "../utils/toastService";
import { validatePhone, validateDob } from "../utils/authValidation";
import { normalizePhone } from "../utils/normalizePhone";
import { emitProfileUpdated } from "../utils/profileEvents";
import "../styles/Profile.css";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    phone: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await getProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        setForm({
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          dateOfBirth: res.data.dateOfBirth,
          phone: res.data.phone,
        });
      } else {
        setError(res.error ?? "Failed to load profile.");
      }
      setLoading(false);
    };
    void load();
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    const dobErr = validateDob(form.dateOfBirth);
    if (dobErr) errs.dateOfBirth = dobErr;
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) errs.phone = phoneErr;
    return errs;
  };

  const handleFieldChange = (field: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    // Live validation
    if (field === "phone") {
      setFormErrors((e) => ({ ...e, phone: validatePhone(value) }));
    } else if (field === "dateOfBirth") {
      setFormErrors((e) => ({ ...e, dateOfBirth: validateDob(value) }));
    } else {
      setFormErrors((e) => ({ ...e, [field]: value.trim() ? "" : "Required" }));
    }
  };

  const handlePhoneBlur = () => {
    if (form.phone.trim()) {
      const normalized = normalizePhone(form.phone);
      setForm((f) => ({ ...f, phone: normalized }));
      setFormErrors((e) => ({ ...e, phone: validatePhone(normalized) }));
    }
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setSaving(true);
    const res = await updateProfile(form);
    setSaving(false);

    if (res.success && res.data) {
      setProfile(res.data);
      setEditing(false);
      setFormErrors({});
      emitProfileUpdated();
      showToast("Profile updated.", "success");
    } else {
      showToast(res.error ?? "Failed to update profile.", "error");
    }
  };

  const handleCancel = () => {
    if (profile) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        dateOfBirth: profile.dateOfBirth,
        phone: profile.phone,
      });
    }
    setFormErrors({});
    setEditing(false);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${m}/${d}/${y}`;
  };

  return (
    <>
      <NavBar />
      <main className="profile-page">
        <div className="profile-card glass">
          {/* Header */}
          <div className="profile-card__header">
            <div className="profile-card__avatar">
              <User size={28} />
            </div>
            <div className="profile-card__header-copy">
              <h1 className="profile-card__name">
                {profile ? `${profile.firstName} ${profile.lastName}` : user?.name ?? "Your Profile"}
              </h1>
              <p className="profile-card__email">{user?.email ?? ""}</p>
            </div>
            {!loading && !error && (
              editing ? (
                <div className="profile-card__header-actions">
                  <button
                    type="button"
                    className="profile-action-btn profile-action-btn--save"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    <Check size={15} />
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="profile-action-btn profile-action-btn--cancel"
                    onClick={handleCancel}
                  >
                    <X size={15} />
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="profile-action-btn profile-action-btn--edit"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={15} />
                  Edit
                </button>
              )
            )}
          </div>

          <div className="profile-card__divider" />

          {/* Body */}
          {loading && <div className="profile-card__state">Loading profile…</div>}

          {!loading && error && (
            <div className="profile-card__state profile-card__state--error">{error}</div>
          )}

          {!loading && !error && (
            <div className="profile-card__fields">
              {/* First Name */}
              <div className="profile-field">
                <label className="profile-field__label">First Name</label>
                {editing ? (
                  <>
                    <input
                      className={`profile-field__input${formErrors.firstName ? " profile-field__input--error" : ""}`}
                      value={form.firstName}
                      onChange={(e) => handleFieldChange("firstName", e.target.value)}
                      placeholder="Jane"
                    />
                    {formErrors.firstName && <span className="profile-field__error">{formErrors.firstName}</span>}
                  </>
                ) : (
                  <span className="profile-field__value">{profile?.firstName || "—"}</span>
                )}
              </div>

              {/* Last Name */}
              <div className="profile-field">
                <label className="profile-field__label">Last Name</label>
                {editing ? (
                  <>
                    <input
                      className={`profile-field__input${formErrors.lastName ? " profile-field__input--error" : ""}`}
                      value={form.lastName}
                      onChange={(e) => handleFieldChange("lastName", e.target.value)}
                      placeholder="Smith"
                    />
                    {formErrors.lastName && <span className="profile-field__error">{formErrors.lastName}</span>}
                  </>
                ) : (
                  <span className="profile-field__value">{profile?.lastName || "—"}</span>
                )}
              </div>

              {/* Date of Birth */}
              <div className="profile-field">
                <label className="profile-field__label">
                  <Calendar size={13} style={{ display: "inline", marginRight: "0.3rem" }} />
                  Date of Birth
                </label>
                {editing ? (
                  <>
                    <input
                      type="date"
                      className={`profile-field__input${formErrors.dateOfBirth ? " profile-field__input--error" : ""}`}
                      value={form.dateOfBirth}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => handleFieldChange("dateOfBirth", e.target.value)}
                    />
                    {formErrors.dateOfBirth && <span className="profile-field__error">{formErrors.dateOfBirth}</span>}
                  </>
                ) : (
                  <span className="profile-field__value">{formatDate(profile?.dateOfBirth ?? "")}</span>
                )}
              </div>

              {/* Phone */}
              <div className="profile-field">
                <label className="profile-field__label">
                  <Phone size={13} style={{ display: "inline", marginRight: "0.3rem" }} />
                  Phone
                </label>
                {editing ? (
                  <>
                    <input
                      type="tel"
                      className={`profile-field__input${formErrors.phone ? " profile-field__input--error" : ""}`}
                      value={form.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      onBlur={handlePhoneBlur}
                      placeholder="(555) 000-0000"
                    />
                    {formErrors.phone && <span className="profile-field__error">{formErrors.phone}</span>}
                  </>
                ) : (
                  <span className="profile-field__value">{profile?.phone || "—"}</span>
                )}
              </div>

              {/* Email — read-only from auth */}
              <div className="profile-field">
                <label className="profile-field__label">
                  <Mail size={13} style={{ display: "inline", marginRight: "0.3rem" }} />
                  Email
                </label>
                <span className="profile-field__value profile-field__value--muted">{user?.email ?? "—"}</span>
              </div>

              {/* Status */}
              <div className="profile-field">
                <label className="profile-field__label">Profile Status</label>
                <span className={`profile-status-badge${profile?.profileComplete ? " profile-status-badge--complete" : " profile-status-badge--incomplete"}`}>
                  {profile?.profileComplete ? "Complete" : "Incomplete"}
                </span>
              </div>
            </div>
          )}

          <div className="profile-card__divider" />

          <button
            type="button"
            className="profile-back-btn"
            onClick={() => navigate("/dashboard")}
          >
            ← Back to Dashboard
          </button>
        </div>
      </main>
    </>
  );
};

export default ProfilePage;
