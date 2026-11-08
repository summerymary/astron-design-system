import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import './select.css';

type Option = { value: string; label: string; disabled: boolean; group?: string };
type OptionProps = {
  value?: string | number;
  label?: string;
  disabled?: boolean;
  children?: ReactNode;
};
const normalize = (text: string) => text.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) =>
      isValidElement<OptionProps>(child) ? textOf(child.props.children) : String(child),
    )
    .join('');
function optionsOf(children: ReactNode, group?: string, disabled = false): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === 'option') {
      const label = child.props.label || textOf(child.props.children);
      return [
        {
          value: String(child.props.value ?? label),
          label,
          disabled: disabled || !!child.props.disabled,
          group,
        },
      ];
    }
    if (child.type === 'optgroup')
      return optionsOf(child.props.children, child.props.label, disabled || child.props.disabled);
    return optionsOf(child.props.children, group, disabled);
  });
}

/** Styled single select; the hidden native control preserves form data and validation. */
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  id,
  className = '',
  autoFocus,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const controlId = id || `select-${generatedId}`;
  const listId = `${controlId}-list`;
  const options = optionsOf(children);
  const [ownValue, setOwnValue] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const selectedValue = value === undefined ? ownValue : String(value);
  const selected = options.find((option) => option.value === selectedValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 240, maxHeight: 320 });
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: '', time: 0 });
  const searchable = options.length > 7;
  const filtered = options.filter(
    (option) => !query || normalize(option.label).includes(normalize(query)),
  );
  const enabled = filtered
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index >= 0);
  const activeOption = filtered[active];
  const close = (restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  const show = (edge?: 'first' | 'last') => {
    if (props.disabled) return;
    setQuery('');
    const first = options.findIndex((option) => !option.disabled);
    const current = options.findIndex(
      (option) => option.value === selectedValue && !option.disabled,
    );
    const last =
      options.length - 1 - [...options].reverse().findIndex((option) => !option.disabled);
    setActive(edge === 'first' ? first : edge === 'last' ? last : Math.max(first, current));
    setOpen(true);
  };
  const choose = (option: Option) => {
    if (option.disabled || !native.current) return;
    if (native.current.value !== option.value) {
      native.current.value = option.value;
      native.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setInvalid(false);
    close(true);
  };
  useEffect(() => {
    const label = trigger.current?.closest('label');
    if (label && !label.htmlFor) {
      label.htmlFor = controlId;
      return () => {
        label.removeAttribute('for');
      };
    }
  }, [controlId]);
  useEffect(() => {
    if (autoFocus) trigger.current?.focus();
    const form = native.current?.form;
    const reset = () => {
      setOwnValue(String(defaultValue ?? options[0]?.value ?? ''));
      setInvalid(false);
      close();
    };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [autoFocus, defaultValue]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 240), innerWidth - 24);
      const viewportTop = window.visualViewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (window.visualViewport?.height || innerHeight);
      const below = viewportBottom - rect.bottom - 16;
      const above = rect.top - viewportTop - 16;
      const up = below < 220 && above > below;
      const height = Math.min(360, Math.max(120, up ? above : below));
      const actualHeight = Math.min(height, popup.current?.scrollHeight || height);
      setPosition({
        left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)),
        top: up ? Math.max(viewportTop + 12, rect.top - actualHeight - 6) : rect.bottom + 6,
        width,
        maxHeight: height,
      });
    };
    place();
    if (searchable) search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        close();
    };
    const scroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) place();
    };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', scroll, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', scroll, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open, searchable, filtered.length]);
  useEffect(() => {
    if (open)
      popup.current
        ?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab' && open) {
      close(true);
      return;
    }
    if (event.key === 'Enter' || (event.key === ' ' && event.target === trigger.current)) {
      event.preventDefault();
      if (!open) show();
      else if (activeOption) choose(activeOption);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) {
      if ((event.key === 'Home' || event.key === 'End') && event.target === search.current) return;
      event.preventDefault();
      if (!open) {
        show(event.key === 'End' ? 'last' : event.key === 'Home' ? 'first' : undefined);
        return;
      }
      if (!enabled.length) return;
      const index = Math.max(0, enabled.indexOf(active));
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? enabled.length - 1
            : event.key === 'PageDown'
              ? Math.min(enabled.length - 1, index + 5)
              : event.key === 'PageUp'
                ? Math.max(0, index - 5)
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
      setActive(enabled[next]);
    } else if (
      event.target === trigger.current &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      if (searchable) {
        show();
        setQuery(event.key);
        setActive(0);
        return;
      }
      const now = Date.now();
      const text =
        now - typeahead.current.time < 700 ? typeahead.current.text + event.key : event.key;
      typeahead.current = { text, time: now };
      const index = options.findIndex(
        (option) => !option.disabled && normalize(option.label).startsWith(normalize(text)),
      );
      if (index >= 0) {
        if (!open) show();
        setActive(index);
      }
    }
  };
  const label = props['aria-label'] || (props.name ? `Выбор: ${props.name}` : 'Поиск в списке');
  return (
    <>
      <select
        {...props}
        className="select-native"
        aria-hidden="true"
        tabIndex={-1}
        ref={native}
        value={selectedValue}
        onChange={(event) => {
          setOwnValue(event.target.value);
          setInvalid(false);
          onChange?.(event);
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          show();
          props.onInvalid?.(event);
        }}
      >
        {children}
      </select>
      <button
        type="button"
        id={controlId}
        className={`select-trigger ${className}`}
        role="combobox"
        disabled={props.disabled}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={
          [props['aria-describedby'], invalid ? `${controlId}-error` : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
        aria-required={props.required}
        aria-invalid={props['aria-invalid'] || invalid || undefined}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={open && activeOption ? `${listId}-${active}` : undefined}
        title={props.title || selected?.label}
        style={props.style}
        onClick={() => (open ? close() : show())}
        onKeyDown={keyDown}
        onBlur={() => {
          if (!open && native.current)
            native.current.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        }}
        ref={trigger}
      >
        <span>{selected?.label || 'Выберите'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {invalid && (
        <span className="select-error" role="alert" id={`${controlId}-error`}>
          Выберите значение.
        </span>
      )}
      {open &&
        createPortal(
          <div className="select-popover" style={position} ref={popup}>
            {searchable && (
              <div className="select-search">
                <Search size={16} aria-hidden="true" />
                <input
                  ref={search}
                  role="combobox"
                  aria-label={`Поиск: ${label}`}
                  aria-controls={listId}
                  aria-expanded="true"
                  aria-activedescendant={activeOption ? `${listId}-${active}` : undefined}
                  value={query}
                  placeholder="Поиск в списке"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={keyDown}
                />
              </div>
            )}
            <div
              className="select-options"
              role="listbox"
              id={listId}
              aria-label={props['aria-label'] || 'Варианты выбора'}
            >
              {filtered.map((option, index) => (
                <div key={`${option.value}-${index}`}>
                  {option.group && option.group !== filtered[index - 1]?.group && (
                    <div className="select-option-group">{option.group}</div>
                  )}
                  <div
                    role="option"
                    id={`${listId}-${index}`}
                    aria-selected={option.value === selectedValue}
                    aria-disabled={option.disabled || undefined}
                    data-option-index={index}
                    className={`select-option ${index === active ? 'is-active' : ''}`}
                    onPointerMove={() => !option.disabled && setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                  >
                    <span>{option.label}</span>
                    <Check
                      size={16}
                      aria-hidden="true"
                      className={option.value === selectedValue ? '' : 'is-invisible'}
                    />
                  </div>
                </div>
              ))}
              {!filtered.length && (
                <div className="select-no-results" role="status">
                  Ничего не найдено
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
