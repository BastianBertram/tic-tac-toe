import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { useSettingsStore } from './store/settingsStore';
import { applyTheme } from './theme';

// Persistiertes Theme (Mood) vor dem ersten Render anwenden
applyTheme(useSettingsStore.getState().themeId);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
