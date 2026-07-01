import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration from environment variables.
// These MUST be set via apphosting.yaml (for App Hosting) or .env.local (for local dev).
// Using actual project values as hardcoded defaults ensures both local dev and deployed builds work.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBsW6_n5LRpTLNgp5Lcb_i58vweFCxX0l8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "kupom-311fe.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kupom-311fe",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kupom-311fe.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "456943016878",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:456943016878:web:1efc812d5d855c52bbc63f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-2D1MV86WD0",
};

// Runtime validation: warn if critical config is missing
if (typeof window !== "undefined") {
  const missingVars = Object.entries(firebaseConfig)
    .filter(([key, val]) => !val && key !== "measurementId")
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error(
      `[Nefertiti] Firebase config missing: ${missingVars.join(", ")}. ` +
      "Check your .env.local or apphosting.yaml."
    );
  } else {
    console.log("[Nefertiti] Firebase config OK:", {
      apiKey: `${firebaseConfig.apiKey.substring(0, 12)}...`,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    });
  }
}

// Initialize Firebase safely for SSR (avoids dual initialization in server vs client)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
