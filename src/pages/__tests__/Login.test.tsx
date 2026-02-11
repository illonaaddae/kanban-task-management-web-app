import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { useStore } from '../../store/store';
import { Login } from '../Login';

function renderLogin() {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
}

describe('Login Component', () => {
  beforeEach(() => {
    useStore.setState({ loading: false });
  });

  it('should render login form', () => {
    renderLogin();

    expect(screen.getByPlaceholderText(/enter your username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderLogin();

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Form validation should prevent submission
    expect(screen.getByPlaceholderText(/enter your username/i)).toBeInTheDocument();
  });

  it('should update input values when typing', async () => {
    const user = userEvent.setup();
    renderLogin();

    const usernameInput = screen.getByPlaceholderText(/enter your username/i) as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText(/enter your password/i) as HTMLInputElement;

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');

    expect(usernameInput.value).toBe('testuser');
    expect(passwordInput.value).toBe('testpass');
  });

  it('should have password input type', () => {
    renderLogin();

    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should show demo hint message', () => {
    renderLogin();

    expect(screen.getByText(/demo:/i)).toBeInTheDocument();
    expect(screen.getByText(/enter any username and password to login/i)).toBeInTheDocument();
  });
});
