import React, { useState, type FC } from "react";
import { validateEmail, validatePassword } from "../utils/authValidation";
import LoginForm from "../components/Forms/LoginForm";
import { loginUser } from "../api/";
import { useAuth } from "../context/useAuth";
import Header from "../components/layout/Header";
import { showToast } from "../utils/toastService";
import { authClient } from "../clients/authClient";

import "../styles/Login.css";

const LoginPage: FC = () => {
  const { setUser } = useAuth();
  // form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // errors
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // modes
  const [loading, setLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // keep me signed in state
  const [keepMeSignedIn, setKeepMeSignedIn] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(validateEmail(value));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordError(validatePassword(value));
  };

  // Handler for keep me signed in checkbox
  const handleKeepMeSignedIn = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeepMeSignedIn(e.target.checked);
  };

  // --- LOGIN SUBMIT ---
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    const callbackURL = `${window.location.origin}/dashboard`;

    setEmailError(emailErr);
    setPasswordError(passErr);

    if (emailErr || passErr) return;

    try {
      setLoading(true);
      const result = await loginUser({
        email,
        password,
        rememberMe: keepMeSignedIn,
        callbackURL,
      });

      if (!result.success) {
        if (result.code === "EMAIL_NOT_VERIFIED") {
          setShowResendVerification(true);
          showToast("Please verify your email before logging in.", "error");
        } else {
          setShowResendVerification(false);
          showToast(result.message || "Login failed. Please check your credentials.", "error");
        }
        return;
      }
      setShowResendVerification(false);

      if (result.data?.user) setUser(result.data.user);

      showToast("Login successful! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = result.data?.url ?? "/dashboard";
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      showToast("Enter your email address first.", "error");
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/dashboard",
      });
      if (error) {
        showToast(error.message ?? "Failed to resend verification email.", "error");
      } else {
        showToast("Verification email sent! Check your inbox.", "success");
      }
    } finally {
      setResendLoading(false);
    }
  };

  const LoginProps = {
    email,
    password,
    emailError,
    passwordError,
    keepMeSignedIn,
    handleKeepMeSignedIn,
    handlePasswordChange,
    handleLoginSubmit,
    handleEmailChange,
    loading,
    showResendVerification,
    resendLoading,
    handleResendVerification,
  };

  return (
    <>
      <Header />
      <main className="page">
        <div className="auth-container">
          <LoginForm {...LoginProps} />
        </div>
      </main>
    </>
  );
};

export default LoginPage;
