import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './components/ThemeProvider';
import './styles/tokens.css';
import './styles/app.css';
import './styles/roles.css';
import './styles/admin.css';
import './styles/client-profile.css';
import './styles/branding.css';
import './styles/design-system.css';
import './styles/disclosures.css';
import './styles/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
