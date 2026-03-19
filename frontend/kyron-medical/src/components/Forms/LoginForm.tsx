import type { LoginProps } from "../../types/authTypes";
import { useNavigate } from "react-router";
import GlassSurface from "../ui/GlassSurface";

const LoginForm: React.FC<LoginProps> = (props: LoginProps) => {
  const {
    email,
    emailError,
    password,
    passwordError,
    keepMeSignedIn,
    handleKeepMeSignedIn,
    handleLoginSubmit,
    handlePasswordChange,
    handleEmailChange,
    showResendVerification,
    resendLoading,
    handleResendVerification,
  } = props;

  const navigate = useNavigate();

  return (
    <>
      <GlassSurface
        width="100%"
        height="100%"
        borderRadius={20}
        backgroundOpacity={0.25}
        blur={1.5}
        className="login-form glass"
      >
        <form onSubmit={handleLoginSubmit}>
          <div className="form-header">
            <p className="header-auth">Welcome</p>
            <p className="subheader-auth">
              Log in to Westside Medical Group to continue to the dashboard
            </p>
          </div>

          <div className="form-body">
            <input
              type="email"
              name="email"
              value={email}
              className={emailError ? "error" : ""}
              onChange={handleEmailChange}
              placeholder="Enter your email"
            />
            <div className="error-container">
              <p className={`error-message ${emailError ? "show" : ""}`}>
                {emailError}
              </p>
            </div>
            <div className="password-group">
              <input
                type="password"
                name="password"
                value={password}
                onChange={handlePasswordChange}
                className={passwordError ? "error" : ""}
                placeholder="Enter your password"
              />

              <div className="error-container">
                <p className={`error-message ${passwordError ? "show" : ""}`}>
                  {passwordError}
                </p>
              </div>
            </div>
          </div>

          <div className="form-footer">
            <button type="submit" className="submit">
              Login
            </button>
            {showResendVerification && (
              <div className="resend-verification-wrapper">
                <button
                  type="button"
                  className="resend-verification-btn"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                >
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </button>
              </div>
            )}
            <div className="options-container">
              <label className="signedin-label">
                <input
                  type="checkbox"
                  name="signedin"
                  checked={keepMeSignedIn}
                  onChange={handleKeepMeSignedIn}
                  className="signedin-checkbox"
                />
                Keep me signed in
              </label>
              <span
                className="forgot-password-text"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot your password?
              </span>
            </div>
            <div className="register-container">
              <p className="footer-text">
                Don’t have an account?{" "}
                <span className="link" onClick={() => navigate("/signup")}>
                  Sign Up
                </span>
              </p>
            </div>
          </div>
        </form>
      </GlassSurface>
    </>
  );
};

export default LoginForm;
