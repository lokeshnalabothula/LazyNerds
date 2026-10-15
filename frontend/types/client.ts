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
}

export interface ClientListResponse {
  items: Client[];
  total: int;
  page: int;
  page_size: int;
  total_pages: int;
}

type int = number;

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string;
  errors?: Array<{ field: string; message: string }>;
}
