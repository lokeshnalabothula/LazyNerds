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

export interface FileRecordInstructions {
  file_name: string;
  relative_path: string;
  fallback_path: string;
  expected_content: string;
}

export interface MetaRecordInstructions {
  meta_tag: string;
  snippet: string;
}

export interface PublicDomainChallengeResponse {
  domain: string;
  normalized_domain: string;
  token: string;
  dns_instructions: DnsRecordInstructions;
  file_instructions: FileRecordInstructions;
  meta_instructions: MetaRecordInstructions;
}

export interface PublicDomainVerifyRequest {
  domain: string;
  method: "dns" | "file" | "meta";
  token: string;
}

export interface PublicDomainVerifyResponse {
  verified: boolean;
  status: string;
  message: string;
  domain: string;
  method: string;
  verification_proof?: string | null;
}

export interface DomainSecurityScoreResponse {
  status: "completed" | "scanning" | "failed";
  domain: string;
  score?: number | null;
  posture?: string | null;
  findings_count?: number | null;
  severity_counts?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  } | null;
  findings?: Array<{
    id?: string;
    title: string;
    severity: string;
    description?: string;
    cvss_score?: number | null;
    remediation?: string;
  }> | null;
  metadata?: Record<string, any> | null;
  error?: string | null;
}
