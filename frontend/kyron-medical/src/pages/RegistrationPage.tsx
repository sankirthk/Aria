import React, { useState, type FC } from "react";
import {
  validateEmail,
  validatePassword,
  validateRePassword,
  validateName,
} from "../utils/authValidation";
import RegistrationForm from "../components/Forms/RegistrationForm";
import InviteCodeForm from "../components/Forms/InviteCodeForm";
import { validateInvite, registerUser } from "../api/auth";
import Header from "../components/layout/Header";
import { showToast } from "../utils/toastService";

import "../styles/Login.css";

const RegistrationPage: FC = () => {
  // form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");

  // errors
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [rePasswordError, setRePasswordError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [nameError, setNameError] = useState("");

  // modes
  const [inviteValidated, setInviteValidated] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleRePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRePassword(value);
    setRePasswordError(validateRePassword(password, value));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setNameError(validateName(value));
  };

  // --- VALIDATE INVITE CODE ---
  const handleInviteCodeValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError("");
    if (!inviteCode.trim()) {
      setCodeError("Invite code is required");
      return;
    }

    setLoading(true);
    try {
      const data = await validateInvite(inviteCode);
      if (!data.valid) {
        setCodeError(data.message);
        setInviteValidated(false);
        showToast(data.message || "Invite code is invalid.", "error");
      } else {
        setInviteValidated(true);
        showToast(data.message || "Invite code validated!", "success");
      }
    } catch (error) {
      console.error("Error validating invite code:", error);
      showToast("Failed to validate invite code. Please try again.", "error");
      setInviteValidated(false);
    } finally {
      setLoading(false);
    }
  };

  // --- SIGNUP SUBMIT ---
  const handleSignUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // --- Client-side validation ---
    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    const rePassErr = validateRePassword(password, rePassword);
    const callbackURL = `${window.location.origin}/login`;

    setNameError(nameErr);
    setEmailError(emailErr);
    setPasswordError(passErr);
    setRePasswordError(rePassErr);

    if (nameErr || emailErr || passErr || rePassErr) return;
    console.log(name, email, inviteCode, password);
    try {
      setLoading(true);
      const response = await registerUser({
        name,
        email,
        password,
        inviteCode,
        callbackURL,
      });

      if (response.success) {
        showToast(
          "Registration successful! Verify your email to continue...",
          "success"
        );
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        showToast(response.message || "Signup failed.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const RegistrationProps = {
    email,
    emailError,
    password,
    passwordError,
    rePassword,
    rePasswordError,
    name,
    nameError,
    handleNameChange,
    handleSignUpSubmit,
    handleEmailChange,
    handlePasswordChange,
    handleRePasswordChange,
    loading,
  };

  const InviteCodeProps = {
    inviteCode,
    codeError,
    loading,
    setInviteCode,
    handleEmailChange,
    handleInviteCodeValidation,
  };

  return (
    <>
      <Header />
      <main className="page">
        <div className="auth-container">
          {!inviteValidated ? (
            <InviteCodeForm {...InviteCodeProps} />
          ) : (
            <RegistrationForm {...RegistrationProps} />
          )}
        </div>
      </main>
    </>
  );
};

export default RegistrationPage;
