export type ClientStatus = "active" | "archived";

export interface Client {
  id: string;
  company_name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  website: string | null;
  phone: string | null;
  industry: string | null;
  notes: string | null;
  assigned_employee_id?: string | null;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

export interface ClientCreateInput {
  company_name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  website?: string | null;
  phone?: string | null;
  industry?: string | null;
  notes?: string | null;
  assigned_employee_id?: string | null;
  created_at?: string | null;
}

export interface ClientUpdateInput {
  company_name?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  website?: string | null;
  phone?: string | null;
  industry?: string | null;
  notes?: string | null;
  assigned_employee_id?: string | null;
}

export interface ClientListResponse {
  items: Client[];
  total: int;
  page: int;
  page_size: int;
  total_pages: int;
}

type int = number;

export type UserRole = "founder" | "employee" | "client";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole | string;
  client_id?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface BulkArchiveResponse {
  archived_count: number;
  client_ids: string[];
  message: string;
}

export interface BulkRestoreResponse {
  restored_count: number;
  client_ids: string[];
  message: string;
}

export interface ApiError {
  detail: string;
  errors?: Array<{ field: string; message: string }>;
}
