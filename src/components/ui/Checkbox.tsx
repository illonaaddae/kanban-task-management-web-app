import { type InputHTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Checkbox({ label, checked, ...props }: CheckboxProps) {
  return (
    <div className={styles.container}>
      <input 
        type="checkbox" 
        className={styles.checkboxInput}
        checked={checked}
        {...props}
      />
      <span className={`${styles.label} ${checked ? styles.completed : ''}`}>
        {label}
      </span>
    </div>
  );
}
