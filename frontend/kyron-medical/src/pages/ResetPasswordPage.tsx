import React, { useState, type FC } from "react";
import { validatePassword, validateRePassword } from "../utils/authValidation";
import ResetPasswordForm from "../components/Forms/ResetPasswordForm";
import { resetPassword } from "../api";
import Header from "../components/layout/Header";
import { showToast } from "../utils/toastService";

import "../styles/Login.css";

const ResetPasswordPage: FC = () => {
  // form states
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");

  // errors
  const [passwordError, setPasswordError] = useState("");
  const [rePasswordError, setRePasswordError] = useState("");

  // modes
  const [loading, setLoading] = useState(false);
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordError(validatePassword(value));
  };

  const handleRePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRePassword(value);
    setRePasswordError(validateRePassword(password, value));
  };

  const handlePasswordResetSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const passErr = validatePassword(password);
    const rePassErr = validateRePassword(password, rePassword);
    const redirectUrl = `${window.location.origin}/login`;

    setPasswordError(passErr);
    setRePasswordError(rePassErr);

    if (passErr || rePassErr) return;

    try {
      setLoading(true);
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        showToast(
          "Invalid token. Request for a new password change email",
          "error"
        );
        return;
      }

      const response = await resetPassword(password, token);
      if (response.success) {
        showToast("Password reset successfully. Proceed to login", "success");
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 2000);
      } else {
        showToast(response.message || "Error during password reset", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const ResetPasswordProps = {
    loading,
    password,
    rePassword,
    passwordError,
    rePasswordError,
    handlePasswordChange,
    handleRePasswordChange,
    handlePasswordResetSubmit,
  };

  return (
    <>
      <Header />
      <main className="page">
        <div className="auth-container">
          <ResetPasswordForm {...ResetPasswordProps} />
        </div>
      </main>
    </>
  );
};

export default ResetPasswordPage;
