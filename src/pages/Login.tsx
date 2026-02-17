import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { OAuthButtons } from './OAuthButtons';
import toast from 'react-hot-toast';
import styles from './Login.module.css';
import { Loader } from '../components/ui/Loader';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const login = useStore((state) => state.login);
  const loginWithSlack = useStore((state) => state.loginWithSlack);
  const loginWithGoogle = useStore((state) => state.loginWithGoogle);
  const register = useStore((state) => state.register);
  const loading = useStore((state) => state.loading);
  const navigate = useNavigate();
  const useAppwrite = import.meta.env.VITE_USE_APPWRITE === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        await register(email, password, name);
        toast.success('Account created successfully!');
      } else {
        await login(email, password);
        toast.success('Welcome back!');
      }
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
    }
  };

  const handleOAuth = async (provider: 'google' | 'slack') => {
    try {
      await (provider === 'google' ? loginWithGoogle() : loginWithSlack());
    } catch {
      toast.error(`Failed to connect with ${provider}`);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{isRegistering ? 'Create Account' : 'Welcome Back'}</h1>
        <p className={styles.subtitle}>
          {isRegistering ? 'Sign up to start managing your tasks' : 'Sign in to access your boards'}
        </p>

        {useAppwrite && (
          <OAuthButtons
            onGoogleLogin={() => handleOAuth('google')}
            onSlackLogin={() => handleOAuth('slack')}
          />
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {isRegistering && (
            <Input label="Name" type="text" placeholder="Enter your name" value={name}
              onChange={(e) => setName(e.target.value)} required />
          )}
          <Input label={useAppwrite ? 'Email' : 'Username'} type={useAppwrite ? 'email' : 'text'}
            placeholder={useAppwrite ? 'Enter your email' : 'Enter your username'}
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" placeholder="Enter your password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={useAppwrite ? 8 : 1} />
          <Button variant="primary" size="large" type="submit">
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </Button>
        </form>

        {useAppwrite && (
          <button onClick={() => setIsRegistering(!isRegistering)} className={styles.toggle}>
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        )}
        {!useAppwrite && (
          <p className={styles.demo}><strong>Demo:</strong> Enter any username and password to login</p>
        )}
      </div>
    </div>
  );
}
