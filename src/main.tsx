import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './assets/styles/index.css';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { BoardProvider } from './context/BoardContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BoardProvider>
        <App />
      </BoardProvider>
    </ThemeProvider>
  </StrictMode>,
);
