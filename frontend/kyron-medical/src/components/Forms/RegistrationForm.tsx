import type { RegistrationProps } from "../../types/authTypes";
import { useNavigate } from "react-router";
import GlassSurface from "../ui/GlassSurface";

const RegistrationForm: React.FC<RegistrationProps> = (
  props: RegistrationProps
) => {
  const {
    email,
    emailError,
    password,
    passwordError,
    rePassword,
    rePasswordError,
    name,
    nameError,
    handleSignUpSubmit,
    handleEmailChange,
    handlePasswordChange,
    handleRePasswordChange,
    handleNameChange,
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
        className="registration-form glass"
      >
        <form onSubmit={handleSignUpSubmit}>
          <div className="form-header">
            <p className="header-auth">Create your account</p>
            <p className="subheader-auth">Only takes a minute.</p>
          </div>
          <div className="form-body">
            <input
              type="text"
              autoComplete="additional-name"
              name="name"
              value={name}
              className={nameError ? "error" : ""}
              onChange={handleNameChange}
              placeholder="Enter your Name"
            />
            <div className="error-container">
              <p className={`error-message ${nameError ? "show" : ""}`}>
                {nameError}
              </p>
            </div>
            <input
              type="email"
              name="email"
              autoComplete="email"
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
                  <p
                    className={`error-message ${rePasswordError ? "show" : ""}`}
                  >
                    {rePasswordError}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="form-footer">
            <button type="submit" className="submit">
              Sign Up
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
    </>
  );
};

export default RegistrationForm;
