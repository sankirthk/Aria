import React from "react";
import type { ResetPasswordFormProps } from "../../types/authTypes";
import { useNavigate } from "react-router";
import GlassSurface from "../ui/GlassSurface";

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = (
  props: ResetPasswordFormProps
) => {
  const {
    loading,
    password,
    rePassword,
    passwordError,
    rePasswordError,
    handlePasswordChange,
    handlePasswordResetSubmit,
    handleRePasswordChange,
  } = props;

  const navigate = useNavigate();
  return (
    <GlassSurface
      width="100%"
      height="1000%"
      borderRadius={20}
      backgroundOpacity={0.25}
      blur={1.5}
      className="forgot-password-form glass"
    >
      <form onSubmit={handlePasswordResetSubmit}>
        <div className="form-header">
          <p className="header-auth">Reset your password</p>
        </div>

        <div className="form-body">
          <div className="password-group">
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              className={passwordError ? "error" : ""}
              onChange={handlePasswordChange}
              placeholder="Enter your password"
            />
            <div className="error-container">
              <p className={`error-message ${passwordError ? "show" : ""}`}>
                {passwordError}
              </p>
            </div>

            <div className="repassword-wrapper">
              <input
                type="password"
                name="repassword"
                autoComplete="new-password"
                value={rePassword}
                className={rePasswordError ? "error" : ""}
                onChange={handleRePasswordChange}
                placeholder="Re-enter your password"
              />
              <div className="error-container">
                <p className={`error-message ${rePasswordError ? "show" : ""}`}>
                  {rePasswordError}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="form-footer">
          <button type="submit" className="submit">
            {loading ? "loading..." : "Reset"}
          </button>
          <div className="register-container">
            <p className="footer-text">
              Remembered your password?{" "}
              <span
                className="link"
                onClick={() => {
                  navigate("/login");
                }}
              >
                Log In
              </span>
            </p>
          </div>
        </div>
      </form>
    </GlassSurface>
  );
};

export default ResetPasswordForm;
