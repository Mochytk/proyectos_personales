import './styles/global.css';

import {
  DEFAULT_DAY_CUTOFF_HOUR,
  DEFAULT_STYLE,
  DEFAULT_TIME_ZONE,
  toLocalDate,
} from '@habit-tracker/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { useStyle } from './app/useStyle';

// Until the local database lands (PR 1.4), the style and "today" use the defaults.
function Root() {
  useStyle(DEFAULT_STYLE, toLocalDate(new Date(), DEFAULT_TIME_ZONE, DEFAULT_DAY_CUTOFF_HOUR));
  return <App />;
}

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
);
