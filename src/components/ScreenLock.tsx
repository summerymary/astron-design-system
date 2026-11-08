import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LockKeyhole } from 'lucide-react';
import { Button } from './ui';
import './screen-lock.css';

const storageKey = 'astron.admin-screen-locked';

export function screenIsLocked() {
  try {
    return sessionStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

export function rememberScreenLock(locked: boolean) {
  try {
    if (locked) sessionStorage.setItem(storageKey, '1');
    else sessionStorage.removeItem(storageKey);
  } catch {
    // Blocking storage does not prevent locking the current screen.
  }
}

export function ScreenLock({ name, onUnlock }: { name: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = new Map<HTMLElement, { inert: boolean; hidden: string | null }>();
    const disableBackground = () => {
      for (const element of Array.from(document.body.children)) {
        if (!(element instanceof HTMLElement) || element.contains(panel.current)) continue;
        if (!background.has(element))
          background.set(element, {
            inert: element.hasAttribute('inert'),
            hidden: element.getAttribute('aria-hidden'),
          });
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
      }
    };
    disableBackground();
    const observer = new MutationObserver(disableBackground);
    observer.observe(document.body, { childList: true });
    input.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(
        panel.current!.querySelectorAll<HTMLElement>('input, button:not(:disabled)'),
      );
      const first = items[0];
      const last = items.at(-1);
      if (!panel.current?.contains(document.activeElement)) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap, true);
    return () => {
      document.removeEventListener('keydown', trap, true);
      document.body.style.overflow = overflow;
      observer.disconnect();
      background.forEach(({ inert, hidden }, element) => {
        if (!inert) element.removeAttribute('inert');
        if (hidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', hidden);
      });
      before?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="screen-lock"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screen-lock-title"
    >
      <div className="screen-lock-panel" ref={panel}>
        <LockKeyhole size={28} aria-hidden="true" />
        <h1 id="screen-lock-title">Экран заблокирован</h1>
        <p>{name} · Администратор</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (pin !== '1234') {
              setError('Неверный PIN. Для примера используйте 1234.');
              setPin('');
              input.current?.focus();
              return;
            }
            onUnlock();
          }}
        >
          <label htmlFor="screen-lock-pin">PIN для разблокировки</label>
          <input
            ref={input}
            id="screen-lock-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            aria-invalid={!!error}
            aria-describedby={error ? 'screen-lock-help screen-lock-error' : 'screen-lock-help'}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
              setError('');
            }}
          />
          <small id="screen-lock-help">Демонстрационный PIN: 1234</small>
          {error && (
            <p id="screen-lock-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pin.length !== 4}>
            Разблокировать
          </Button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
