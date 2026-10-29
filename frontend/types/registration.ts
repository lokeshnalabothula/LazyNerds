export type RegistrationStatus = "pending" | "approved" | "rejected" | "needs_information" | "info_requested" | string;

export interface ClientRegisterInput {
  full_name: string;
  email: string;
  password: string;
  company_name: string;
  phone?: string | null;
  job_title?: string | null;
  website?: string | null;
  industry?: string | null;
  company_size?: string | null;
  country?: string | null;
  requested_services?: string | null;
  scope_description?: string | null;
  primary_domains?: string | null;
}

export interface RegistrationOut {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  company_name: string;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  country: string | null;
  requested_services: string | null;
  scope_description: string | null;
  primary_domains: string | null;
  status: RegistrationStatus;
  review_notes: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  client_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationListResponse {
  items: RegistrationOut[];
  total: number;
  pending_count: number;
}

export interface RegistrationReviewInput {
  action: "approve" | "reject" | "request_info";
  reason?: string;
  assign_employee_id?: string;
}

export interface RegistrationStatusCheckResponse {
  email: string;
  company_name: string;
  status: string;
  message: string;
  review_notes?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface SendRegistrationOtpRequest {
  email: string;
}

export interface SendRegistrationOtpResponse {
  message: string;
  cooldown_seconds: number;
}

export interface VerifyRegistrationOtpRequest {
  email: string;
  code: string;
  password?: string;
  full_name?: string;
}

