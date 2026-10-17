export type AssetType =
  | "domain"
  | "ip_address"
  | "web_application"
  | "api"
  | "cloud_resource"
  | "network_range";

export type EnvironmentType = "production" | "staging" | "development";
export type CriticalityType = "critical" | "high" | "medium" | "low";
export type AuthorizationStatusType = "verified" | "pending" | "unauthorized";

export interface Asset {
  id: string;
  client_id: string;
  engagement_id?: string | null;
  name: string;
  asset_type: AssetType;
  target: string;
  environment: EnvironmentType;
  criticality: CriticalityType;
  in_scope: boolean;
  authorization_status: AuthorizationStatusType;
  notes?: string | null;
  client_company_name?: string | null;
  engagement_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetCreateInput {
  client_id: string;
  engagement_id?: string | null;
  name: string;
  asset_type: AssetType;
  target: string;
  environment?: EnvironmentType;
  criticality?: CriticalityType;
  in_scope?: boolean;
  authorization_status?: AuthorizationStatusType;
  notes?: string | null;
}

export interface AssetUpdateInput {
  name?: string;
  asset_type?: AssetType;
  target?: string;
  environment?: EnvironmentType;
  criticality?: CriticalityType;
  in_scope?: boolean;
  authorization_status?: AuthorizationStatusType;
  engagement_id?: string | null;
  notes?: string | null;
}

export interface AssetListResponse {
  items: Asset[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
