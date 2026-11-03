import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/app.css';
import './styles/roles.css';
import './styles/admin.css';
import './styles/client-profile.css';
import './styles/branding.css';
import './styles/design-system.css';
import './styles/disclosures.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
