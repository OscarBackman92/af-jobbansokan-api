import api from "./client";
import axios from "axios";

export interface Organization {
  id: number;
  name: string;
  org_number: string;
}

export interface JobPosting {
  id: number;
  organization: Organization;
  title: string;
  company_name: string;
  location: string;
  source: string;
  external_id: string;
  published_at: string | null;
  created_at: string;
}

export interface PostingsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: JobPosting[];
}

export function fetchPostings(search = "", page = 1): Promise<PostingsResponse> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  return axios.get<PostingsResponse>(`/api/v1/postings/?${params}`).then((r) => r.data);
}

export function createPosting(data: Partial<JobPosting>) {
  return api.post<JobPosting>("/postings/", data).then((r) => r.data);
}
