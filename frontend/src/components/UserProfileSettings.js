import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function UserProfileSettings({ onPreferencesLoaded }) {
  const [channelName, setChannelName] = useState('');
  const [defaultPlatform, setDefaultPlatform] = useState('YouTube');
  const [defaultTone, setDefaultTone] = useState('Engaging');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // 🔄 Fetch profile settings from Firestore on mount
  useEffect(() => {
    const fetchUserSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.channelName) setChannelName(data.channelName);
          if (data.defaultPlatform) setDefaultPlatform(data.defaultPlatform);
          if (data.defaultTone) setDefaultTone(data.defaultTone);

          // Pass loaded preferences up to parent if needed
          if (onPreferencesLoaded) {
            onPreferencesLoaded(data);
          }
        }
      } catch (err) {
        console.error('Error fetching user preferences:', err);
      }
    };

    fetchUserSettings();
  }, [onPreferencesLoaded]);

  // 💾 Save preferences to Firestore `users/{userId}` document
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      alert('You must be logged in to save settings.');
      return;
    }

    setSaving(true);
    setStatusMsg('');

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        channelName,
        defaultPlatform,
        defaultTone,
        updatedAt: Date.now()
      }, { merge: true });

      setStatusMsg('Preferences saved successfully! ✓');
      setTimeout(() => setStatusMsg(''), 3000);

      if (onPreferencesLoaded) {
        onPreferencesLoaded({ channelName, defaultPlatform, defaultTone });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setStatusMsg('⚠️ Error saving settings to database.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-sm">
        <h2 className="text-xl font-black text-white">Creator Settings & Preferences ⚙️</h2>
        <p className="text-xs text-gray-400 mt-1 font-mono">
          Customize your default generator behavior and brand identity.
        </p>
      </div>

      {/* FORM CARD */}
      <form onSubmit={handleSavePreferences} className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Channel / Brand Name
          </label>
          <input
            type="text"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="e.g., TechFlow Studio"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-medium placeholder-gray-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Default Target Platform
            </label>
            <select
              value={defaultPlatform}
              onChange={(e) => setDefaultPlatform(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="YouTube">YouTube</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram Reels</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Default Content Tone
            </label>
            <select
              value={defaultTone}
              onChange={(e) => setDefaultTone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="Engaging">Engaging</option>
              <option value="Professional">Professional</option>
              <option value="Clickbait/Viral">Clickbait/Viral</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
          >
            {saving ? 'Saving Preferences...' : 'Save Preferences'}
          </button>

          {statusMsg && (
            <span className="text-xs font-mono font-bold text-emerald-400">
              {statusMsg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}