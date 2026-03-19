import { axiosClient } from "../clients/axiosClient";

export interface Booking {
  id: string;
  patientId: string;
  providerId: string;
  slotId: string;
  status: string;
  createdAt: string;
  provider: {
    id: string;
    name: string;
    specialty: string;
    keywords: string[];
    bio: string | null;
  };
  slot: {
    id: string;
    providerId: string;
    startTime: string;
    endTime: string;
    available: boolean;
  };
}

export interface AppointmentsResponse {
  success: boolean;
  data?: {
    upcoming: Booking[];
    past: Booking[];
  };
  error?: string;
}

/** Shape of the SSE `done` event from POST /chat/session/:id/message */
export interface SseDoneEvent {
  messageId?: string | null;
  bookingCreated: boolean;
  booking?: Booking | null;
}

export const getAppointments = async (): Promise<AppointmentsResponse> => {
  try {
    const { data } = await axiosClient.get<AppointmentsResponse>("/appointments");
    return data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    return {
      success: false,
      error: error.response?.data?.error ?? "Failed to load appointments.",
    };
  }
};
