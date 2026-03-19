import { useState, type FC, type FormEvent } from "react";
import { PhoneCall, X } from "lucide-react";
import { validatePhone } from "../../utils/authValidation";
import { normalizePhone } from "../../utils/normalizePhone";
import "../../styles/Modal.css";

interface QuickCallModalProps {
  onCall: (phone: string, name: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const QuickCallModal: FC<QuickCallModalProps> = ({ onCall, onCancel, loading }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

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

  const validate = () => {
    const errs: { name?: string; phone?: string } = {};
    if (!name.trim()) errs.name = "Required";
    const phoneErr = validatePhone(phone);
    if (phoneErr) errs.phone = phoneErr;
    return errs;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    await onCall(phone.trim(), name.trim());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <button className="modal-close" type="button" onClick={onCancel} aria-label="Close">
          <X size={16} />
        </button>

        <div className="modal-icon">
          <PhoneCall size={22} strokeWidth={1.5} />
        </div>

        <h2 className="modal-title">Let's call you</h2>
        <p className="modal-subtitle">
          Just your name and number — Aria will call you right away.
        </p>

        <form className="modal-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-field">
            <label className="modal-label">Your name</label>
            <input
              className={`modal-input${errors.name ? " modal-input--error" : ""}`}
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((err) => ({ ...err, name: e.target.value.trim() ? "" : "Required" })); }}
              autoFocus
            />
            {errors.name && <span className="modal-error">{errors.name}</span>}
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
            <button type="submit" className="modal-btn-primary" disabled={loading}>
              <PhoneCall size={14} />
              {loading ? "Calling…" : "Call Me Now"}
            </button>
            <button type="button" className="modal-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickCallModal;
