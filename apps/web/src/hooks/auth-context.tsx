'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { User, ApiResponse } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isMountLoading, setIsMountLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const storedToken = localStorage.getItem('pulse_token');
    const storedUser = localStorage.getItem('pulse_user');
    if (storedToken && storedUser) {
      setTokenState(storedToken);
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        // Clear corrupt data
        localStorage.removeItem('pulse_token');
        localStorage.removeItem('pulse_user');
      }
    }
    setIsMountLoading(false);
  }, []);

  const { data: meData, isLoading: isQueryLoading } = useQuery<ApiResponse<User>>({
    queryKey: ['me'],
    queryFn: () => apiClient.get<ApiResponse<User>>('/auth/me'),
    enabled: !!token,
  });

  useEffect(() => {
    if (meData?.data) {
      setUser(meData.data);
      localStorage.setItem('pulse_user', JSON.stringify(meData.data));
    }
  }, [meData]);

  const login = (newToken: string, loggedInUser: User) => {
    localStorage.setItem('pulse_token', newToken);
    localStorage.setItem('pulse_user', JSON.stringify(loggedInUser));
    setTokenState(newToken);
    setUser(loggedInUser);
  };

  const logout = () => {
    localStorage.removeItem('pulse_token');
    localStorage.removeItem('pulse_user');
    setTokenState(null);
    setUser(null);
    queryClient.clear();
  };

  const updateUser = (updatedUser: User) => {
    localStorage.setItem('pulse_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const isLoading = isMountLoading || (!!token && isQueryLoading);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
export type { User };
