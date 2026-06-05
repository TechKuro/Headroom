import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StoreProvider, createSampleData } from './store';
import * as docManager from './docManager';
import { IS_CLOUD, API_SCOPE, msalInstance, setActiveAccount, getAccount } from './auth/authConfig';
import './App.css';

function renderMessage(html) {
  document.getElementById('root').innerHTML =
    `<div style="display:flex;height:100vh;align-items:center;justify-content:center;
      color:#a0a8be;font-family:Inter,sans-serif;font-size:14px;text-align:center;padding:24px">${html}</div>`;
}

async function start() {
  // Cloud mode: complete the Entra sign-in (redirect flow) before anything else.
  if (IS_CLOUD) {
    await msalInstance.initialize();
    await msalInstance.handleRedirectPromise();
    let account = getAccount();
    if (!account) {
      await msalInstance.loginRedirect({ scopes: [API_SCOPE] });
      return; // browser navigates away to Microsoft; nothing more to do here
    }
    setActiveAccount(account);
  }

  // Hydrate the document cache (cloud: API, local: localStorage).
  await docManager.init({ makeSeed: createSampleData });

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <StoreProvider>
        <App />
      </StoreProvider>
    </React.StrictMode>
  );
}

start().catch(err => {
  console.error('Startup failed', err);
  renderMessage(`<div><strong>Headroom couldn’t start.</strong><br/>${err?.message || err}<br/><br/>
    <span style="opacity:.7">Check your connection or sign-in, then reload.</span></div>`);
});
