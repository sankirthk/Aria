import type React from "react";

export interface LoginProps {
  handleLoginSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeepMeSignedIn: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleResendVerification: () => void;
  keepMeSignedIn: boolean;
  email: string;
  emailError: string;
  password: string;
  passwordError: string;
  showResendVerification: boolean;
  resendLoading: boolean;
}

export interface RegistrationProps {
  handleSignUpSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRePasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
  nameError: string;
  email: string;
  emailError: string;
  password: string;
  passwordError: string;
  rePassword: string;
  rePasswordError: string;
}

export interface ForgotPasswordFormProps {
  handleForgotPasswordSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  email: string;
  emailError: string;
}

export interface InviteCodeProps {
  handleInviteCodeValidation: (e: React.FormEvent<HTMLFormElement>) => void;
  setInviteCode: React.Dispatch<React.SetStateAction<string>>;
  inviteCode: string;
  codeError: string;
  loading: boolean;
}

export interface ResetPasswordFormProps {
  handlePasswordResetSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handlePasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRePasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  password: string;
  passwordError: string;
  rePassword: string;
  rePasswordError: string;
  loading: boolean;
}

export interface ValidateInviteResponse {
  success: boolean;
  valid: boolean;
  message: string;
}

export interface AuthPayload {
  name?: string;
  email: string;
  password: string;
  rememberMe?: boolean;
  inviteCode?: string;
  callbackURL?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  code?: string;
  status?: number;
  data?: {
    redirect: boolean;
    token: string;
    url?: string;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      emailVerified: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  };
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  data?: {
    token: null;
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null | undefined;
      emailVerified: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  };
}
