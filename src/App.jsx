import { useEffect, useState } from 'react';
import Portfolio from './Portfolio.jsx';
import Privacy from './Privacy.jsx';

function getPageTitle(pathname) {
  if (pathname === '/privacy' || pathname === '/privacy/') {
    return 'Privacy Policy — Flavio Donnini';
  }
  return 'Flavio Donnini — Web Engineer';
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onNavigate = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onNavigate);
    return () => window.removeEventListener('popstate', onNavigate);
  }, []);

  useEffect(() => {
    document.title = getPageTitle(path);
  }, [path]);

  if (path === '/privacy' || path === '/privacy/') {
    return <Privacy />;
  }

  return <Portfolio />;
}
