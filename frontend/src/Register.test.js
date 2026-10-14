import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import Register from './Register';

jest.mock('./firebase', () => ({ auth: { name: 'mock-auth' } }));
jest.mock('firebase/auth', () => ({ createUserWithEmailAndPassword: jest.fn() }));

function renderRegister() {
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<p>Dashboard Page</p>} />
        <Route path="/login" element={<p>Login Page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillAndSubmit(email, password) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
}

describe('Register (US-01)', () => {
  test('renders required email and password fields and a Sign Up button', () => {
    renderRegister();
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeRequired();
    expect(screen.getByPlaceholderText('••••••••')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeEnabled();
  });

  test('creates the Firebase account and redirects to /dashboard on success', async () => {
    createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'new' } });
    renderRegister();
    fillAndSubmit('new@example.com', 'password123');
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'new@example.com', 'password123');
  });

  test('shows Firebase validation errors such as a weak password', async () => {
    createUserWithEmailAndPassword.mockRejectedValue(
      new Error('Firebase: Password should be at least 6 characters (auth/weak-password).')
    );
    renderRegister();
    fillAndSubmit('new@example.com', '123');
    expect(await screen.findByText('Password should be at least 6 characters (auth/weak-password).')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
  });

  test('shows an error when the email is already registered', async () => {
    createUserWithEmailAndPassword.mockRejectedValue(new Error('Firebase: Error (auth/email-already-in-use).'));
    renderRegister();
    fillAndSubmit('taken@example.com', 'password123');
    expect(await screen.findByText('Error (auth/email-already-in-use).')).toBeInTheDocument();
  });

  test('disables the button and shows "Registering..." while the request is pending', async () => {
    let finish;
    createUserWithEmailAndPassword.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderRegister();
    fillAndSubmit('new@example.com', 'password123');
    expect(await screen.findByRole('button', { name: 'Registering...' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByText('Dashboard Page')).toBeInTheDocument());
  });

  test('links to the login page', () => {
    renderRegister();
    fireEvent.click(screen.getByRole('link', { name: 'Sign In' }));
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
