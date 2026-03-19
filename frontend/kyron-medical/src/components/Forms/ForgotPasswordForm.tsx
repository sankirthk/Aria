import React from "react";
import type { ForgotPasswordFormProps } from "../../types/authTypes";
import { useNavigate } from "react-router";
import GlassSurface from "../ui/GlassSurface";

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  email,
  emailError,
  handleEmailChange,
  handleForgotPasswordSubmit,
}) => {
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
      <form onSubmit={handleForgotPasswordSubmit}>
        <div className="form-header">
          <p className="header-auth">Reset your password</p>
          <p className="subheader-auth">
            Enter your email to receive a reset link.
          </p>
        </div>

        <div className="form-body">
          <input
            type="email"
            name="reset-email"
            value={email}
            onChange={handleEmailChange}
            className={emailError ? "error" : ""}
            placeholder="Enter your registered email"
          />

          <div className="error-container">
            <p className={`error-message ${emailError ? "show" : ""}`}>
              {emailError}
            </p>
          </div>
        </div>

        <div className="form-footer">
          <button type="submit" className="submit">
            Send Reset Link
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

export default ForgotPasswordForm;
