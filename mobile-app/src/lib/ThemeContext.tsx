import React, { createContext, useContext, useState } from 'react';

export type Theme = {
  isDark: boolean;
  bg: string;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  headerBg: string;
  divider: string;
  navActive: string;
  navInactive: string;
  modalBg: string;
  inputBg: string;
};

export const lightTheme: Theme = {
  isDark: false,
  bg: '#fcfaf8',
  cardBg: '#ffffff',
  borderColor: '#d0ddff',
  textPrimary: '#333333',
  textSecondary: '#666666',
  headerBg: '#2e64e5',
  divider: '#f0f0f0',
  navActive: '#2e64e5',
  navInactive: '#888888',
  modalBg: '#ffffff',
  inputBg: '#f8fafc',
};

export const darkTheme: Theme = {
  isDark: true,
  bg: '#0f172a',
  cardBg: '#1e293b',
  borderColor: '#334155',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  headerBg: '#1e3a8a',
  divider: '#334155',
  navActive: '#60a5fa',
  navInactive: '#64748b',
  modalBg: '#1e293b',
  inputBg: '#0f172a',
};

const ThemeContext = createContext<{
  theme: Theme;
  isDark: boolean;
  toggleTheme: (val: boolean) => void;
}>({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Always starts OFF (Light Mode) when the app is first opened
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = (val: boolean) => {
    setIsDark(val);
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);