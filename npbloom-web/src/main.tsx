import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.scss';
import App from './App.tsx';
import { ErrorBoundary } from 'react-error-boundary';
import FallbackComponent from './FallbackComponent';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary fallbackRender={FallbackComponent}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
