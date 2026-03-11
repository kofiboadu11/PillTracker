import { db, auth } from './config';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc
} from 'firebase/firestore';

// Get the current user's ID
const getUID = () => auth.currentUser?.uid;

// ─── MEDICATIONS ────────────────────────────────────────────

// Add a new medication
export const addMedication = async (medicationData) => {
  const uid = getUID();
  const ref = collection(db, 'users', uid, 'medications');
  const docRef = await addDoc(ref, medicationData);
  return docRef.id;
};

// Get all medications for the current user
export const getMedications = async () => {
  const uid = getUID();
  const ref = collection(db, 'users', uid, 'medications');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Update an existing medication
export const updateMedication = async (medId, updatedData) => {
  const uid = getUID();
  const ref = doc(db, 'users', uid, 'medications', medId);
  await updateDoc(ref, updatedData);
};

// Delete a medication
export const deleteMedication = async (medId) => {
  const uid = getUID();
  await deleteDoc(doc(db, 'users', uid, 'medications', medId));
};

// ─── ADHERENCE ──────────────────────────────────────────────

// Mark a medication as taken for today
export const markAsTaken = async (medId) => {
  const uid = getUID();
  const today = new Date().toISOString().split('T')[0]; // e.g. "2026-02-27"
  const ref = doc(db, 'users', uid, 'adherence', today);
  await setDoc(ref, { [medId]: true }, { merge: true });
};

// Get adherence data for a specific date
export const getAdherenceForDate = async (date) => {
  const uid = getUID();
  const ref = doc(db, 'users', uid, 'adherence', date);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? snapshot.data() : {};
};

// Get adherence for the past 7 days (for the dashboard chart)
export const getWeeklyAdherence = async () => {
  const uid = getUID();
  const results = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const data = await getAdherenceForDate(dateStr);
    results.push({ date: dateStr, data });
  }

  return results;
};


export const toggleMedication = async (medId, value) => {
  const uid = getUID();
  const today = new Date().toISOString().split('T')[0];
  const ref = doc(db, 'users', uid, 'adherence', today);
  await setDoc(ref, { [medId]: value }, { merge: true });
};