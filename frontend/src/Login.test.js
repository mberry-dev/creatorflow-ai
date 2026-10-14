import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login';

jest.mock('./firebase', () => ({ auth: { name: 'mock-auth' } }));
jest.mock('firebase/auth', () => ({ signInWithEmailAndPassword: jest.fn() }));

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<p>Dashboard Page</p>} />
        <Route path="/register" element={<p>Register Page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillAndSubmit(email, password) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

describe('Login (US-02)', () => {
  test('renders required email and password fields and a Sign In button', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('you@example.com')).toBeRequired();
    expect(screen.getByPlaceholderText('you@example.com')).toHaveAttribute('type', 'email');
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  test('signs in with Firebase and redirects to /dashboard on success', async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1' } });
    renderLogin();
    fillAndSubmit('creator@example.com', 'password123');
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'creator@example.com', 'password123');
  });

  test('shows the Firebase error (without the "Firebase: " prefix) and stays on the page', async () => {
    signInWithEmailAndPassword.mockRejectedValue(new Error('Firebase: Error (auth/invalid-credential).'));
    renderLogin();
    fillAndSubmit('creator@example.com', 'wrong-pass');
    expect(await screen.findByText('Error (auth/invalid-credential).')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
  });

  test('disables the button and shows "Logging in..." while the request is pending', async () => {
    let finish;
    signInWithEmailAndPassword.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderLogin();
    fillAndSubmit('creator@example.com', 'password123');
    const button = await screen.findByRole('button', { name: 'Logging in...' });
    expect(button).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByText('Dashboard Page')).toBeInTheDocument());
  });

  test('links to the registration page', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('link', { name: 'Sign Up' }));
    expect(screen.getByText('Register Page')).toBeInTheDocument();
  });
});
