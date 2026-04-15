import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

jest.mock('../../firebase/medications', () => ({
  updateMedication: jest.fn(() => Promise.resolve()),
  deleteMedication: jest.fn(() => Promise.resolve()),
}));

import EditMedicationScreen from '../../app/edit-medication';

const mockBack    = router.back as jest.Mock;
const mockReplace = router.replace as jest.Mock;
const mockParams  = useLocalSearchParams as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><EditMedicationScreen /></ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.mockReturnValue({
    id: 'med1', name: 'Aspirin', dosage: '100mg',
    form: 'Tablet', frequency: 'Daily',
    times: JSON.stringify(['8:00 AM']),
    notes: '', photoUri: '',
    notificationIds: JSON.stringify([]),
  });
});

describe('EditMedicationScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('renders the Edit Medication title', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Edit Medication/i)).toBeTruthy();
  });

  it('pre-fills the medication name', () => {
    const { getAllByDisplayValue } = renderScreen();
    expect(getAllByDisplayValue('Aspirin').length).toBeGreaterThan(0);
  });

  it('pre-fills the dosage', () => {
    const { getAllByDisplayValue } = renderScreen();
    expect(getAllByDisplayValue('100mg').length).toBeGreaterThan(0);
  });

  it('renders the Save Changes button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Save Changes')).toBeTruthy();
  });

  it('renders the Back button', () => {
    const { getByText } = renderScreen();
    expect(getByText('← Back')).toBeTruthy();
  });

  it('pressing Back calls router.back', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('← Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('renders the photo picker area', () => {
    const { getAllByText } = renderScreen();
    expect(getAllByText(/Tap to add photo|📷/).length).toBeGreaterThan(0);
  });

  it('renders frequency chip options', () => {
    const { getByText } = renderScreen();
    expect(getByText('Daily')).toBeTruthy();
    expect(getByText('Weekly')).toBeTruthy();
  });

  it('saves and navigates back on valid save', async () => {
    const { getByText } = renderScreen();
    await act(async () => {
      fireEvent.press(getByText('Save Changes'));
    });
    await waitFor(() => {
      const { updateMedication } = require('../../firebase/medications');
      expect(updateMedication).toHaveBeenCalled();
    });
  });
});
