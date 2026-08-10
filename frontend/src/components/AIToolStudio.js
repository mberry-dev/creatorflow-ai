import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, getDocs, writeBatch, deleteDoc, getDoc } from 'firebase/firestore';
import AnalyticsDashboard from './AnalyticsDashboard';
import UserProfileSettings from './UserProfileSettings';

export default function AIToolStudio() {
  const [activeTab, setActiveTab] = useState('title');
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('YouTube');
  const [tone, setTone] = useState('Engaging');
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [titles, setTitles] = useState([]);
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [seoData, setSeoData] = useState({ keywords: [], recommendations: [] });

  const [hasGenerated, setHasGenerated] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // ==========================================================
  // CLOUD DATABASE HISTORY VAULT PIPELINE & PREFERENCES
  // ==========================================================
  const [savedAssets, setSavedAssets] = useState([]);

  // 🍞 Toast Notification Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const motivationQuotes = [
    { quote: "Your content is an asset. Build it intentionally.", author: "CreatorFlow AI" },
    { quote: "Consistency beats perfection. Hit publish.", author: "Algorithm Insight" },
    { quote: "The best SEO is value-driven storytelling.", author: "Growth Engine" },
    { quote: "Audience attention flows where clear execution lives.", author: "Retention Studio" }
  ];

  const activeQuote = motivationQuotes[0];

  // ⚡ Prompt Templates
  const templates = [
    { label: '📱 Tech Review', text: 'Top 5 hidden features in the newest smartphone update you need to turn off now' },
    { label: '🎮 Gaming Highlight', text: 'Insane 1v4 clutch play breakdown and strategies to rank up faster' },
    { label: '🎬 Daily Vlog Hook', text: 'I spent 24 hours living like a millionaire startup founder' },
    { label: '📚 Educational Guide', text: 'Beginner roadmap to learning full-stack web development in 3 months' }
  ];

  const handlePreferencesLoaded = useCallback((prefs) => {
    if (prefs.defaultPlatform) setPlatform(prefs.defaultPlatform);
    if (prefs.defaultTone) setTone(prefs.defaultTone);
    if (prefs.channelName) setCreatorName(prefs.channelName);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const prefs = userDocSnap.data();
            if (prefs.defaultPlatform) setPlatform(prefs.defaultPlatform);
            if (prefs.defaultTone) setTone(prefs.defaultTone);
            if (prefs.channelName) setCreatorName(prefs.channelName);
          }
        } catch (err) {
          console.error("Error fetching profile preferences:", err);
        }

        const q = query(
          collection(db, "saved_assets"),
          where("userId", "==", user.uid)
        );

        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const assetsArray = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          assetsArray.sort((a, b) => b.createdAt - a.createdAt);
          setSavedAssets(assetsArray);
        }, (err) => {
          console.error("Firestore snapshot error:", err);
        });

        return () => unsubscribeSnapshot();
      } else {
        setSavedAssets([]);
        setCreatorName('');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 📋 Copy Helper with Toast
  const triggerCopy = (text, customId, toastLabel = "Copied to clipboard!") => {
    navigator.clipboard.writeText(text);
    setCopiedId(customId);
    showToast(toastLabel);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 💾 Save Asset
  const handleSaveAsset = async (content, category) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showToast("⚠️ Please log in to save assets!");
      return;
    }

    try {
      await addDoc(collection(db, "saved_assets"), {
        userId: currentUser.uid,
        content: Array.isArray(content) ? content.join(', ') : content,
        category: category,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: Date.now()
      });
      showToast(`Saved to Vault! 💾`);
    } catch (err) {
      console.error("Firebase Storage Error:", err);
      showToast("❌ Failed to save asset.");
    }
  };

  // 🗑️ Delete Single Asset
  const handleDeleteAsset = async (assetId) => {
    try {
      const targetDoc = doc(db, "saved_assets", assetId);
      await deleteDoc(targetDoc);
      showToast("Asset removed 🗑️");
    } catch (err) {
      console.error("Failed to delete asset:", err);
      showToast("❌ Could not remove asset.");
    }
  };

  // 🗑️ Clear Entire Vault
  const handleClearVault = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (window.confirm("Permanently wipe all saved assets from your account?")) {
      try {
        const q = query(collection(db, "saved_assets"), where("userId", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((document) => {
          batch.delete(doc(db, "saved_assets", document.id));
        });
        
        await batch.commit();
        showToast("Vault wiped clean 🧹");
      } catch (err) {
        console.error("Failed to wipe vault documents:", err);
        showToast("❌ Error clearing vault.");
      }
    }
  };

  // 📤 Export Vault Assets (CSV / JSON)
  const handleExportVault = (format) => {
    if (savedAssets.length === 0) {
      showToast("⚠️ Nothing to export!");
      return;
    }

    let mimeType = 'text/plain';
    let fileExtension = 'txt';
    let fileData = '';

    if (format === 'json') {
      mimeType = 'application/json';
      fileExtension = 'json';
      const cleanData = savedAssets.map(({ id, userId, ...rest }) => rest);
      fileData = JSON.stringify(cleanData, null, 2);
    } else if (format === 'csv') {
      mimeType = 'text/csv';
      fileExtension = 'csv';
      const headers = ['Category', 'Content', 'Time'];
      const rows = savedAssets.map(a => [
        `"${a.category || ''}"`,
        `"${(a.content || '').replace(/"/g, '""')}"`,
        `"${a.timestamp || ''}"`
      ]);
      fileData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    const blob = new Blob([fileData], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `creatorflow_vault_export.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported as ${format.toUpperCase()}! 📥`);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError('');
    setHasGenerated(false);

    let endpoint = '/api/generate/title';
    let bodyPayload = { topic, platform, tone };

    if (activeTab === 'description') endpoint = '/api/generate/description';
    if (activeTab === 'hashtags') endpoint = '/api/generate/hashtags';
    if (activeTab === 'seo') {
      endpoint = '/api/generate/seo';
      bodyPayload = { topic };
    }

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await response.json();
      if (data.success) {
        setHasGenerated(true);
        if (activeTab === 'title') setTitles(data.suggestions || []);
        if (activeTab === 'description') setDescription(data.description || '');
        if (activeTab === 'hashtags') setHashtags(data.hashtags || []);
        if (activeTab === 'seo') setSeoData({ keywords: data.keywords || [], recommendations: data.recommendations || [] });
        showToast("Assets generated! ✨");
      } else {
        setError(data.error || 'Generation failed.');
      }
    } catch (err) {
      setError('Could not connect to the backend secure proxy server.');
    } finally {
      setLoading(false);
    }
  };

  const isOutputEmpty = () => {
    if (!hasGenerated) return false;
    if (activeTab === 'title' && titles.length === 0) return true;
    if (activeTab === 'description' && !description.trim()) return true;
    if (activeTab === 'hashtags' && hashtags.length === 0) return true;
    if (activeTab === 'seo' && seoData.keywords.length === 0 && seoData.recommendations.length === 0) return true;
    return false;
  };

  return (
    <div className="relative flex flex-col md:flex-row min-h-[80vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mt-4 shadow-xl">
      
      {/* 🍞 FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 animate-bounce flex items-center gap-2 border border-cyan-300">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 🧭 LEFT SIDEBAR */}
      <div className="w-full md:w-64 bg-slate-950 p-6 flex flex-col justify-between border-r border-slate-900">
        <div className="space-y-6">
          <div className="text-cyan-400 font-mono text-xs tracking-wider uppercase font-bold px-3">
            Core Workspaces
          </div>
          <div className="flex flex-col gap-1">
            {[
              { id: 'title', label: 'Generate Titles' },
              { id: 'description', label: 'Generate Descriptions' },
              { id: 'hashtags', label: 'Generate Hashtags' },
              { id: 'seo', label: 'SEO Suggestions' },
              { id: 'analytics', label: '📊 Analytics' },
              { id: 'settings', label: '⚙️ Settings' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setError(''); setHasGenerated(false); }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/10' 
                    : 'text-gray-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-6 border-t border-slate-900 text-xs text-gray-500 px-3 font-mono">
          Workspace Stable v1.3
        </div>
      </div>

      {/* 🖥️ MAIN CONSOLE */}
      <div className="flex-1 bg-slate-900 p-8 text-slate-100 overflow-y-auto">
        <div className="max-w-3xl">
          
          {activeTab === 'analytics' ? (
            <AnalyticsDashboard savedAssets={savedAssets} />
          ) : activeTab === 'settings' ? (
            <UserProfileSettings onPreferencesLoaded={handlePreferencesLoaded} />
          ) : (
            <>
              {/* HEADER */}
              <div className="mb-8 w-full space-y-6">
                <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950 to-slate-900 p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-black tracking-tight text-white">
                        Welcome back, {creatorName ? creatorName : 'Creator'}! 🚀
                      </h1>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        Workspace Session Active • Connected to Live Engine Pipeline
                      </p>
                    </div>
                    <div className="max-w-sm rounded-lg bg-slate-900/80 p-3 text-left md:text-right border border-slate-800">
                      <p className="italic text-xs font-medium text-cyan-400">
                        "{activeQuote.quote}"
                      </p>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block mt-1">
                        — {activeQuote.author}
                      </span>
                    </div>
                  </div>
                </div>

                {/* METRICS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block font-mono">Vault Status</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-cyan-400">{savedAssets.length}</span>
                      <span className="text-xs text-gray-400">saved items</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block font-mono">YouTube Engine</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                        ● Optimized V2
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block font-mono">TikTok Hook Engine</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center rounded-md bg-cyan-500/10 px-2.5 py-1 text-xs font-mono font-medium text-cyan-400 ring-1 ring-inset ring-cyan-500/20">
                        ● Retention Active
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block font-mono">IG Reels Algorithm</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-mono font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
                        ● Core Synced
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* FORM */}
              <h2 className="text-lg font-bold text-white capitalize mb-1">
                AI {activeTab === 'seo' ? 'SEO Optimizer' : `${activeTab} Generator`}
              </h2>
              <p className="text-xs text-gray-400 mb-4">Workspace Module fulfilling active asset generations.</p>

              {/* ✨ ONE-CLICK PROMPT TEMPLATES */}
              <div className="mb-4 space-y-2">
                <span className="text-[11px] font-bold font-mono text-gray-400 uppercase tracking-wider">⚡ One-Click Concept Templates</span>
                <div className="flex flex-wrap gap-2">
                  {templates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTopic(tpl.text)}
                      className="text-xs bg-slate-950 hover:bg-slate-800 text-gray-300 border border-slate-800 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition font-medium"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleGenerate} className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Video Topic Content Concept</label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Quick 15-minute dinner recipes for busy weeknights"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-medium placeholder-gray-600"
                  />
                </div>

                {activeTab !== 'seo' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Target Platform</label>
                      <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                        <option value="YouTube">YouTube</option>
                        <option value="TikTok">TikTok</option>
                        <option value="Instagram">Instagram Reels</option>
                      </select>
                    </div>
                    {activeTab === 'title' && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Tone</label>
                        <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                          <option value="Engaging">Engaging</option>
                          <option value="Professional">Professional</option>
                          <option value="Clickbait/Viral">Clickbait/Viral</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <button type="submit" disabled={loading} className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50">
                  {loading ? 'Running Execution Engine...' : `Generate Assets`}
                </button>
              </form>

              {error && <p className="text-red-400 text-xs font-mono mt-4">⚠️ {error}</p>}

              {isOutputEmpty() && (
                <div className="mt-8 bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 flex items-center gap-3">
                  <span className="text-amber-400 text-lg">⚠️</span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-400 font-mono">No structural content returned</h4>
                    <p className="text-xs text-gray-400 mt-0.5">The generation endpoint finished executing but returned fallback metrics. Try adjusting your concept topic.</p>
                  </div>
                </div>
              )}

              {/* OUTPUT DISPLAY */}
              <div className="mt-8 space-y-4">
                
                {/* TITLES */}
                {activeTab === 'title' && titles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">Generated Suggestions</h4>
                    {titles.map((t, idx) => {
                      const buildKey = `gen-title-${idx}`;
                      return (
                        <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex justify-between items-center text-sm font-medium text-gray-200 gap-4">
                          <span>{t}</span>
                          <div className="flex gap-2 shrink-0">
                            <button 
                              onClick={() => handleSaveAsset(t, 'Title')}
                              className="text-xs text-gray-400 hover:text-white font-bold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded transition"
                            >
                              Save Asset
                            </button>
                            <button 
                              onClick={() => triggerCopy(t, buildKey)} 
                              className={`text-xs font-bold px-3 py-1.5 rounded transition ${
                                copiedId === buildKey ? 'bg-emerald-500 text-slate-950' : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                              }`}
                            >
                              {copiedId === buildKey ? 'Copied! ✓' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* DESCRIPTIONS */}
                {activeTab === 'description' && description && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Generated Video Description</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveAsset(description, 'Description')} 
                          className="text-xs bg-slate-950 border border-slate-800 hover:text-cyan-400 font-bold px-3 py-1.5 rounded transition text-gray-400"
                        >
                          💾 Save to Vault
                        </button>
                        <button 
                          onClick={() => triggerCopy(description, 'gen-desc')} 
                          className={`text-xs font-bold px-3 py-1.5 rounded transition ${
                            copiedId === 'gen-desc' ? 'bg-emerald-500 text-slate-950' : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                          }`}
                        >
                          {copiedId === 'gen-desc' ? 'Copied Structure! ✓' : '📋 Copy Description'}
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-slate-900/40 p-4 rounded-lg border border-slate-900 font-mono text-xs">{description}</p>
                    </div>
                  </div>
                )}

                {/* HASHTAGS */}
                {activeTab === 'hashtags' && hashtags.length > 0 && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Algorithmic Hashtag Optimization</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveAsset(hashtags, 'Hashtags')} 
                          className="text-xs bg-slate-950 border border-slate-800 hover:text-cyan-400 font-bold px-3 py-1.5 rounded transition text-gray-400"
                        >
                          💾 Save String
                        </button>
                        <button 
                          onClick={() => triggerCopy(hashtags.join(' '), 'gen-hash')} 
                          className={`text-xs font-bold px-3 py-1.5 rounded transition ${
                            copiedId === 'gen-hash' ? 'bg-emerald-500 text-slate-950' : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                          }`}
                        >
                          {copiedId === 'gen-hash' ? 'Copied String! ✓' : '📋 Copy Tag String'}
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex flex-wrap gap-2.5 bg-slate-900/40 p-4 rounded-lg border border-slate-900">
                        {hashtags.map((tag, i) => (
                          <span key={i} className="bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-xs px-3 py-1.5 rounded-md hover:border-cyan-500/40 transition duration-150">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* SEO */}
                {activeTab === 'seo' && (seoData.keywords.length > 0 || seoData.recommendations.length > 0) && (
                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">High-Volume Search Targets</span>
                        <button 
                          onClick={() => handleSaveAsset(seoData.keywords, 'SEO Keywords')} 
                          className="text-xs font-bold text-gray-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded transition"
                        >
                          Save Targets
                        </button>
                      </div>
                      <div className="p-5 flex flex-wrap gap-2">
                        {seoData.keywords.map((w, i) => (
                          <span key={i} className="bg-slate-900 border border-slate-800 font-mono text-xs text-gray-300 px-3 py-1.5 rounded hover:text-cyan-400 cursor-pointer transition" onClick={() => triggerCopy(w, `seo-key-${i}`)}>
                            {copiedId === `seo-key-${i}` ? 'Copied! ✓' : w}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">Strategy Checklist</h4>
                      <ul className="space-y-2 text-sm text-gray-400">
                        {seoData.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 bg-slate-900/30 p-2.5 rounded border border-slate-950"><span className="text-cyan-400 font-bold">✓</span> {r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* 📥 CLOUD VAULT & EXPORT TOOLBAR */}
              <div className="mt-12 border-t border-slate-800 pt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Account Cloud Vault</h3>
                    <p className="text-xs text-gray-500">Persistent storage linked securely to your personal workspace account.</p>
                  </div>

                  {/* EXPORT + CLEAR TOOLBAR */}
                  {savedAssets.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExportVault('csv')}
                        className="text-xs font-mono font-bold text-gray-300 hover:text-cyan-400 bg-slate-950 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded transition"
                      >
                        📥 CSV
                      </button>
                      <button
                        onClick={() => handleExportVault('json')}
                        className="text-xs font-mono font-bold text-gray-300 hover:text-cyan-400 bg-slate-950 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded transition"
                      >
                        📥 JSON
                      </button>
                      <button 
                        onClick={handleClearVault}
                        className="text-xs font-mono font-bold text-red-500 hover:text-red-400 bg-red-500/5 border border-red-500/10 px-2.5 py-1.5 rounded transition"
                      >
                        Wipe Vault
                      </button>
                    </div>
                  )}
                </div>

                {savedAssets.length === 0 ? (
                  <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center bg-slate-950/20">
                    <span className="text-2xl block mb-2">📁</span>
                    <h4 className="text-sm font-semibold text-gray-300">Your cloud vault is currently empty</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
                      Generate core content metrics using the workspaces above and click <span className="text-cyan-400 font-semibold font-mono">"Save Asset"</span> to catalog data blocks securely.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedAssets.map((asset) => {
                      const vaultItemKey = `vault-item-${asset.id}`;
                      return (
                        <div key={asset.id} className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:border-slate-700 transition duration-150">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 uppercase tracking-wider">
                                {asset.category}
                              </span>
                              <span className="text-[10px] font-mono text-gray-600">{asset.timestamp}</span>
                            </div>
                            <p className="text-gray-300 font-medium line-clamp-2 pr-4">{asset.content}</p>
                          </div>
                          
                          <div className="flex items-center gap-4 shrink-0 justify-end">
                            <button 
                              onClick={() => triggerCopy(asset.content, vaultItemKey, "Vault item copied!")}
                              className={`text-xs font-bold font-mono transition ${
                                copiedId === vaultItemKey ? 'text-emerald-400 scale-105' : 'text-cyan-400 hover:underline'
                              }`}
                            >
                              {copiedId === vaultItemKey ? 'Copied! ✓' : 'Copy Value'}
                            </button>
                            
                            <button 
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="text-xs font-mono font-black text-gray-600 hover:text-red-400 transition px-2 py-1 rounded hover:bg-red-500/5"
                              title="Delete permanently"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}