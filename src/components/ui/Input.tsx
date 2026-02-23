import { type InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div className={styles.container}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <input
        id={inputId}
        className={`${styles.input} ${error ? styles.error : ''} ${className}`}
        {...props}
      />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}
