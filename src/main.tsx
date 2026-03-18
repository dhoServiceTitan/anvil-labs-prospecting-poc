import { AnvilProvider } from '@servicetitan/anvil2';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnvilProvider themeData={{ mode: 'light' }}>
      <App />
    </AnvilProvider>
  </StrictMode>
);
