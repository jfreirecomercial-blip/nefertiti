import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration from environment variables.
// These MUST be set via apphosting.yaml (for App Hosting) or .env.local (for local dev).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
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
