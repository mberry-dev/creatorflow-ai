import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import App from './App';

jest.mock('./firebase', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
}));
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
// The studio has its own test file; stub it here so App tests stay focused on routing/auth.
jest.mock('./components/AIToolStudio', () => ({
  __esModule: true,
  default: () => 'AI Tool Studio (stub)',
}));

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const unsubscribe = jest.fn();

// Simulate Firebase reporting the given user (or null) to App's auth listener.
function mockAuthUser(user) {
  onAuthStateChanged.mockImplementation((_auth, cb) => {
    cb(user);
    return unsubscribe;
  });
}

beforeEach(() => {
  window.history.pushState({}, '', '/');
  axios.get.mockResolvedValue({ data: { status: 'Online', message: 'Backend pipeline is live via CORS!' } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('App shell', () => {
  test('shows the loading shell until Firebase reports the auth state', () => {
    onAuthStateChanged.mockImplementation(() => unsubscribe); // never calls back
    render(<App />);
    expect(screen.getByText(/Loading CreatorFlow Shell/i)).toBeInTheDocument();
  });

  test('renders the landing page with Get Started and Sign In for logged-out visitors', async () => {
    mockAuthUser(null);
    render(<App />);
    expect(await screen.findByText(/Optimize Your Content with/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register');
    expect(screen.getAllByRole('link', { name: 'Sign In' })[0]).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument();
  });

  test('shows the backend as Online when /api/status responds', async () => {
    mockAuthUser(null);
    render(<App />);
    expect(await screen.findByText('Online')).toBeInTheDocument();
    expect(screen.getByText(/Backend pipeline is live via CORS!/)).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(`${API_URL}/api/status`);
  });

  test('shows the backend as Offline when /api/status fails', async () => {
    mockAuthUser(null);
    axios.get.mockRejectedValue(new Error('Network Error'));
    render(<App />);
    expect(await screen.findByText('Failed to reach backend via CORS.')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  test('shows the user email, Dashboard link, and Sign Out when logged in', async () => {
    mockAuthUser({ uid: 'u1', email: 'creator@example.com' });
    render(<App />);
    expect(await screen.findByText('creator@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Workspace' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  test('calls Firebase signOut when Sign Out is clicked', async () => {
    mockAuthUser({ uid: 'u1', email: 'creator@example.com' });
    signOut.mockResolvedValue();
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign Out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(window.alert).toHaveBeenCalledWith('Signed out successfully!');
  });

  test('unsubscribes from the auth listener on unmount', () => {
    mockAuthUser(null);
    const { unmount } = render(<App />);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('App routing', () => {
  test('redirects a logged-out visitor from /dashboard to the login page', async () => {
    mockAuthUser(null);
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByText('Welcome Back')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(screen.queryByText('AI Tool Studio (stub)')).not.toBeInTheDocument();
  });

  test('shows the AI Tool Studio on /dashboard for a logged-in user', async () => {
    mockAuthUser({ uid: 'u1', email: 'creator@example.com' });
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByText('AI Tool Studio (stub)')).toBeInTheDocument();
  });

  test('redirects a logged-in user away from /login to /dashboard', async () => {
    mockAuthUser({ uid: 'u1', email: 'creator@example.com' });
    window.history.pushState({}, '', '/login');
    render(<App />);
    expect(await screen.findByText('AI Tool Studio (stub)')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  test('redirects a logged-in user away from /register to /dashboard', async () => {
    mockAuthUser({ uid: 'u1', email: 'creator@example.com' });
    window.history.pushState({}, '', '/register');
    render(<App />);
    expect(await screen.findByText('AI Tool Studio (stub)')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });
});
