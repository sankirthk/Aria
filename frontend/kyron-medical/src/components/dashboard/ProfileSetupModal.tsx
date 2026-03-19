import { useState, type FC, type FormEvent } from "react";
import { User } from "lucide-react";
import { updateProfile } from "../../api/patient";
import { showToast } from "../../utils/toastService";
import { validatePhone, validateDob } from "../../utils/authValidation";
import { normalizePhone } from "../../utils/normalizePhone";
import { emitProfileUpdated } from "../../utils/profileEvents";
import "../../styles/Modal.css";

interface ProfileSetupModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

const ProfileSetupModal: FC<ProfileSetupModalProps> = ({ onComplete, onSkip }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Required";
    if (!lastName.trim()) errs.lastName = "Required";
    const dobErr = validateDob(dateOfBirth);
    if (dobErr) errs.dateOfBirth = dobErr;
    const phoneErr = validatePhone(phone);
    if (phoneErr) errs.phone = phoneErr;
    return errs;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setErrors((e) => ({ ...e, phone: validatePhone(value) }));
  };

  const handlePhoneBlur = () => {
    if (phone.trim()) {
      const normalized = normalizePhone(phone);
      setPhone(normalized);
      setErrors((e) => ({ ...e, phone: validatePhone(normalized) }));
    }
  };

  const handleDobChange = (value: string) => {
    setDateOfBirth(value);
    setErrors((e) => ({ ...e, dateOfBirth: validateDob(value) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    const result = await updateProfile({ firstName, lastName, dateOfBirth, phone });
    setSaving(false);
    if (result.success) {
      emitProfileUpdated();
      showToast("Profile saved!", "success");
      onComplete();
    } else {
      showToast(result.error ?? "Failed to save profile.", "error");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon">
          <User size={24} strokeWidth={1.5} />
        </div>

        <h2 className="modal-title">Complete Your Profile</h2>
        <p className="modal-subtitle">
          Helps Aria personalise your care and reach you by phone. You can skip and do this later.
        </p>

        <form className="modal-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">First name</label>
              <input
                className={`modal-input${errors.firstName ? " modal-input--error" : ""}`}
                type="text"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setErrors((err) => ({ ...err, firstName: e.target.value.trim() ? "" : "Required" })); }}
              />
              {errors.firstName && <span className="modal-error">{errors.firstName}</span>}
            </div>
            <div className="modal-field">
              <label className="modal-label">Last name</label>
              <input
                className={`modal-input${errors.lastName ? " modal-input--error" : ""}`}
                type="text"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setErrors((err) => ({ ...err, lastName: e.target.value.trim() ? "" : "Required" })); }}
              />
              {errors.lastName && <span className="modal-error">{errors.lastName}</span>}
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Date of birth</label>
            <input
              className={`modal-input${errors.dateOfBirth ? " modal-input--error" : ""}`}
              type="date"
              value={dateOfBirth}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => handleDobChange(e.target.value)}
            />
            {errors.dateOfBirth && <span className="modal-error">{errors.dateOfBirth}</span>}
          </div>

          <div className="modal-field">
            <label className="modal-label">Phone number</label>
            <input
              className={`modal-input${errors.phone ? " modal-input--error" : ""}`}
              type="tel"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onBlur={handlePhoneBlur}
            />
            {errors.phone && <span className="modal-error">{errors.phone}</span>}
          </div>

          <div className="modal-actions">
            <button type="submit" className="modal-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save Profile"}
            </button>
            <button type="button" className="modal-btn-ghost" onClick={onSkip}>
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetupModal;
