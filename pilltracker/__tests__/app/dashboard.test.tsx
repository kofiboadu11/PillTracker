import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'u1', email: 'test@test.com', displayName: 'Jane Doe' } },
  db: {},
}));

jest.mock('firebase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../firebase/medications', () => ({
  getMedications:           jest.fn(() => Promise.resolve([
    {
      id: 'med1', name: 'Aspirin', dosage: '100mg',
      frequency: 'once daily', times: ['8:00 AM'],
      notificationIds: [], refillTracking: { enabled: false },
    },
  ])),
  toggleMedication:         jest.fn(() => Promise.resolve()),
  initializeTodayAdherence: jest.fn(() => Promise.resolve()),
  getAdherenceForDate:      jest.fn(() => Promise.resolve({ med1: false })),
  decrementPillsRemaining:  jest.fn(() => Promise.resolve(25)),
  getRefillStatus:          jest.fn(() => null),
  deleteMedication:         jest.fn(() => Promise.resolve()),
  updateMedication:         jest.fn(() => Promise.resolve()),
}));

import DashboardScreen from '../../app/dashboard';

const mockPush = router.push as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><DashboardScreen /></ThemeProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('DashboardScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('shows a greeting', () => {
    const { getByText } = renderScreen();
    expect(getByText(/good (morning|afternoon|evening)/i)).toBeTruthy();
  });

  it('shows medication name after data loads', async () => {
    const { findByText } = renderScreen();
    await expect(findByText('Aspirin')).resolves.toBeTruthy();
  });

  it('shows medication dosage', async () => {
    const { findByText } = renderScreen();
    await expect(findByText(/100mg/)).resolves.toBeTruthy();
  });

  it('renders the settings icon', () => {
    const { getByText } = renderScreen();
    expect(getByText('⚙️')).toBeTruthy();
  });

  it('pressing settings icon navigates to /settings', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('⚙️'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('renders the add medication nav icon', () => {
    const { getByText } = renderScreen();
    expect(getByText('💊')).toBeTruthy();
  });

  it('renders the adherence nav icon', () => {
    const { getByText } = renderScreen();
    expect(getByText('📈')).toBeTruthy();
  });
});
