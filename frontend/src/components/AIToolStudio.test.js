import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { auth } from '../firebase';
import AIToolStudio from './AIToolStudio';

jest.mock('../firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: jest.fn() },
  db: { name: 'mock-db' },
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(),
}));

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const USER = { uid: 'user-123', email: 'creator@example.com' };
let snapshotDocs; // what Firestore "returns" for the user's saved_assets
let profileData;  // what Firestore "returns" for users/{uid}

function loginAs(user) {
  auth.currentUser = user;
  auth.onAuthStateChanged.mockImplementation((cb) => {
    cb(user);
    return jest.fn();
  });
}

function mockFetchOnce(body) {
  global.fetch.mockResolvedValueOnce({ json: () => Promise.resolve(body) });
}

const topicInput = () => screen.getByPlaceholderText(/Quick 15-minute dinner recipes/i);
const typeTopic = (text) => fireEvent.change(topicInput(), { target: { value: text } });
const clickGenerate = () => fireEvent.click(screen.getByRole('button', { name: 'Generate Assets' }));
const openTab = (name) => fireEvent.click(screen.getByRole('button', { name }));
const lastFetchBody = () => JSON.parse(global.fetch.mock.calls.at(-1)[1].body);

beforeEach(() => {
  snapshotDocs = [];
  profileData = null;
  global.fetch = jest.fn();
  Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
  jest.spyOn(console, 'error').mockImplementation(() => {});

  // react-scripts resets mocks before every test, so implementations are set here.
  collection.mockImplementation((_db, name) => ({ collection: name }));
  query.mockImplementation((...args) => ({ query: args }));
  where.mockImplementation((...args) => ({ where: args }));
  doc.mockImplementation((_db, col, id) => ({ path: `${col}/${id}` }));
  getDoc.mockImplementation(() =>
    Promise.resolve({ exists: () => profileData !== null, data: () => profileData })
  );
  onSnapshot.mockImplementation((_q, onNext) => {
    onNext({ docs: snapshotDocs.map((d) => ({ id: d.id, data: () => d })) });
    return jest.fn();
  });
  loginAs(USER);
});

describe('AIToolStudio — layout and inputs', () => {
  test('opens on the Title Generator with a default greeting', async () => {
    render(<AIToolStudio />);
    expect(screen.getByText('AI title Generator')).toBeInTheDocument();
    expect(await screen.findByText(/Welcome back, Creator!/)).toBeInTheDocument();
  });

  test('greets the creator by the channel name saved in their Firestore profile', async () => {
    profileData = { channelName: 'TechFlow Studio' };
    render(<AIToolStudio />);
    expect(await screen.findByText(/Welcome back, TechFlow Studio!/)).toBeInTheDocument();
  });

  test('applies the default platform and tone saved in the user profile', async () => {
    profileData = { defaultPlatform: 'TikTok', defaultTone: 'Professional' };
    render(<AIToolStudio />);
    await waitFor(() => expect(screen.getByDisplayValue('TikTok')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Professional')).toBeInTheDocument();
  });

  test('a one-click template fills in the topic field', () => {
    render(<AIToolStudio />);
    fireEvent.click(screen.getByRole('button', { name: /Gaming Highlight/ }));
    expect(topicInput()).toHaveValue('Insane 1v4 clutch play breakdown and strategies to rank up faster');
  });

  test('shows the Tone selector only on the Title tab and hides Platform on the SEO tab', () => {
    render(<AIToolStudio />);
    expect(screen.getByText('Tone')).toBeInTheDocument();
    openTab('Generate Descriptions');
    expect(screen.queryByText('Tone')).not.toBeInTheDocument();
    expect(screen.getByText('Target Platform')).toBeInTheDocument();
    openTab('SEO Suggestions');
    expect(screen.queryByText('Target Platform')).not.toBeInTheDocument();
  });

  test('does not call the API when the topic is only whitespace', () => {
    render(<AIToolStudio />);
    typeTopic('   ');
    fireEvent.submit(topicInput().closest('form'));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('AIToolStudio — AI generation (US-03 to US-06)', () => {
  test('Title Generator posts topic, platform and tone and renders each title', async () => {
    mockFetchOnce({ success: true, suggestions: ['Title One', 'Title Two', 'Title Three'] });
    render(<AIToolStudio />);
    typeTopic('how to start a podcast');
    fireEvent.change(screen.getByDisplayValue('YouTube'), { target: { value: 'TikTok' } });
    fireEvent.change(screen.getByDisplayValue('Engaging'), { target: { value: 'Clickbait/Viral' } });
    clickGenerate();

    expect(await screen.findByText('Title Two')).toBeInTheDocument();
    expect(global.fetch.mock.calls[0][0]).toBe(`${API_URL}/api/generate/title`);
    expect(lastFetchBody()).toEqual({ topic: 'how to start a podcast', platform: 'TikTok', tone: 'Clickbait/Viral' });
    expect(screen.getAllByRole('button', { name: 'Save Asset' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
  });

  test('Description Generator posts to /description and renders the description', async () => {
    mockFetchOnce({ success: true, description: 'Your morning routine, optimized.' });
    render(<AIToolStudio />);
    openTab('Generate Descriptions');
    typeTopic('morning workout routine');
    clickGenerate();
    expect(await screen.findByText('Your morning routine, optimized.')).toBeInTheDocument();
    expect(global.fetch.mock.calls[0][0]).toBe(`${API_URL}/api/generate/description`);
  });

  test('Hashtag Generator renders every returned hashtag', async () => {
    mockFetchOnce({ success: true, hashtags: ['#travel', '#tokyo', '#vlog'] });
    render(<AIToolStudio />);
    openTab('Generate Hashtags');
    typeTopic('travel vlog Tokyo');
    clickGenerate();
    expect(await screen.findByText('#tokyo')).toBeInTheDocument();
    expect(screen.getByText('#travel')).toBeInTheDocument();
    expect(screen.getByText('#vlog')).toBeInTheDocument();
    expect(global.fetch.mock.calls[0][0]).toBe(`${API_URL}/api/generate/hashtags`);
  });

  test('SEO Optimizer sends only the topic and renders keywords and recommendations', async () => {
    mockFetchOnce({ success: true, keywords: ['guitar basics'], recommendations: ['Use the keyword early.'] });
    render(<AIToolStudio />);
    openTab('SEO Suggestions');
    typeTopic('beginner guitar lessons');
    clickGenerate();
    expect(await screen.findByText('guitar basics')).toBeInTheDocument();
    expect(screen.getByText('Use the keyword early.')).toBeInTheDocument();
    expect(global.fetch.mock.calls[0][0]).toBe(`${API_URL}/api/generate/seo`);
    expect(lastFetchBody()).toEqual({ topic: 'beginner guitar lessons' });
  });

  test('shows a loading label and disables Generate while waiting for the API', async () => {
    let respond;
    global.fetch.mockImplementationOnce(() => new Promise((r) => { respond = r; }));
    render(<AIToolStudio />);
    typeTopic('anything');
    clickGenerate();
    expect(screen.getByRole('button', { name: 'Running Execution Engine...' })).toBeDisabled();
    await act(async () => respond({ json: () => Promise.resolve({ success: true, suggestions: ['Done'] }) }));
    expect(await screen.findByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Assets' })).toBeEnabled();
  });

  test('shows the server error message when the API returns success: false', async () => {
    mockFetchOnce({ success: false, error: 'Topic is required' });
    render(<AIToolStudio />);
    typeTopic('x');
    clickGenerate();
    expect(await screen.findByText(/Topic is required/)).toBeInTheDocument();
  });

  test('shows a connection error when the backend cannot be reached', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<AIToolStudio />);
    typeTopic('x');
    clickGenerate();
    expect(await screen.findByText(/Could not connect to the backend secure proxy server/)).toBeInTheDocument();
  });

  test('shows an empty-result warning when the API returns no titles', async () => {
    mockFetchOnce({ success: true, suggestions: [] });
    render(<AIToolStudio />);
    typeTopic('x');
    clickGenerate();
    expect(await screen.findByText('No structural content returned')).toBeInTheDocument();
  });
});

describe('AIToolStudio — copy and save (US-07)', () => {
  test('Copy writes the title to the clipboard and shows confirmation', async () => {
    mockFetchOnce({ success: true, suggestions: ['Copy Me'] });
    render(<AIToolStudio />);
    typeTopic('x');
    clickGenerate();
    await screen.findByText('Copy Me');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy Me');
    expect(screen.getByRole('button', { name: 'Copied! ✓' })).toBeInTheDocument();
  });

  test('Save Asset writes the title to the user’s saved_assets in Firestore', async () => {
    addDoc.mockResolvedValue({ id: 'new-doc' });
    mockFetchOnce({ success: true, suggestions: ['Save Me'] });
    render(<AIToolStudio />);
    typeTopic('x');
    clickGenerate();
    await screen.findByText('Save Me');
    fireEvent.click(screen.getByRole('button', { name: 'Save Asset' }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    const [collectionRef, data] = addDoc.mock.calls[0];
    expect(collectionRef).toEqual({ collection: 'saved_assets' });
    expect(data).toMatchObject({ userId: 'user-123', content: 'Save Me', category: 'Title' });
    expect(typeof data.createdAt).toBe('number');
    expect(await screen.findByText(/Saved to Vault/)).toBeInTheDocument();
  });

  test('saving hashtags stores them as one comma-separated string', async () => {
    addDoc.mockResolvedValue({ id: 'new-doc' });
    mockFetchOnce({ success: true, hashtags: ['#a', '#b'] });
    render(<AIToolStudio />);
    openTab('Generate Hashtags');
    typeTopic('x');
    clickGenerate();
    await screen.findByText('#a');
    fireEvent.click(screen.getByRole('button', { name: /Save String/ }));
    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    expect(addDoc.mock.calls[0][1]).toMatchObject({ content: '#a, #b', category: 'Hashtags' });
  });

  test('shows a login warning and does not save when no user is signed in', async () => {
    mockFetchOnce({ success: true, suggestions: ['Nope'] });
    render(<AIToolStudio />);
    typeTopic('x');
    clickGenerate();
    await screen.findByText('Nope');
    auth.currentUser = null;
    fireEvent.click(screen.getByRole('button', { name: 'Save Asset' }));
    expect(await screen.findByText(/Please log in to save assets/)).toBeInTheDocument();
    expect(addDoc).not.toHaveBeenCalled();
  });

  test('shows a failure toast when Firestore rejects the save', async () => {
    addDoc.mockRejectedValue(new Error('permission-denied'));
    mockFetchOnce({ success: true, suggestions: ['Fail Me'] });
    render(<AIToolStudio />);
    typeTopic('x');
    clickGenerate();
    await screen.findByText('Fail Me');
    fireEvent.click(screen.getByRole('button', { name: 'Save Asset' }));
    expect(await screen.findByText(/Failed to save asset/)).toBeInTheDocument();
  });
});

describe('AIToolStudio — Cloud Vault', () => {
  const assets = [
    { id: 'a1', userId: 'user-123', category: 'Title', content: 'Older title', timestamp: '10:00', createdAt: 1000 },
    { id: 'a2', userId: 'user-123', category: 'Description', content: 'Newer "quoted" description', timestamp: '11:00', createdAt: 2000 },
  ];

  test('shows the empty-vault message when the user has nothing saved', () => {
    render(<AIToolStudio />);
    expect(screen.getByText('Your cloud vault is currently empty')).toBeInTheDocument();
  });

  test('only queries saved assets that belong to the signed-in user', async () => {
    render(<AIToolStudio />);
    await waitFor(() => expect(where).toHaveBeenCalledWith('userId', '==', 'user-123'));
  });

  test('lists saved assets newest first with category and timestamp', async () => {
    snapshotDocs = assets;
    render(<AIToolStudio />);
    const items = await screen.findAllByText(/(Older title|Newer "quoted" description)/);
    expect(items[0]).toHaveTextContent('Newer "quoted" description');
    expect(items[1]).toHaveTextContent('Older title');
    expect(screen.getByText('11:00')).toBeInTheDocument();
  });

  test('the ✕ button deletes that asset from Firestore', async () => {
    deleteDoc.mockResolvedValue();
    snapshotDocs = [assets[0]];
    render(<AIToolStudio />);
    fireEvent.click(await screen.findByTitle('Delete permanently'));
    await waitFor(() => expect(deleteDoc).toHaveBeenCalledWith({ path: 'saved_assets/a1' }));
  });

  test('Wipe Vault deletes every saved asset in one batch after confirmation', async () => {
    const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue() };
    writeBatch.mockReturnValue(batch);
    getDocs.mockResolvedValue({ docs: assets.map((a) => ({ id: a.id })) });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    snapshotDocs = assets;
    render(<AIToolStudio />);
    fireEvent.click(await screen.findByRole('button', { name: 'Wipe Vault' }));
    await waitFor(() => expect(batch.commit).toHaveBeenCalledTimes(1));
    expect(batch.delete).toHaveBeenCalledTimes(2);
  });

  test('Wipe Vault does nothing if the user cancels the confirmation', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    snapshotDocs = assets;
    render(<AIToolStudio />);
    fireEvent.click(await screen.findByRole('button', { name: 'Wipe Vault' }));
    expect(getDocs).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
  });

  describe('export', () => {
    let exported;
    const RealBlob = global.Blob;

    beforeEach(() => {
      exported = null;
      global.Blob = function (parts, opts) { exported = { text: parts.join(''), type: opts.type }; };
      URL.createObjectURL = jest.fn(() => 'blob:mock');
      URL.revokeObjectURL = jest.fn();
      jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });
    afterEach(() => { global.Blob = RealBlob; });

    test('exports JSON without internal id/userId fields', async () => {
      snapshotDocs = assets;
      render(<AIToolStudio />);
      fireEvent.click(await screen.findByRole('button', { name: /JSON/ }));
      expect(exported.type).toBe('application/json');
      const rows = JSON.parse(exported.text);
      expect(rows).toHaveLength(2);
      expect(rows[0]).not.toHaveProperty('id');
      expect(rows[0]).not.toHaveProperty('userId');
      expect(await screen.findByText(/Exported as JSON/)).toBeInTheDocument();
    });

    test('exports CSV with a header row and correctly escaped quotes', async () => {
      snapshotDocs = assets;
      render(<AIToolStudio />);
      fireEvent.click(await screen.findByRole('button', { name: /CSV/ }));
      expect(exported.type).toBe('text/csv');
      const lines = exported.text.split('\n');
      expect(lines[0]).toBe('Category,Content,Time');
      expect(lines[1]).toBe('"Description","Newer ""quoted"" description","11:00"');
    });
  });
});

describe('AIToolStudio — other workspaces', () => {
  test('the Analytics tab shows the analytics dashboard', async () => {
    render(<AIToolStudio />);
    openTab('📊 Analytics');
    expect(await screen.findByText(/Content Creation Analytics/)).toBeInTheDocument();
  });

  test('the Settings tab shows the preferences form', async () => {
    render(<AIToolStudio />);
    openTab('⚙️ Settings');
    expect(await screen.findByText(/Creator Settings & Preferences/)).toBeInTheDocument();
  });
});
