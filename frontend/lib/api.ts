import {
  Client,
  ClientCreateInput,
  ClientListResponse,
  ClientUpdateInput,
  TokenResponse,
  User,
  BulkArchiveResponse,
  BulkRestoreResponse,
} from "@/types/client";
import {
  ClientRegisterInput,
  RegistrationOut,
  RegistrationListResponse,
  RegistrationReviewInput,
  RegistrationStatusCheckResponse,
} from "@/types/registration";
import {
  Engagement,
  EngagementCreateInput,
  EngagementListResponse,
  EngagementUpdateInput,
  WebsiteAuditInput,
  WebsiteAuditResponse,
} from "@/types/engagement";
import {
  Asset,
  AssetCreateInput,
  AssetListResponse,
  AssetUpdateInput,
} from "@/types/asset";
import {
  Finding,
  FindingCreateInput,
  FindingListResponse,
  FindingUpdateInput,
  Verification,
  VerificationCreateInput,
  Assessment,
  AssessmentListResponse,
  ScanImportInput,
  ScanLaunchInput,
} from "@/types/finding";
import {
  AutomationRule,
  AutomationRuleCreateInput,
  AutomationRuleListResponse,
  AutomationExecution,
  AutomationExecutionListResponse,
} from "@/types/automation";
import {
  Report,
  ReportCreateInput,
  ReportListResponse,
} from "@/types/report";
import {
  Notification,
  NotificationListResponse,
} from "@/types/notification";
import {
  OverviewMetrics,
  AuditLog,
} from "@/types/overview";

const API_BASE_URL = typeof window !== "undefined"
  ? "/api/v1"
  : process.env.INTERNAL_API_URL
    ? `${process.env.INTERNAL_API_URL}/api/v1`
    : "http://127.0.0.1:8000/api/v1";

class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("fixops_token");
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem("fixops_token", token);
    } else {
      localStorage.removeItem("fixops_token");
    }
  } catch {
    // Ignore storage quota / security errors in restricted browser contexts
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const token = getStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;
  const signal = options.signal || (controller ? controller.signal : undefined);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Send HttpOnly cookie
      signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new ApiError(408, "Request timed out after 15 seconds. Please verify backend connectivity.");
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    let errorData = null;
    try {
      errorData = await response.json();
      if (errorData.detail) {
        if (typeof errorData.detail === "string") {
          errorDetail = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorDetail = errorData.detail.map((e: any) => e.msg || e.message).join(", ");
        }
      } else if (errorData.errors && Array.isArray(errorData.errors)) {
        errorDetail = errorData.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
      }
    } catch {
      errorDetail = `Request failed with status ${response.status}: ${response.statusText}`;
    }

    throw new ApiError(response.status, errorDetail, errorData);
  }

  // Handle 204 No Content or empty response body safely
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<TokenResponse> {
    const data = await request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.access_token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      setStoredToken(null);
    }
  },

  async getCurrentUser(): Promise<User> {
    return request<User>("/auth/me");
  },

  async changePassword(current_password: string, new_password: string): Promise<{ message: string }> {
    return request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    });
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async verifyResetToken(token: string): Promise<{ valid: boolean; email_masked?: string; message?: string }> {
    return request<{ valid: boolean; email_masked?: string; message?: string }>("/auth/verify-reset-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  async resetPassword(token: string, new_password: string): Promise<{ message: string }> {
    return request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    });
  },

  async getUsers(role?: string): Promise<User[]> {
    const qs = role ? `?role=${encodeURIComponent(role)}` : "";
    return request<User[]>(`/auth/users${qs}`);
  },

  // Clients
  async getClients(params: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    sort_by?: string;
    sort_order?: string;
  } = {}): Promise<ClientListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.page_size) query.set("page_size", params.page_size.toString());
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.sort_by) query.set("sort_by", params.sort_by);
    if (params.sort_order) query.set("sort_order", params.sort_order);

    const qs = query.toString();
    return request<ClientListResponse>(`/clients${qs ? `?${qs}` : ""}`);
  },

  async getClientById(id: string): Promise<Client> {
    return request<Client>(`/clients/${encodeURIComponent(id)}`);
  },

  async createClient(input: ClientCreateInput): Promise<Client> {
    return request<Client>("/clients", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateClient(id: string, input: ClientUpdateInput): Promise<Client> {
    return request<Client>(`/clients/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async archiveClient(id: string): Promise<Client> {
    return request<Client>(`/clients/${encodeURIComponent(id)}/archive`, {
      method: "POST",
    });
  },

  async restoreClient(id: string): Promise<Client> {
    return request<Client>(`/clients/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    });
  },

  async bulkArchiveClients(client_ids: string[]): Promise<BulkArchiveResponse> {
    return request<BulkArchiveResponse>("/clients/bulk-archive", {
      method: "POST",
      body: JSON.stringify({ client_ids }),
    });
  },

  async bulkRestoreClients(client_ids: string[]): Promise<BulkRestoreResponse> {
    return request<BulkRestoreResponse>("/clients/bulk-restore", {
      method: "POST",
      body: JSON.stringify({ client_ids }),
    });
  },

  async assignClient(clientId: string, employeeId: string | null): Promise<Client> {
    return request<Client>(`/clients/${encodeURIComponent(clientId)}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ employee_id: employeeId }),
    });
  },

  // Client Registrations (Self-Service Onboarding & Founder Review)
  async registerClient(input: ClientRegisterInput): Promise<{ status: string; registration_id: string; company_name: string; message: string }> {
    return request<{ status: string; registration_id: string; company_name: string; message: string }>("/registrations/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async checkRegistrationStatus(email: string): Promise<RegistrationStatusCheckResponse> {
    return request<RegistrationStatusCheckResponse>(`/registrations/status?email=${encodeURIComponent(email)}`);
  },

  async getRegistrations(status?: string): Promise<RegistrationListResponse> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<RegistrationListResponse>(`/registrations${qs}`);
  },

  async getRegistration(id: string): Promise<RegistrationOut> {
    return request<RegistrationOut>(`/registrations/${encodeURIComponent(id)}`);
  },

  async reviewRegistration(id: string, input: RegistrationReviewInput): Promise<RegistrationOut> {
    return request<RegistrationOut>(`/registrations/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  // Engagements
  async getEngagements(params: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    assessment_type?: string;
    client_id?: string;
    authorization_status?: string;
    sort_by?: string;
    sort_order?: string;
  } = {}): Promise<EngagementListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.page_size) query.set("page_size", params.page_size.toString());
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.assessment_type) query.set("assessment_type", params.assessment_type);
    if (params.client_id) query.set("client_id", params.client_id);
    if (params.authorization_status) query.set("authorization_status", params.authorization_status);
    if (params.sort_by) query.set("sort_by", params.sort_by);
    if (params.sort_order) query.set("sort_order", params.sort_order);

    const qs = query.toString();
    return request<EngagementListResponse>(`/engagements${qs ? `?${qs}` : ""}`);
  },

  async getEngagementById(id: string): Promise<Engagement> {
    return request<Engagement>(`/engagements/${encodeURIComponent(id)}`);
  },

  async createEngagement(input: EngagementCreateInput): Promise<Engagement> {
    return request<Engagement>("/engagements", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateEngagement(id: string, input: EngagementUpdateInput): Promise<Engagement> {
    return request<Engagement>(`/engagements/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async archiveEngagement(id: string): Promise<Engagement> {
    return request<Engagement>(`/engagements/${encodeURIComponent(id)}/archive`, {
      method: "POST",
    });
  },

  async restoreEngagement(id: string): Promise<Engagement> {
    return request<Engagement>(`/engagements/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    });
  },

  // Assets (Module C)
  async getAssets(params: {
    page?: number;
    page_size?: number;
    client_id?: string;
    engagement_id?: string;
    asset_type?: string;
    in_scope?: boolean;
    criticality?: string;
    search?: string;
  } = {}): Promise<AssetListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.page_size) query.set("page_size", params.page_size.toString());
    if (params.client_id) query.set("client_id", params.client_id);
    if (params.engagement_id) query.set("engagement_id", params.engagement_id);
    if (params.asset_type) query.set("asset_type", params.asset_type);
    if (params.in_scope !== undefined) query.set("in_scope", params.in_scope.toString());
    if (params.criticality) query.set("criticality", params.criticality);
    if (params.search) query.set("search", params.search);

    const qs = query.toString();
    return request<AssetListResponse>(`/assets${qs ? `?${qs}` : ""}`);
  },

  async getAssetById(id: string): Promise<Asset> {
    return request<Asset>(`/assets/${encodeURIComponent(id)}`);
  },

  async createAsset(input: AssetCreateInput): Promise<Asset> {
    return request<Asset>("/assets", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateAsset(id: string, input: AssetUpdateInput): Promise<Asset> {
    return request<Asset>(`/assets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async deleteAsset(id: string): Promise<void> {
    await request(`/assets/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // Findings & Assessments (Module D & E)
  async getFindings(params: {
    page?: number;
    page_size?: number;
    engagement_id?: string;
    asset_id?: string;
    assessment_id?: string;
    severity?: string;
    status?: string;
    search?: string;
  } = {}): Promise<FindingListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.page_size) query.set("page_size", params.page_size.toString());
    if (params.engagement_id) query.set("engagement_id", params.engagement_id);
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.assessment_id) query.set("assessment_id", params.assessment_id);
    if (params.severity) query.set("severity", params.severity);
    if (params.status) query.set("status", params.status);
    if (params.search) query.set("search", params.search);

    const qs = query.toString();
    return request<FindingListResponse>(`/findings${qs ? `?${qs}` : ""}`);
  },

  async getFindingById(id: string): Promise<Finding> {
    return request<Finding>(`/findings/${encodeURIComponent(id)}`);
  },

  async createFinding(input: FindingCreateInput): Promise<Finding> {
    return request<Finding>("/findings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateFinding(id: string, input: FindingUpdateInput): Promise<Finding> {
    return request<Finding>(`/findings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async addVerification(findingId: string, input: VerificationCreateInput): Promise<Verification> {
    return request<Verification>(`/findings/${encodeURIComponent(findingId)}/verifications`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async importScan(input: ScanImportInput): Promise<Assessment> {
    return request<Assessment>("/findings/import-scan", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async launchScan(input: ScanLaunchInput): Promise<Assessment> {
    return request<Assessment>("/findings/launch-scan", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async submitWebsiteAudit(input: WebsiteAuditInput): Promise<WebsiteAuditResponse> {
    return request<WebsiteAuditResponse>("/engagements/website-audit", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async cancelScan(assessmentId: string): Promise<Assessment> {
    return request<Assessment>(`/findings/assessments/${encodeURIComponent(assessmentId)}/cancel`, {
      method: "POST",
    });
  },

  async getAssessmentById(assessmentId: string): Promise<Assessment> {
    return request<Assessment>(`/findings/assessments/${encodeURIComponent(assessmentId)}`);
  },

  async getAssessments(engagementId?: string): Promise<AssessmentListResponse> {
    const qs = engagementId ? `?engagement_id=${encodeURIComponent(engagementId)}` : "";
    return request<AssessmentListResponse>(`/findings/assessments${qs}`);
  },

  // Automation Engine (Module F)
  async getAutomationRules(isActive?: boolean): Promise<AutomationRuleListResponse> {
    const qs = isActive !== undefined ? `?is_active=${isActive}` : "";
    return request<AutomationRuleListResponse>(`/automation/rules${qs}`);
  },

  async createAutomationRule(input: AutomationRuleCreateInput): Promise<AutomationRule> {
    return request<AutomationRule>("/automation/rules", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateAutomationRule(id: string, input: Partial<AutomationRuleCreateInput>): Promise<AutomationRule> {
    return request<AutomationRule>(`/automation/rules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async deleteAutomationRule(id: string): Promise<void> {
    await request(`/automation/rules/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async getAutomationExecutions(params: { rule_id?: string; status?: string } = {}): Promise<AutomationExecutionListResponse> {
    const query = new URLSearchParams();
    if (params.rule_id) query.set("rule_id", params.rule_id);
    if (params.status) query.set("status", params.status);
    const qs = query.toString();
    return request<AutomationExecutionListResponse>(`/automation/executions${qs ? `?${qs}` : ""}`);
  },

  async dispatchWorkflow(ruleId: string, payload: any = {}): Promise<AutomationExecution> {
    return request<AutomationExecution>("/automation/dispatch", {
      method: "POST",
      body: JSON.stringify({ rule_id: ruleId, payload }),
    });
  },

  async approveExecution(executionId: string, action: "approve" | "reject", notes?: string): Promise<AutomationExecution> {
    return request<AutomationExecution>(`/automation/executions/${encodeURIComponent(executionId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    });
  },

  async runRemediationReminders(): Promise<{
    status: string;
    findings_checked: number;
    reminders_sent: number;
    duplicates_skipped: number;
    errors: number;
    details: any[];
  }> {
    return request("/automation/remediation-reminders/run", {
      method: "POST",
    });
  },

  async getRemediationReminderStatus(): Promise<{
    status: string;
    rule_id?: string | null;
    last_executed_at: string | null;
    last_status: string | null;
    open_findings_with_deadlines: number;
    overdue_count: number;
  }> {
    return request("/automation/remediation-reminders/status");
  },

  // Reports (Module G)
  async getReports(params: { page?: number; page_size?: number; engagement_id?: string; report_type?: string } = {}): Promise<ReportListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.page_size) query.set("page_size", params.page_size.toString());
    if (params.engagement_id) query.set("engagement_id", params.engagement_id);
    if (params.report_type) query.set("report_type", params.report_type);
    const qs = query.toString();
    return request<ReportListResponse>(`/reports${qs ? `?${qs}` : ""}`);
  },

  async getReportById(id: string): Promise<Report> {
    return request<Report>(`/reports/${encodeURIComponent(id)}`);
  },

  async createReport(input: ReportCreateInput): Promise<Report> {
    return request<Report>("/reports", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async downloadReportDeliverable(reportId: string, format: "html" | "markdown"): Promise<Blob> {
    const token = getStoredToken();
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${API_BASE_URL}/reports/${encodeURIComponent(reportId)}/download?format=${format}`, {
      headers,
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(`Failed to download report (${res.status}: ${res.statusText})`);
    }
    return res.blob();
  },

  // Notifications (Module H)
  async getNotifications(limit: number = 50): Promise<NotificationListResponse> {
    return request<NotificationListResponse>(`/notifications?limit=${limit}`);
  },

  async markNotificationRead(id: string): Promise<Notification> {
    return request<Notification>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
  },

  async markAllNotificationsRead(): Promise<{ marked_read: number }> {
    return request<{ marked_read: number }>("/notifications/read-all", {
      method: "POST",
    });
  },

  // Overview / Dashboard (Module I)
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    return request<OverviewMetrics>("/overview/metrics");
  },

  // Audit Logs (Module J)
  async getAuditLogs(page: number = 1): Promise<{ items: AuditLog[]; total: number; total_pages: number }> {
    return request(`/audit-logs?page=${page}`);
  },

  async getHealth(): Promise<{
    status: string;
    database: string;
    service?: string;
    version?: string;
    commit?: string;
    environment?: string;
    worker_dispatch_mode?: string;
    timestamp?: string;
  }> {
    return request("/health");
  },
};
