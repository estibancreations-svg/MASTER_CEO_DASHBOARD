import { useEffect, useState } from 'react';
import { LogOut, Moon, NotebookPen } from 'lucide-react';

type Theme = 'dark' | 'notepad';
const THEME_KEY = 'ec-system-theme';

export default function SystemControls({ signOut }: { signOut?: () => Promise<void> }) {
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem(THEME_KEY) === 'notepad' ? 'notepad' : 'dark');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);
  const logout = async () => { if (!signOut || signingOut) return; setSigningOut(true); try { await signOut(); } finally { setSigningOut(false); } };
  return <aside className="system-controls" aria-label="System appearance and session controls">
    <button className={theme === 'dark' ? 'active' : ''} type="button" onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'} title="Dark mode"><Moon /><span>Dark</span></button>
    <button className={theme === 'notepad' ? 'active' : ''} type="button" onClick={() => setTheme('notepad')} aria-pressed={theme === 'notepad'} title="Think mode"><NotebookPen /><span>Think</span></button>
    {signOut && <button className="system-logout" type="button" onClick={() => void logout()} disabled={signingOut} title="Sign out"><LogOut /><span>{signingOut ? 'Leaving…' : 'Logout'}</span></button>}
  </aside>;
}
