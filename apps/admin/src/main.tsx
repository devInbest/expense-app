import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';

import './index.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import { store } from './store';
import { queryClient } from './lib/queryClient';
import { applyThemeColor } from './constants/themeColors';
import AppThemeProvider from './components/providers/AppThemeProvider';
import App from './App';

const { theme, themeColor } = store.getState().common;
document.documentElement.setAttribute('data-theme', theme);
// Paint the cached theme color before React renders to avoid a flash of the default palette.
applyThemeColor(themeColor);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <App />
        </AppThemeProvider>
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
);
