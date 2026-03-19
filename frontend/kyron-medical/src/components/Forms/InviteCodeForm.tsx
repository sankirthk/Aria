import React from "react";
import { useNavigate } from "react-router";
import type { InviteCodeProps } from "../../types/authTypes";
import GlassSurface from "../ui/GlassSurface";

const InviteCodeForm: React.FC<InviteCodeProps> = ({
  handleInviteCodeValidation,
  setInviteCode,
  inviteCode,
  codeError,
  loading,
}) => {
  const navigate = useNavigate();
  return (
    <GlassSurface
      width="100%"
      height="100%"
      borderRadius={20}
      backgroundOpacity={0.25}
      blur={1.5}
      className="registration-form glass"
    >
      <form onSubmit={handleInviteCodeValidation}>
        <div className="form-header">
          <p className="header-auth">Create your account</p>
          <p className="subheader-auth">Enter your invite code to continue.</p>
        </div>

        <div className="form-body">
          <input
            type="text"
            name="invite-code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className={codeError ? "error" : ""}
            placeholder="Enter your invite code"
            disabled={loading}
          />

          <div className="error-container">
            {codeError && <p className="error-message show">{codeError}</p>}
          </div>
        </div>

        <div className="form-footer">
          <button type="submit" className="submit" disabled={loading}>
            {loading ? "Validating..." : "Validate"}
          </button>

          <div className="register-container">
            <p className="footer-text">
              Have an existing account?{" "}
              <span className="link" onClick={() => navigate("/login")}>
                Log In
              </span>
            </p>
          </div>
        </div>
      </form>
    </GlassSurface>
  );
};

export default InviteCodeForm;
