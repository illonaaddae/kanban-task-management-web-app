import { createContext, useContext, useState, type ReactNode } from 'react';

export interface AuthContextType {
  isLoggedIn: boolean;
  user: string | null;
  login: (username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize state synchronously from localStorage to avoid race conditions
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const savedUser = localStorage.getItem('kanban_user');
    return !!savedUser;
  });
  
  const [user, setUser] = useState<string | null>(() => {
    return localStorage.getItem('kanban_user');
  });

  const login = (username: string) => {
    setIsLoggedIn(true);
    setUser(username);
    localStorage.setItem('kanban_user', username);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('kanban_user');
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
