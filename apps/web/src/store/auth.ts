import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent } from '@dialler/shared';

interface AuthState {
  agent: Agent | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, agent: Agent) => void;
  logout: () => void;
  updateAgent: (agent: Partial<Agent>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      agent: null,
      token: null,
      isAuthenticated: false,

      login: (token: string, agent: Agent) => {
        localStorage.setItem('token', token);
        set({
          token,
          agent,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('token');
        set({
          token: null,
          agent: null,
          isAuthenticated: false,
        });
      },

      updateAgent: (agentUpdate: Partial<Agent>) => {
        const currentAgent = get().agent;
        if (currentAgent) {
          set({
            agent: { ...currentAgent, ...agentUpdate },
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        agent: state.agent,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 