import { useState, useRef, useEffect } from 'react';
import styles from './Dropdown.module.css';

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  placeholder?: string;
}

export function Dropdown({ value, onChange, options, label, placeholder }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const selectedOption = options.find(opt => opt.value === value);
  
  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      {label && <label className={styles.label}>{label}</label>}
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.value}>
          {selectedOption?.label || placeholder || 'Select...'}
        </span>
        <svg className={`${styles.arrow} ${isOpen ? styles.open : ''}`} width="10" height="7" viewBox="0 0 10 7" fill="currentColor">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </button>
      
      {isOpen && (
        <ul className={styles.menu} role="listbox">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className={`${styles.option} ${value === option.value ? styles.selected : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={value === option.value}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
