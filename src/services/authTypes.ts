export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthService {
  login(email: string, password: string): Promise<User>;
  loginWithSlack(): Promise<void>;
  loginWithGoogle(): Promise<void>;
  register(email: string, password: string, name: string): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  handleOAuthCallback(userId?: string, secret?: string): Promise<User | null>;
  updateProfile(name: string, avatarFile?: File): Promise<User>;
}
