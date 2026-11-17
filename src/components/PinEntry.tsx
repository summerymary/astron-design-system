import { useId, useRef, useState } from 'react';
import { Button } from './ui';

/** Prototype only: a real deployment must validate individual PINs on the server. */
export function PinEntry({
  onUnlock,
  label = 'ПИН-код',
  action = 'Открыть кабинет',
}: {
  onUnlock: () => void;
  label?: string;
  action?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      className="pin-entry"
      data-ui="pin-entry"
      onSubmit={(event) => {
        event.preventDefault();
        if (pin !== '1234') {
          setError('Неверный ПИН-код. Попробуйте ещё раз.');
          setPin('');
          input.current?.focus();
          return;
        }
        setPin('');
        onUnlock();
      }}
    >
      <label className="form-field" htmlFor={id}>
        <span>{label}</span>
        <input
          ref={input}
          id={id}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          aria-invalid={!!error}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
          onChange={(event) => {
            setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
            setError('');
          }}
        />
      </label>
      {error && (
        <p id={`${id}-error`} className="pin-entry-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pin.length !== 4}>
        {action}
      </Button>
      <small id={`${id}-help`}>Демонстрационный ПИН: 1234</small>
    </form>
  );
}
