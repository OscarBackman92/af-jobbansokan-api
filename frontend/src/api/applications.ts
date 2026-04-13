import api from "./client";

export type AppStatus = "applied" | "interview" | "offer" | "rejected";

export interface Application {
  id: number;
  posting_detail: {
    id: number;
    title: string;
    company_name: string;
    location: string;
    organization: { id: number; name: string; org_number: string };
    published_at: string | null;
  };
  applied_at: string;
  status: AppStatus;
  created_at: string;
}

export interface ApplicationsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Application[];
}

export interface EmployerApplication {
  id: number;
  owner: { id: number; username: string; email: string };
  posting: { id: number; title: string; company_name: string; location: string; organization: { id: number; name: string; org_number: string } };
  applied_at: string;
  status: AppStatus;
  created_at: string;
}

export function fetchApplications(search = "", page = 1): Promise<ApplicationsResponse> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  return api.get<ApplicationsResponse>(`/applications/?${params}`).then((r) => r.data);
}

export function createApplication(posting: number, applied_at: string) {
  return api.post<Application>("/applications/", { posting, applied_at }).then((r) => r.data);
}

export function updateApplicationStatus(id: number, status: AppStatus) {
  return api.patch<Application>(`/applications/${id}/`, { status }).then((r) => r.data);
}

export function deleteApplication(id: number) {
  return api.delete(`/applications/${id}/`);
}

export function fetchEmployerApplications(status?: AppStatus): Promise<EmployerApplication[]> {
  const params = status ? `?status=${status}` : "";
  return api.get<EmployerApplication[]>(`/employer/applications/${params}`).then((r) => r.data);
}

export function updateEmployerApplicationStatus(id: number, status: AppStatus) {
  return api.patch<EmployerApplication>(`/employer/applications/${id}/`, { status }).then((r) => r.data);
}
