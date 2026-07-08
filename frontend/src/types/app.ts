/**
 * Curated API types for the frontend. Regenerate the source schema with
 * `npm run openapi` after backend serializer changes.
 */
import type { components } from "./api.generated.js";

export type ApplicationStatus = components["schemas"]["StatusEnum"];
export type JobApplication = components["schemas"]["JobApplication"];
export type JobApplicationList = components["schemas"]["JobApplicationList"];
export type PatchedJobApplication = components["schemas"]["PatchedJobApplication"];
export type ApplicationEvent = components["schemas"]["ApplicationEvent"];
export type Profile = components["schemas"]["Profile"];
export type Resume = components["schemas"]["Resume"];
export type SavedJobSearch = components["schemas"]["SavedJobSearch"];
export type PaginatedJobApplicationList =
  components["schemas"]["PaginatedJobApplicationListList"];

export type AuthTokens = {
  access: string;
  refresh: string;
};
