import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import axios from 'axios';
import Login from './Login';
import Register from './Register';
import ProtectedRoute from './ProtectedRoute';
import AIToolStudio from './components/AIToolStudio';

const LandingPage = ({ status, message, user }) => (
  <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
    <h2 className="text-4xl font-extrabold text-white mb-4 sm:text-5xl">
      Optimize Your Content with <span className="text-cyan-400">AI Power</span>
    </h2>
    <p className="text-gray-400 max-w-xl text-lg mb-8">
      Purpose-built for digital creators operating across YouTube, TikTok, and Instagram. Automate titles, descriptions, hashtags, and SEO tracking.
    </p>
    <div className="flex space-x-4">
      {user ? (
        <Link to="/dashboard" className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold px-6 py-3 rounded-lg transition duration-200">
          Go to Workspace
        </Link>
      ) : (
        <>
          <Link to="/register" className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold px-6 py-3 rounded-lg transition duration-200">
            Get Started
          </Link>
          <Link to="/login" className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-3 rounded-lg border border-slate-700 transition duration-200">
            Sign In
          </Link>
        </>
      )}
    </div>

    <div className="mt-12 p-5 bg-slate-900 rounded-xl border border-slate-800 text-left max-w-md w-full">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">📡 System Architecture Check</h4>
      <p className="text-sm text-gray-300"><strong>CORS Status:</strong> <span className={status === "Online" ? "text-green-400" : "text-red-400"}>{status}</span></p>
      <p className="text-xs text-gray-500 mt-1"><strong>Backend Msg:</strong> {message}</p>
    </div>
  </div>
);

function App() {
  const [backendMessage, setBackendMessage] = useState("Connecting via Axios...");
  const [serverStatus, setServerStatus] = useState("Offline");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 1. Monitor Backend Status
  useEffect(() => {
    axios.get('http://localhost:5000/api/status')
      .then((response) => {
        setBackendMessage(response.data.message);
        setServerStatus(response.data.status);
      })
      .catch((error) => {
        console.error("Network Error:", error);
        setBackendMessage("Failed to reach backend via CORS.");
        setServerStatus("Offline");
      });
  }, []);

  // 2. Track Live Authentication State Change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert("Signed out successfully!");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-mono">
        Loading CreatorFlow Shell...
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-900">
        
        {/* Dynamic Navigation Bar Layout */}
        <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">CreatorFlow AI</span>
          </Link>
          <div className="flex items-center space-x-6 text-sm font-medium text-gray-400">
            <Link to="/" className="hover:text-white transition">Home</Link>
            {user && <Link to="/dashboard" className="hover:text-white transition">Dashboard</Link>}
            
            {user ? (
              <>
                <span className="text-xs text-slate-500 font-mono hidden sm:inline">{user.email}</span>
                <button 
                  onClick={handleLogout}
                  className="bg-slate-900 text-red-400 border border-red-500/20 px-4 py-2 rounded-md hover:bg-red-500/10 transition"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-white transition">Sign In</Link>
                <Link to="/register" className="bg-slate-900 text-cyan-400 border border-cyan-500/20 px-4 py-2 rounded-md hover:bg-cyan-500/10 transition">Register</Link>
              </>
            )}
          </div>
        </nav>

        {/* Core Screen Routing Tables */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<LandingPage status={serverStatus} message={backendMessage} user={user} />} />
            <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
            
            <Route 
              path="/dashboard" 
              element = {
                <ProtectedRoute user={user}>
                  {/* ✨ Fixed text contrast issue & passed user context to the studio workspace */}
                  <div className="text-slate-100 w-full">
                    <AIToolStudio user={user} />
                  </div>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;