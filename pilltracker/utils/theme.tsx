import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pilltracker_theme';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  error: string;
  success: string;
  warning: string;
  inputBg: string;
  inputBorder: string;
  skeleton: string;
  navBg: string;
  chip: string;
  chipText: string;
  overlay: string;
}

const LIGHT: ThemeColors = {
  background: '#ffffff',
  surface: '#f5f5f5',
  card: '#ffffff',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textMuted: '#999999',
  border: '#e0e0e0',
  primary: '#1a1a1a',
  primaryText: '#ffffff',
  error: '#cc0000',
  success: '#2e7d32',
  warning: '#e65100',
  inputBg: '#fafafa',
  inputBorder: '#dddddd',
  skeleton: '#eeeeee',
  navBg: '#ffffff',
  chip: '#f0f0f0',
  chipText: '#333333',
  overlay: 'rgba(0,0,0,0.45)',
};

const DARK: ThemeColors = {
  background: '#121212',
  surface: '#1e1e1e',
  card: '#2a2a2a',
  text: '#f0f0f0',
  textSecondary: '#bbbbbb',
  textMuted: '#888888',
  border: '#3a3a3a',
  primary: '#f0f0f0',
  primaryText: '#121212',
  error: '#ff5252',
  success: '#69f0ae',
  warning: '#ffab40',
  inputBg: '#2a2a2a',
  inputBorder: '#3a3a3a',
  skeleton: '#333333',
  navBg: '#1e1e1e',
  chip: '#333333',
  chipText: '#dddddd',
  overlay: 'rgba(0,0,0,0.65)',
};

interface ThemeContextValue {
  dark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  dark: false,
  colors: LIGHT,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val === 'dark') setDark(true);
    });
  }, []);

  const toggleTheme = () => {
    setDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ dark, colors: dark ? DARK : LIGHT, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
