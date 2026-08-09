import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// During development, visiting /?clearauth=1 wipes any stored token so you
// can see the auth page even when a previous session is still active.
if (new URLSearchParams(window.location.search).get('clearauth') === '1') {
  localStorage.removeItem('auth_token');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
