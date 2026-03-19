// src/api/axiosClient.ts
import axios from "axios";

export const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // if you’re using cookies/sessions
  headers: { "Content-Type": "application/json" },
});

// optional: token attach / response logging
axiosClient.interceptors.request.use((config) => {
  return config;
});
