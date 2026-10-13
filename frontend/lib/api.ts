import { Client, ClientCreateInput, ClientListResponse, ClientUpdateInput, TokenResponse, User } from "@/types/client";

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

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fixops_token");
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("fixops_token", token);
  } else {
    localStorage.removeItem("fixops_token");
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
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Send HttpOnly cookie
  });

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

  async getHealth(): Promise<{ status: string; database: string }> {
    return request("/health");
  },
};
