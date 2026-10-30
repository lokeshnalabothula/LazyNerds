export interface DnsRecordInstructions {
  record_type: string;
  record_name: string;
  record_host: string;
  record_value?: string | null;
  expected_format: string;
  ttl: number;
}

export type DomainVerificationStatus = "pending" | "verified" | "failed" | "expired";

export interface Domain {
  id: string;
  client_id: string;
  domain: string;
  normalized_domain: string;
  verification_status: DomainVerificationStatus;
  challenge_created_at: string;
  challenge_expires_at: string;
  verified_at?: string | null;
  last_verification_attempt_at?: string | null;
  verification_attempt_count: number;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
  dns_instructions: DnsRecordInstructions;
}

export interface DomainCreateInput {
  domain: string;
  client_id?: string;
}

export interface DomainCreateResponse {
  domain: Domain;
  token: string;
  dns_instructions: DnsRecordInstructions;
}

export interface DomainRegenerateResponse {
  domain: Domain;
  token: string;
  dns_instructions: DnsRecordInstructions;
}

export interface DomainVerificationResult {
  verified: boolean;
  status: DomainVerificationStatus;
  message: string;
  domain: Domain;
}

export interface DomainListResponse {
  items: Domain[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
