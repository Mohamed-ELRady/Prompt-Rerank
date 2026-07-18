import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/assets/tailwind.css';
import { OptionsApp } from './OptionsApp';

const root = document.getElementById('root');
if (!root) {
  throw new Error('options: #root element missing');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
