import type { User, AuthService } from './authService';

export class MockAuthService implements AuthService {
  async login(email: string, password: string): Promise<User> {
    if (!email || !password) throw new Error('Invalid credentials');
    const user = { id: '1', email, name: email.split('@')[0], avatar: undefined };
    localStorage.setItem('kanban_user', user.name);
    return user;
  }

  async loginWithSlack(): Promise<void> {
    localStorage.setItem('kanban_user', 'Slack User');
    window.location.href = '/';
  }

  async loginWithGoogle(): Promise<void> {
    localStorage.setItem('kanban_user', 'Google User');
    window.location.href = '/';
  }

  async register(_email: string, password: string, name: string): Promise<User> {
    if (!password) throw new Error('Password is required');
    const user = { id: '1', email: _email, name, avatar: undefined };
    localStorage.setItem('kanban_user', name);
    return user;
  }

  async logout(): Promise<void> {
    localStorage.removeItem('kanban_user');
  }

  async getCurrentUser(): Promise<User | null> {
    const name = localStorage.getItem('kanban_user');
    const avatar = localStorage.getItem('kanban_avatar') || undefined;
    return name ? { id: '1', email: `${name}@demo.com`, name, avatar } : null;
  }

  async handleOAuthCallback(): Promise<User | null> {
    return this.getCurrentUser();
  }

  async updateProfile(name: string, avatarFile?: File): Promise<User> {
    localStorage.setItem('kanban_user', name);
    let avatar = undefined;
    if (avatarFile) {
      avatar = URL.createObjectURL(avatarFile);
      localStorage.setItem('kanban_avatar', avatar);
    }
    return { id: '1', email: `${name}@demo.com`, name, avatar };
  }
}
