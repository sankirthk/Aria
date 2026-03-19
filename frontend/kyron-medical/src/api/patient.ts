import { axiosClient } from "../clients/axiosClient";

export interface PatientProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  success: boolean;
  data?: PatientProfile;
  error?: string;
}

export interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
}

export const getProfile = async (): Promise<ProfileResponse> => {
  try {
    const { data } = await axiosClient.get<ProfileResponse>("/patient/profile");
    return data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    return {
      success: false,
      error: error.response?.data?.error ?? "Failed to load profile.",
    };
  }
};

export const updateProfile = async (
  payload: UpdateProfilePayload
): Promise<ProfileResponse> => {
  try {
    const { data } = await axiosClient.put<ProfileResponse>(
      "/patient/profile",
      payload
    );
    return data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    return {
      success: false,
      error: error.response?.data?.error ?? "Failed to update profile.",
    };
  }
};
