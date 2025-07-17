import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AgentProfile, LoginRequest } from '@/types/shared';
import { apiClient, tokenStorage, getErrorMessage } from '../lib/api-client';

interface AuthState {
  // State
  agent: AgentProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  getProfile: () => Promise<void>;
  clearError: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      agent: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Clear error action
      clearError: () => set({ error: null }),

      // Login action
      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiClient.login(credentials);
          
          // Store tokens
          tokenStorage.setTokens(response.accessToken, response.refreshToken);
          
          // Update auth state
          set({
            agent: {
              ...response.agent,
              createdAt: new Date(),
              updatedAt: new Date(),
              isAiAgent: false, // Will be fetched from profile
            },
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Fetch full profile to get complete data
          await get().getProfile();
          
        } catch (error) {
          set({
            isLoading: false,
            error: getErrorMessage(error),
            isAuthenticated: false,
            agent: null,
          });
          tokenStorage.clearTokens();
          throw error;
        }
      },

      // Logout action
      logout: async () => {
        set({ isLoading: true });
        
        try {
          // Call logout endpoint if authenticated
          if (get().isAuthenticated) {
            await apiClient.logout();
          }
        } catch (error) {
          // Continue with logout even if API call fails
          console.warn('Logout API call failed:', getErrorMessage(error));
        } finally {
          // Clear all auth data
          tokenStorage.clearTokens();
          set({
            agent: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // Refresh token action
      refreshToken: async () => {
        try {
          const response = await apiClient.refreshToken();
          
          // Store new tokens
          tokenStorage.setTokens(response.accessToken, response.refreshToken);
          
          // Update agent data
          set({
            agent: {
              ...response.agent,
              createdAt: new Date(),
              updatedAt: new Date(),
              isAiAgent: false, // Will be updated from profile
            },
            isAuthenticated: true,
            error: null,
          });

          // Fetch full profile
          await get().getProfile();
          
        } catch (error) {
          // Refresh failed, logout user
          await get().logout();
          throw error;
        }
      },

      // Get agent profile
      getProfile: async () => {
        try {
          const response = await apiClient.getProfile();
          set({
            agent: {
              ...response.agent,
              createdAt: new Date(response.agent.createdAt),
              updatedAt: new Date(response.agent.updatedAt),
            },
            isAuthenticated: true,
            error: null,
          });
        } catch (error) {
          set({ error: getErrorMessage(error) });
          throw error;
        }
      },

      // Initialize authentication on app start
      initializeAuth: async () => {
        const accessToken = tokenStorage.getAccessToken();
        const refreshToken = tokenStorage.getRefreshToken();

        if (!accessToken || !refreshToken) {
          set({ isAuthenticated: false, agent: null });
          return;
        }

        set({ isLoading: true });

        try {
          // Try to get profile with current token
          await get().getProfile();
        } catch (error) {
          // If profile fails, try to refresh token
          try {
            await get().refreshToken();
          } catch (refreshError) {
            // Both failed, clear auth
            await get().logout();
          }
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'dialler-auth',
      // Only persist basic auth state, not sensitive data
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        agent: state.agent ? {
          id: state.agent.id,
          email: state.agent.email,
          firstName: state.agent.firstName,
          lastName: state.agent.lastName,
          role: state.agent.role,
          isActive: state.agent.isActive,
          isAiAgent: state.agent.isAiAgent,
          createdAt: state.agent.createdAt,
          updatedAt: state.agent.updatedAt,
        } : null,
      }),
    }
  )
); 