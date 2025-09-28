import { useEffect } from 'react';
import { POSPage } from './pages/POS';
import { ToastContainer } from './components/ToastContainer';
import { useUiStore } from './stores/useUiStore';

const App = () => {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <>
      <POSPage />
      <ToastContainer />
    </>
  );
};

export default App;
