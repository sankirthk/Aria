import React, { useState, type FC } from "react";
import { validateEmail } from "../utils/authValidation";
import ForgotPasswordForm from "../components/Forms/ForgotPasswordForm";
import { requestPasswordReset } from "../api";
import Header from "../components/layout/Header";
import { showToast } from "../utils/toastService";

import "../styles/Login.css";

const ForgotPasswordPage: FC = () => {
  // form states
  const [email, setEmail] = useState("");

  // errors
  const [emailError, setEmailError] = useState("");

  // modes
  const [loading, setLoading] = useState(false);
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(validateEmail(value));
  };

  const handleForgotPasswordSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const emailErr = validateEmail(email);
    setEmailError(emailErr);
    if (emailErr) return;

    const redirectUrl = `${window.location.origin}/reset-password`;
    try {
      setLoading(true);
      const response = await requestPasswordReset(email, redirectUrl);
      if (response.success) {
        showToast("Password reset link sent to your email.", "success");
      } else {
        showToast(
          response.message || "Error during password reset",
          "error"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const ForgotPasswordProps = {
    email,
    emailError,
    handleEmailChange,
    handleForgotPasswordSubmit,
    loading,
  };

  return (
    <>
      <Header />
      <main className="page">
        <div className="auth-container">
          <ForgotPasswordForm {...ForgotPasswordProps} />
        </div>
      </main>
    </>
  );
};

export default ForgotPasswordPage;
