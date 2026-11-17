import { useEffect, useState } from 'react';
import { LogOut, Moon, Settings, ChevronDown } from 'lucide-react';

type Theme = 'dark';
const THEME_KEY = 'ec-system-theme';

export default function SystemControls({ signOut, inline = false }: { signOut?: () => Promise<void>; inline?: boolean }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Startup reset: the retired 'notepad' theme (UI-BOARD-STANDARD retirement policy)
    // must never persist — any stored non-dark value is reset to 'dark' on load.
    if (localStorage.getItem(THEME_KEY) !== 'dark') localStorage.setItem(THEME_KEY, 'dark');
    return 'dark';
  });
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);
  const logout = async () => { if (!signOut || signingOut) return; setSigningOut(true); try { await signOut(); } finally { setSigningOut(false); } };
  return <aside className={'system-controls' + (inline ? ' system-controls-inline' : '')} aria-label="System appearance and session controls">
    <button type="button" aria-label="Appearance and session settings" aria-expanded={open} aria-controls="system-controls-panel" onClick={() => setOpen(!open)}><Settings /><span>Settings</span><ChevronDown /></button>
    <div id="system-controls-panel" className={'system-controls-panel' + (open ? ' open' : '')} aria-hidden={!open} inert={!open}>
    <button className={theme === 'dark' ? 'active' : ''} type="button" onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'} title="Dark mode"><Moon /><span>Dark</span></button>
    {signOut && <button className="system-logout" type="button" onClick={() => void logout()} disabled={signingOut} title="Sign out"><LogOut /><span>{signingOut ? 'Leaving…' : 'Logout'}</span></button>}
    </div>
  </aside>;
}
