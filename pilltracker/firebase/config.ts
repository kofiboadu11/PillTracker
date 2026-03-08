import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCMOOqXTCF0HJf4msL2J-H6FnzyprXHrkk",
  authDomain: "pilltracker-3775f.firebaseapp.com",
  projectId: "pilltracker-3775f",
  storageBucket: "pilltracker-3775f.firebasestorage.app",
  messagingSenderId: "795734982646",
  appId: "1:795734982646:web:d5a47e057f4990a1cb91d7",
  measurementId: "G-09BDE8KHRN"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);