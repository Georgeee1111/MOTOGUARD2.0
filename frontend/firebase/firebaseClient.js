import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyD-XL6-SurZpNYNcY71MNJH-5HmdBw6FIc",
  authDomain: "motoguard-84bdb.firebaseapp.com",
  databaseURL: "https://motoguard-84bdb-default-rtdb.firebaseio.com",
  projectId: "motoguard-84bdb",
  storageBucket: "motoguard-84bdb.firebasestorage.app",
  messagingSenderId: "938310704371",
  appId: "1:938310704371:web:02b4a12209d0a7b59beb86",
  measurementId: "G-0Q853Y4P3R",
};

// Initialize Firebase app only once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage persistence for React Native
const firebaseAuth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Initialize Firestore
const db = getFirestore(app);

export { firebaseAuth, db };
