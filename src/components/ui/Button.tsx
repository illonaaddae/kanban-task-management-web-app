import { type ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'small' | 'medium' | 'large';
}

export function Button({
  variant = 'primary',
  size = 'medium',
  className = '',
  // HTML defaults a button inside a form to `type="submit"`, which made
  // "+ Add New Column" and "+ Add New Subtask" submit the form they were meant
  // to add a row to - the board or task was created on the first click, with
  // whatever was filled in so far. Every form here passes `type="submit"`
  // explicitly, so the safe default is the inert one.
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

