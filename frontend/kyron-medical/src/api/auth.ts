/* eslint-disable @typescript-eslint/no-explicit-any */
import { axiosClient } from "../clients/axiosClient";
import { authClient } from "../clients/authClient";
import { AxiosError } from "axios";
import { notifyAuthRateLimit } from "../utils/authRateLimit";
import type {
  ValidateInviteResponse,
  AuthPayload,
  RegisterResponse,
} from "../types/authTypes";

const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a moment and try again.";

// Validate invite
export const validateInvite = async (
  code: string
): Promise<ValidateInviteResponse> => {
  try {
    const { data } = await axiosClient.post<ValidateInviteResponse>(
      "/auth/validate-invite",
      { code }
    );
    return data;
  } catch (error: any) {
    if (notifyAuthRateLimit(error)) {
      return {
        success: false,
        valid: false,
        message: RATE_LIMIT_MESSAGE,
      };
    }
    // Handle known API responses or network issues gracefully
    if (error.response?.data) {
      const data = error.response.data as Partial<ValidateInviteResponse>;
      return {
        success: false,
        valid: false,
        message:
          data.message ||
          "We couldn't validate your invite code. Please check and try again.",
      };
    }

    if (error.request) {
      // Request made but no response (network/server down)
      return {
        success: false,
        valid: false,
        message: "Unable to reach the server. Please check your connection.",
      };
    }

    // Unknown error (code bug, unexpected throw)
    return {
      success: false,
      valid: false,
      message:
        "An unexpected error occurred while validating your invite code.",
    };
  }
};

// Register new user

export const registerUser = async (
  payload: AuthPayload
): Promise<RegisterResponse> => {
  try {
    const response = await axiosClient.post<RegisterResponse>(
      "/auth/signup",
      payload
    );
    const { data } = response;
    return {
      success: data?.success ?? false,
      message: data?.message || "Registration completed successfully!",
      data: data?.data,
    };
  } catch (err: any) {
    if (notifyAuthRateLimit(err)) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
      };
    }
    if (err.response?.data) {
      const { error } = err.response.data;
      return {
        success: false,
        message: error || "Signup failed. Please check your details.",
      };
    }

    if (!err.request) {
      return {
        success: false,
        message: "Unable to reach the server. Please check your connection.",
      };
    }

    return {
      success: false,
      message: "An unexpected error occurred during signup.",
    };
  }
};

// Login
/**
 * Calls BetterAuth's email sign-in and returns structured response.
 */
export const loginUser = async (payload: AuthPayload) => {
  try {
    const { data, error } = await authClient.signIn.email(payload);
    //  Case 1: explicit Better Auth error
    console.log(data?.redirect, data?.user);
    if (error) {
      if (notifyAuthRateLimit(error)) {
        return {
          success: false,
          message: RATE_LIMIT_MESSAGE,
          code: error.code,
          status: error.status,
        };
      }

      return {
        success: false,
        message:
          error.message ??
          (error.code === "EMAIL_NOT_VERIFIED"
            ? "Please verify your email before logging in."
            : "Login failed. Please check your credentials."),
        code: error.code,
        status: error.status,
      };
    }

    //  Case 3: success
    return {
      success: true,
      message: "Login successful!",
      data,
    };
  } catch (e) {
    //  Case 4: unexpected network / runtime failure
    if (notifyAuthRateLimit(e)) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
      };
    }
    const err = e as Error;
    console.error("loginUser() caught:", err);
    return {
      success: false,
      message: err.message || "Unexpected error during login.",
    };
  }
};

/**
 * Logs out the current user by ending their Better Auth session.
 * This clears the cookie-based session on the backend automatically.
 */
export const logoutUser = async (): Promise<{
  success: boolean;
  message?: string;
}> => {
  try {
    await authClient.signOut();

    // Optional: clear any local user data if stored in context/localStorage
    localStorage.removeItem("user");

    return { success: true, message: "Logged out successfully" };
  } catch (err) {
    if (notifyAuthRateLimit(err)) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
      };
    }
    const error = err as AxiosError<{ message?: string }>;

    console.error("Logout failed:", error.response?.data || error.message);

    return {
      success: false,
      message:
        error.response?.data?.message || "Failed to log out. Please try again.",
    };
  }
};

export const requestPasswordReset = async (
  email: string,
  redirectUrl: string
): Promise<{
  success: boolean;
  message: string;
  status?: number;
  code?: string;
}> => {
  try {
    const { data, error } = await authClient.requestPasswordReset({
      email: email,
      redirectTo: redirectUrl,
    });

    if (error) {
      if (notifyAuthRateLimit(error)) {
        return {
          success: false,
          message: RATE_LIMIT_MESSAGE,
          code: error.code,
          status: error.status,
        };
      }

      return {
        success: false,
        message:
          error.message ??
          (error.code === "EMAIL_NOT_VERIFIED"
            ? "Please verify your email before logging in."
            : "Password reset request failed. Please check your email address."),
        code: error.code,
        status: error.status,
      };
    }

    return {
      success: data.status,
      message:
        "Password reset link sent successfully. Please check your email.",
    };
  } catch (err) {
    if (notifyAuthRateLimit(err)) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
      };
    }

    const error = err as Error;
    return {
      success: false,
      message: error.message || "Password reset request failed unexpectedly.",
    };
  }
};

export const resetPassword = async (
  newPassword: string,
  token: string
): Promise<{
  success: boolean;
  message: string;
  status?: number;
  code?: string;
}> => {
  try {
    const { data, error } = await authClient.resetPassword({
      newPassword,
      token,
    });

    if (error) {
      if (notifyAuthRateLimit(error)) {
        return {
          success: false,
          message: RATE_LIMIT_MESSAGE,
          code: error.code,
          status: error.status,
        };
      }

      return {
        success: false,
        message:
          error.message ??
          (error.code === "EMAIL_NOT_VERIFIED"
            ? "Please verify your email before logging in."
            : "Password reset request failed. Please check your email address."),
        code: error.code,
        status: error.status,
      };
    }

    return {
      success: data.status,
      message:
        "Password reset link sent successfully. Please check your email.",
    };
  } catch (err) {
    if (notifyAuthRateLimit(err)) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
      };
    }

    const error = err as Error;
    return {
      success: false,
      message: error.message || "Password reset failed unexpectedly.",
    };
  }
};
