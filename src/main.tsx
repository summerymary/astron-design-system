import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './components/ThemeProvider';
import { WorkspaceProvider } from './components/WorkspaceProvider';
import './styles/tokens.css';
import './styles/app.css';
import './styles/roles.css';
import './styles/admin.css';
import './styles/client-profile.css';
import './styles/branding.css';
import './styles/design-system.css';
import './styles/disclosures.css';
import './styles/theme.css';
import './styles/guide.css';
import './styles/client-search.css';
import './styles/workspace.css';
import './styles/typography.css';
import './styles/layout.css';
import './styles/memberships.css';

function redirectLegacyGuide() {
  if (!/^#\/design-system(?:\?|$)/.test(window.location.hash)) return false;
  window.location.replace(`./design-system.html${window.location.search}`);
  return true;
}
window.addEventListener('hashchange', redirectLegacyGuide);
if (!redirectLegacyGuide())
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
