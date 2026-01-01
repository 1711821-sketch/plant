import { create } from 'zustand';
import type { User } from '../types';
import { authApi, setAuthToken, getAuthToken } from '../api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });

    const { data, error } = await authApi.login(username, password);

    if (error) {
      set({ error, isLoading: false });
      return false;
    }

    if (data?.user) {
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    }

    set({ isLoading: false });
    return false;
  },

  logout: async () => {
    await authApi.logout();
    set({
      user: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    const token = getAuthToken();

    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const { data, error } = await authApi.me();

      if (error || !data) {
        setAuthToken(null);
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }

      set({
        user: {
          id: data.userId,
          username: '',
          name: data.name,
          role: data.role as 'admin' | 'user',
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      setAuthToken(null);
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },

  clearError: () => set({ error: null }),
}));
