import axios from "axios";
import api from "./client";

export interface MeResponse {
  id: number;
  username: string;
  email: string;
  is_employer: boolean;
  employer_role: "admin" | "member" | null;
}

export async function login(username: string, password: string) {
  const { data } = await axios.post("/dj-rest-auth/login/", { username, password });
  localStorage.setItem("access_token", data.access);
  localStorage.setItem("refresh_token", data.refresh);
  return data;
}

export async function register(username: string, password1: string, password2: string) {
  const { data } = await axios.post("/dj-rest-auth/registration/", { username, password1, password2 });
  localStorage.setItem("access_token", data.access);
  localStorage.setItem("refresh_token", data.refresh);
  return data;
}

export async function logout() {
  const refresh = localStorage.getItem("refresh_token");
  try { await axios.post("/dj-rest-auth/logout/", { refresh }); } catch { /* ignore */ }
  localStorage.clear();
}

export function fetchMe(): Promise<MeResponse> {
  return api.get<MeResponse>("/me/").then((r) => r.data);
}
