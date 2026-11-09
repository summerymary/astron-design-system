import React from 'react';
import ReactDOM from 'react-dom/client';
import { DesignSystemWorkspace } from './pages/DesignSystemWorkspace';
import { ThemeProvider } from './components/ThemeProvider';
import './styles/tokens.css';
import './styles/app.css';
import './styles/branding.css';
import './styles/design-system.css';
import './styles/disclosures.css';
import './styles/theme.css';
import './styles/guide.css';
import './styles/typography.css';
import './styles/layout.css';
import './styles/memberships.css';
import './styles/visual-style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <DesignSystemWorkspace />
    </ThemeProvider>
  </React.StrictMode>,
);
