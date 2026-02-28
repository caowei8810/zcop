import React from 'react';
import ReactDOM from 'react-dom/client';
import { SmoothUIProvider } from './components/SmoothUIComponents';
import { ToastProvider } from './components/feedback/SmoothFeedbackComponents';
import { DashboardPage } from './pages/DashboardPage';
import { GlobalStyles } from './styles/GlobalStyles';
import './index.css';

// Create a root container for the smooth UI application
const SmoothUIRoot = () => {
  return (
    <SmoothUIProvider>
      <ToastProvider>
        <GlobalStyles />
        <DashboardPage />
      </ToastProvider>
    </SmoothUIProvider>
  );
};

// Render the smooth UI application
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <SmoothUIRoot />
  </React.StrictMode>
);