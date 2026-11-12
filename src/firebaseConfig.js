import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Loaded separately: ad blockers block files named "analytics", and a blocked
// static import would stop the whole app from starting.
import("firebase/analytics")
  .then(({ getAnalytics, isSupported }) => isSupported().then((ok) => ok && getAnalytics(app)))
  .catch(() => {});

// Set VITE_ALLOW_SIGNUP=false to hide sign-up. Also turn off sign-up in Firebase Authentication,
// because hiding the page does not stop someone calling the Auth API directly.
export const SIGNUP_ENABLED = import.meta.env.VITE_ALLOW_SIGNUP !== "false";
