// These jest.mock() calls are hoisted by babel-jest to the top of the file,
// before any require() runs, preventing Jest from loading the real ESM modules.

jest.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'test-uid' } },
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection-ref'),
  addDoc:     jest.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
  getDocs:    jest.fn(() =>
    Promise.resolve({
      docs: [
        { id: 'med1', data: () => ({ name: 'Aspirin',   dosage: '100mg', times: ['8:00 AM'] }) },
        { id: 'med2', data: () => ({ name: 'Metformin', dosage: '500mg', times: ['8:00 AM', '8:00 PM'] }) },
      ],
    })
  ),
  doc:       jest.fn(() => 'mock-doc-ref'),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  setDoc:    jest.fn(() => Promise.resolve()),
  getDoc:    jest.fn(() =>
    Promise.resolve({
      exists: () => true,
      data:   () => ({ med1: true, med2: false }),
      id:     'mock-doc-id',
    })
  ),
}));

const { addDoc, getDocs, updateDoc, deleteDoc, setDoc, getDoc } =
  require('firebase/firestore');

const {
  addMedication,
  getMedications,
  updateMedication,
  deleteMedication,
  markAsTaken,
  getAdherenceForDate,
  toggleMedication,
  initializeTodayAdherence,
  decrementPillsRemaining,
  getRefillStatus,
} = require('../../firebase/medications');

beforeEach(() => jest.clearAllMocks());

// ─── addMedication ────────────────────────────────────────────────────────────

describe('addMedication', () => {
  it('calls addDoc and returns the new document ID', async () => {
    addDoc.mockResolvedValueOnce({ id: 'new-med-id' });
    const id = await addMedication({ name: 'Aspirin', dosage: '100mg' });
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(id).toBe('new-med-id');
  });

  it('passes medication data to addDoc', async () => {
    addDoc.mockResolvedValueOnce({ id: 'xyz' });
    const medData = { name: 'Metformin', dosage: '500mg', times: ['8:00 AM'] };
    await addMedication(medData);
    expect(addDoc).toHaveBeenCalledWith(expect.anything(), medData);
  });
});

// ─── getMedications ───────────────────────────────────────────────────────────

describe('getMedications', () => {
  it('returns a list of medications with their IDs', async () => {
    const meds = await getMedications();
    expect(meds).toHaveLength(2);
    expect(meds[0]).toMatchObject({ id: 'med1', name: 'Aspirin', dosage: '100mg' });
    expect(meds[1]).toMatchObject({ id: 'med2', name: 'Metformin', dosage: '500mg' });
  });

  it('calls getDocs once', async () => {
    await getMedications();
    expect(getDocs).toHaveBeenCalledTimes(1);
  });
});

// ─── updateMedication ─────────────────────────────────────────────────────────

describe('updateMedication', () => {
  it('calls updateDoc with the medication ref and updated data', async () => {
    const updatedData = { dosage: '200mg' };
    await updateMedication('med1', updatedData);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), updatedData);
  });
});

// ─── deleteMedication ─────────────────────────────────────────────────────────

describe('deleteMedication', () => {
  it('calls deleteDoc once', async () => {
    await deleteMedication('med1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});

// ─── markAsTaken ──────────────────────────────────────────────────────────────

describe('markAsTaken', () => {
  it('calls setDoc with { [medId]: true } and merge option', async () => {
    await markAsTaken('med1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med1: true },
      { merge: true }
    );
  });
});

// ─── getAdherenceForDate ──────────────────────────────────────────────────────

describe('getAdherenceForDate', () => {
  it('returns data when the document exists', async () => {
    const data = await getAdherenceForDate('2026-04-14');
    expect(data).toEqual({ med1: true, med2: false });
  });

  it('returns empty object when the document does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false, data: () => null });
    const data = await getAdherenceForDate('2026-01-01');
    expect(data).toEqual({});
  });
});

// ─── toggleMedication ────────────────────────────────────────────────────────

describe('toggleMedication', () => {
  it('sets the medication value with merge', async () => {
    await toggleMedication('med1', false);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med1: false },
      { merge: true }
    );
  });

  it('can mark a medication as taken (true)', async () => {
    await toggleMedication('med2', true);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med2: true },
      { merge: true }
    );
  });
});

// ─── initializeTodayAdherence ─────────────────────────────────────────────────

describe('initializeTodayAdherence', () => {
  it('writes false for meds not yet recorded today', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data:   () => ({ med1: true }),
    });
    await initializeTodayAdherence(['med1', 'med2', 'med3']);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med2: false, med3: false },
      { merge: true }
    );
  });

  it('does not call setDoc when all meds are already recorded', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data:   () => ({ med1: true, med2: false }),
    });
    await initializeTodayAdherence(['med1', 'med2']);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('initializes all meds when no record exists yet', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false, data: () => ({}) });
    await initializeTodayAdherence(['med1', 'med2']);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med1: false, med2: false },
      { merge: true }
    );
  });
});

// ─── decrementPillsRemaining ──────────────────────────────────────────────────

describe('decrementPillsRemaining', () => {
  it('decrements pillsRemaining by pillsPerDose', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        refillTracking: { enabled: true, pillsRemaining: 30, pillsPerDose: 2, totalQuantity: 60 },
      }),
    });
    const next = await decrementPillsRemaining('med1');
    expect(next).toBe(28);
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { 'refillTracking.pillsRemaining': 28 }
    );
  });

  it('does not go below 0', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        refillTracking: { enabled: true, pillsRemaining: 1, pillsPerDose: 2, totalQuantity: 60 },
      }),
    });
    const next = await decrementPillsRemaining('med1');
    expect(next).toBe(0);
  });

  it('does nothing when refill tracking is disabled', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ refillTracking: { enabled: false } }),
    });
    await decrementPillsRemaining('med1');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('does nothing when the document does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    await decrementPillsRemaining('med-ghost');
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

// ─── getRefillStatus ──────────────────────────────────────────────────────────

describe('getRefillStatus', () => {
  it('returns null when refill tracking is disabled', () => {
    expect(getRefillStatus({ refillTracking: { enabled: false } })).toBeNull();
  });

  it('returns null when med has no refillTracking', () => {
    expect(getRefillStatus({})).toBeNull();
    expect(getRefillStatus(null)).toBeNull();
  });

  it('calculates daysRemaining correctly for a once-daily med', () => {
    const med = {
      times: ['8:00 AM'],
      refillTracking: { enabled: true, pillsRemaining: 30, pillsPerDose: 1, totalQuantity: 30 },
    };
    const status = getRefillStatus(med);
    expect(status.daysRemaining).toBe(30);
    expect(status.pillsRemaining).toBe(30);
  });

  it('calculates daysRemaining correctly for a twice-daily med', () => {
    const med = {
      times: ['8:00 AM', '8:00 PM'],
      refillTracking: { enabled: true, pillsRemaining: 28, pillsPerDose: 1, totalQuantity: 60 },
    };
    expect(getRefillStatus(med).daysRemaining).toBe(14); // 28 / (1 × 2)
  });

  it('sets shouldAlert true when ≤7 days remain', () => {
    const med = {
      times: ['8:00 AM'],
      refillTracking: { enabled: true, pillsRemaining: 5, pillsPerDose: 1, totalQuantity: 30 },
    };
    expect(getRefillStatus(med).shouldAlert).toBe(true);
  });

  it('sets shouldAlert false when >7 days remain', () => {
    const med = {
      times: ['8:00 AM'],
      refillTracking: { enabled: true, pillsRemaining: 30, pillsPerDose: 1, totalQuantity: 30 },
    };
    expect(getRefillStatus(med).shouldAlert).toBe(false);
  });

  it('uses totalQuantity when pillsRemaining is not set', () => {
    const med = {
      times: ['8:00 AM'],
      refillTracking: { enabled: true, totalQuantity: 20, pillsPerDose: 1 },
    };
    expect(getRefillStatus(med).daysRemaining).toBe(20);
  });
});
