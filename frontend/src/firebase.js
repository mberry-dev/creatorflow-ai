import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// 1. Import the Firestore database SDK engine
import { getFirestore } from "firebase/firestore";

// Automatically inject parameters from our local frontend/.env file
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Fire up the Firebase Cloud application network link
const app = initializeApp(firebaseConfig);

// Export Auth instance for US-01 (Register) and US-02 (Login) forms
export const auth = getAuth(app);

// 2. Initialize and export the Firestore instance for our Studio Vault
export const db = getFirestore(app);

export default app;