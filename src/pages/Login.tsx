import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { OAuthButtons } from "./OAuthButtons";
import toast from "react-hot-toast";
import styles from "./Login.module.css";
import { Loader } from "../components/ui/Loader";
import { Logo } from "../components/ui/Logo";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const { login, logout, loginWithSlack, loginWithGoogle, register, loading, isAuthenticated, user } =
    useStore(
      useShallow((state) => ({
        login: state.login,
        logout: state.logout,
        loginWithSlack: state.loginWithSlack,
        loginWithGoogle: state.loginWithGoogle,
        register: state.register,
        loading: state.loading,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }))
    );
  const navigate = useNavigate();
  const useAppwrite = import.meta.env.VITE_USE_APPWRITE === "true";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        await register(email, password, name);
        toast.success("Account created successfully!");
      } else {
        await login(email, password);
        toast.success("Welcome back!");
      }
      navigate("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Authentication failed",
      );
    }
  };

  const handleOAuth = async (provider: "google" | "slack") => {
    try {
      await (provider === "google" ? loginWithGoogle() : loginWithSlack());
    } catch {
      toast.error(`Failed to connect with ${provider}`);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  // ── Authenticated "Welcome Back" screen ─────────────────────────
  if (isAuthenticated) {
    const initials = user?.name
      ? user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : user?.email?.[0]?.toUpperCase() ?? "?";

    return (
      <div className={styles.container}>
        <div className={styles.leftSide}>
          <div className={`${styles.card} ${styles.welcomeBack}`}>
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name || user.email || 'User Avatar'} className={styles.avatarImage} />
          ) : (
            <div className={styles.avatar}>{initials}</div>
          )}
          <h1 className={styles.title}>Welcome back!</h1>
          {user?.name && <p className={styles.userName}>{user.name}</p>}
          <p className={styles.userEmail}>{user?.email}</p>

          <div className={styles.actions}>
            <Button
              variant="primary"
              size="large"
              onClick={() => navigate("/")}
            >
              Continue to Dashboard
            </Button>
            <button
              onClick={async () => {
                await logout();
              }}
              className={styles.switchLink}
            >
              Not you? Sign in with a different account
            </button>
          </div>
        </div>
        </div>
        <div className={styles.rightSide}>
          <div className={styles.logoWrapper}>
            <Logo />
          </div>
          <p className={styles.description}>
            A powerful task management tool to keep your projects organized and your team aligned. Track progress, manage workflows, and collaborate seamlessly.
          </p>
        </div>
      </div>
    );
  }

  // ── Sign-in / Sign-up form ───────────────────────────────────────
  return (
    <div className={styles.container}>
      <div className={styles.leftSide}>
        <div className={styles.card}>
        <h1 className={styles.title}>
          {isRegistering ? "Create Account" : "Welcome Back"}
        </h1>
        <p className={styles.subtitle}>
          {isRegistering
            ? "Sign up to start managing your tasks"
            : "Sign in to access your boards"}
        </p>

        {useAppwrite && (
          <OAuthButtons
            onGoogleLogin={() => handleOAuth("google")}
            onSlackLogin={() => handleOAuth("slack")}
          />
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {isRegistering && (
            <Input
              label="Name"
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <Input
            label={useAppwrite ? "Email" : "Username"}
            type={useAppwrite ? "email" : "text"}
            placeholder={
              useAppwrite ? "Enter your email" : "Enter your username"
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={useAppwrite ? 8 : 1}
          />
          {isRegistering && useAppwrite && (
            <p className={styles.demo} style={{ marginTop: "-0.5rem" }}>
              Password must be at least 8 characters. Avoid common passwords
              like &ldquo;Test12345&rdquo; or &ldquo;Password1&rdquo;.
            </p>
          )}
          <Button variant="primary" size="large" type="submit">
            {isRegistering ? "Sign Up" : "Sign In"}
          </Button>
        </form>

        {useAppwrite && (
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className={styles.toggle}
          >
            {isRegistering
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        )}
        {!useAppwrite && (
          <p className={styles.demo}>
            <strong>Demo:</strong> Enter any username and password to login
          </p>
        )}
      </div>
      </div>
      <div className={styles.rightSide}>
        <div className={styles.logoWrapper}>
          <Logo />
        </div>
        <p className={styles.description}>
          A powerful task management tool to keep your projects organized and your team aligned. Track progress, manage workflows, and collaborate seamlessly.
        </p>
      </div>
    </div>
  );
}
