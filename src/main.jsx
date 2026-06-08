import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LoginPage from './components/LoginPage';
import { StoreProvider, createSampleData } from './store';
import * as docManager from './docManager';
import {
  IS_SSO, API_SCOPE, msalInstance, setActiveAccount, getAccount,
  getDisplayName, setDisplayName,
} from './auth/authConfig';
import './App.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

function renderMessage(html) {
  document.getElementById('root').innerHTML =
    `<div style="display:flex;height:100vh;align-items:center;justify-content:center;
      color:#a0a8be;font-family:Inter,sans-serif;font-size:14px;text-align:center;padding:24px">${html}</div>`;
}

// Hydrate the document cache (cloud: API, local: localStorage), then render.
async function renderApp() {
  await docManager.init({ makeSeed: createSampleData });
  root.render(
    <React.StrictMode>
      <StoreProvider>
        <App />
      </StoreProvider>
    </React.StrictMode>
  );
}

async function start() {
  // Real SSO: complete the Entra sign-in (redirect flow) before anything else.
  if (IS_SSO) {
    await msalInstance.initialize();
    await msalInstance.handleRedirectPromise();
    let account = getAccount();
    if (!account) {
      await msalInstance.loginRedirect({ scopes: [API_SCOPE] });
      return; // browser navigates away to Microsoft; nothing more to do here
    }
    setActiveAccount(account);
    return renderApp();
  }

  // Shared no-login mode: gate on a display name via the landing page.
  if (!getDisplayName()) {
    root.render(<LoginPage onContinue={name => { setDisplayName(name); renderApp(); }} />);
    return;
  }

  return renderApp();
}

start().catch(err => {
  console.error('Startup failed', err);
  renderMessage(`<div><strong>Headroom couldn’t start.</strong><br/>${err?.message || err}<br/><br/>
    <span style="opacity:.7">Check your connection or sign-in, then reload.</span></div>`);
});
