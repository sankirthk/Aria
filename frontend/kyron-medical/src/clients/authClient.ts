import { createAuthClient } from "better-auth/react";

// const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_BASE_URL ?? "http://localhost:8000/api/auth",
  fetchOptions: {
    credentials: "include"
  }
});
