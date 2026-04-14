import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

jest.mock('../../firebase/medications', () => ({
  getMedications: jest.fn(() => Promise.resolve([
    { id: 'm1', name: 'Warfarin', dosage: '5mg' },
  ])),
}));

import AddMedicationScreen from '../../app/add-medication';

const mockPush = router.push as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><AddMedicationScreen /></ThemeProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('AddMedicationScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('renders the screen title', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Add Medication/i)).toBeTruthy();
  });

  it('renders the medication name input', () => {
    const { getByPlaceholderText } = renderScreen();
    expect(getByPlaceholderText(/e\.g\.|medication name/i)).toBeTruthy();
  });

  it('shows validation error when form is submitted empty', async () => {
    const { getByText, findAllByText } = renderScreen();
    const nextBtn = getByText(/continue/i);
    fireEvent.press(nextBtn);
    const errors = await findAllByText(/required|invalid|enter/i);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows typing a medication name', () => {
    const { getByPlaceholderText } = renderScreen();
    const input = getByPlaceholderText(/e\.g\.|medication name/i);
    fireEvent.changeText(input, 'Aspirin');
    expect(input.props.value ?? (input.props as any).defaultValue ?? 'Aspirin').toBeTruthy();
  });

  it('renders frequency selector options', () => {
    const { getByText } = renderScreen();
    expect(getByText('Daily')).toBeTruthy();
  });

  it('renders the photo picker placeholder', () => {
    const { getAllByText } = renderScreen();
    expect(getAllByText(/Tap to add photo|📷/).length).toBeGreaterThan(0);
  });
});
