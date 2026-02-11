import React from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { App } from './App';

function ensureRootElement(): HTMLElement {
  const existing = document.getElementById('root');
  if (existing) {
    return existing;
  }

  const created = document.createElement('div');
  created.id = 'root';
  document.body.appendChild(created);
  return created;
}

const rootElement = ensureRootElement();
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
