import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import UserProfileSettings from './UserProfileSettings';

jest.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

const nameInput = () => screen.getByPlaceholderText('e.g., TechFlow Studio');
const saveButton = () => screen.getByRole('button', { name: 'Save Preferences' });

beforeEach(() => {
  auth.currentUser = { uid: 'user-123' };
  // react-scripts resets mocks before every test, so implementations are set here.
  doc.mockImplementation((_db, col, id) => ({ path: `${col}/${id}` }));
  getDoc.mockResolvedValue({ exists: () => false });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('UserProfileSettings', () => {
  test('loads saved preferences into the form and reports them to the parent', async () => {
    const saved = { channelName: 'TechFlow', defaultPlatform: 'TikTok', defaultTone: 'Professional' };
    getDoc.mockResolvedValue({ exists: () => true, data: () => saved });
    const onLoaded = jest.fn();
    render(<UserProfileSettings onPreferencesLoaded={onLoaded} />);

    await waitFor(() => expect(nameInput()).toHaveValue('TechFlow'));
    expect(screen.getByDisplayValue('TikTok')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Professional')).toBeInTheDocument();
    expect(onLoaded).toHaveBeenCalledWith(saved);
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/user-123' });
  });

  test('keeps the defaults (YouTube / Engaging) when no profile exists', async () => {
    render(<UserProfileSettings />);
    await waitFor(() => expect(getDoc).toHaveBeenCalled());
    expect(screen.getByDisplayValue('YouTube')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Engaging')).toBeInTheDocument();
  });

  test('saves preferences to users/{uid} with merge and shows a success message', async () => {
    setDoc.mockResolvedValue();
    const onLoaded = jest.fn();
    render(<UserProfileSettings onPreferencesLoaded={onLoaded} />);
    fireEvent.change(nameInput(), { target: { value: 'My Channel' } });
    fireEvent.change(screen.getByDisplayValue('YouTube'), { target: { value: 'Instagram' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('Preferences saved successfully! ✓')).toBeInTheDocument();
    const [ref, data, options] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'users/user-123' });
    expect(data).toMatchObject({ channelName: 'My Channel', defaultPlatform: 'Instagram', defaultTone: 'Engaging' });
    expect(options).toEqual({ merge: true });
    expect(onLoaded).toHaveBeenLastCalledWith({ channelName: 'My Channel', defaultPlatform: 'Instagram', defaultTone: 'Engaging' });
  });

  test('shows an error message when Firestore fails to save', async () => {
    setDoc.mockRejectedValue(new Error('permission-denied'));
    render(<UserProfileSettings />);
    fireEvent.click(saveButton());
    expect(await screen.findByText(/Error saving settings to database/)).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  test('blocks saving and alerts when no user is logged in', () => {
    auth.currentUser = null;
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<UserProfileSettings />);
    fireEvent.click(saveButton());
    expect(window.alert).toHaveBeenCalledWith('You must be logged in to save settings.');
    expect(setDoc).not.toHaveBeenCalled();
    expect(getDoc).not.toHaveBeenCalled();
  });
});
