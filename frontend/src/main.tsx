import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';
import { ApiError } from '@/api/http';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 0) {
          return false;
        }

        return failureCount < 1;
      },
    },
  },
});

const Root = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} position="bottom" /> : null}
    </QueryClientProvider>
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Root />);
