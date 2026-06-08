import React, { useState } from 'react';

// Basic landing/login page. Shown in shared no-login mode (Neon-backed, SSO
// off): the user types a display name so their edits are attributed in the
// shared workspace. (With real M365 SSO, Microsoft's sign-in page is used
// instead and this never shows.)
export default function LoginPage({ onContinue }) {
  const [name, setName] = useState('');
  function submit(e) {
    e.preventDefault();
    const n = name.trim();
    if (n) onContinue(n);
  }
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">Headroom</div>
        <div className="login-sub">Capacity &amp; commercial planning</div>
        <p className="login-note">
          Shared workspace — enter your name to continue. It’s used to label your
          changes so the team can see who did what.
        </p>
        <input
          className="login-input"
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
        />
        <button className="btn btn-primary login-btn" type="submit" disabled={!name.trim()}>Continue</button>
      </form>
    </div>
  );
}
