import { LoginRequest, LoginResponse, AgentProfile } from '@/types/shared';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://rmcdialer-5iwvexexb-james-campbells-projects-6c4e4922.vercel.app';

// Token storage utilities
export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem('dialler_access_token');
  },
  
  getRefreshToken(): string | null {
    return localStorage.getItem('dialler_refresh_token');
  },
  
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('dialler_access_token', accessToken);
    localStorage.setItem('dialler_refresh_token', refreshToken);
  },
  
  clearTokens(): void {
    localStorage.removeItem('dialler_access_token');
    localStorage.removeItem('dialler_refresh_token');
  }
};

// API Response types
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface ApiError extends Error {
  status: number;
  code?: string;
  details?: any;
}

// Create custom error class
class ApiClientError extends Error implements ApiError {
  constructor(
    public status: number, 
    message: string, 
    public code?: string, 
    public details?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// API Client class
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const accessToken = tokenStorage.getAccessToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data: ApiResponse<T> = await response.json();

      if (!response.ok) {
        throw new ApiClientError(
          response.status,
          data.error?.message || `HTTP ${response.status}`,
          data.error?.code,
          data.error?.details
        );
      }

      if (!data.success) {
        throw new ApiClientError(
          response.status,
          data.error?.message || 'Request failed',
          data.error?.code,
          data.error?.details
        );
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      
      // Network or other errors
      throw new ApiClientError(
        0,
        error instanceof Error ? error.message : 'Network error'
      );
    }
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse['data']> {
    return this.request<LoginResponse['data']>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async refreshToken(): Promise<LoginResponse['data']> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new ApiClientError(401, 'No refresh token available');
    }

    return this.request<LoginResponse['data']>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getProfile(): Promise<{ agent: AgentProfile }> {
    return this.request<{ agent: AgentProfile }>('/api/auth/me');
  }

  async logout(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  }

  // Utility method for automatic token refresh
  async requestWithRefresh<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      return await this.request<T>(endpoint, options);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        // Try to refresh token
        try {
          const refreshData = await this.refreshToken();
          tokenStorage.setTokens(refreshData.accessToken, refreshData.refreshToken);
          
          // Retry original request with new token
          return await this.request<T>(endpoint, options);
        } catch (refreshError) {
          // Refresh failed, clear tokens and re-throw original error
          tokenStorage.clearTokens();
          throw error;
        }
      }
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseURL}/health`);
    return response.json();
  }

  // Convenience HTTP methods
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create and export API client instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export error class for component use
export { ApiClientError };

// Helper function to handle API errors in components
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
} 