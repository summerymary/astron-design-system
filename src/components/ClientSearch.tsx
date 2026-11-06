import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, CornerDownLeft, Search, X } from 'lucide-react';
import { Avatar } from './ui';
import { memberCards } from '../data/admin';
import { clientCard, searchMembers } from '../lib/member-search';
import type { Member } from '../types';

export function ClientSearch({
  members,
  onMember,
  mode = 'profile',
}: {
  members: Member[];
  onMember: (member: Member) => void;
  mode?: 'profile' | 'selection';
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [submitted, setSubmitted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLFormElement>(null);
  const id = useId();
  const matches = searchMembers(members, memberCards, query);
  const visible = open && !!query.trim();
  const invalid = submitted && !matches.length && !!query.trim();
  const selected = active >= 0 ? matches[active] : undefined;
  useEffect(() => {
    if (visible && selected)
      document
        .getElementById(`${id}-option-${selected.id}`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [visible, selected, id]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const choose = (member: Member) => {
    setQuery('');
    setOpen(false);
    setActive(-1);
    setSubmitted(false);
    input.current?.blur();
    onMember(member);
  };
  return (
    <form
      ref={root}
      role="search"
      aria-label={mode === 'profile' ? 'Быстрый поиск клиента' : 'Поиск клиента для посещения'}
      className={`quick-card client-search ${invalid ? 'quick-card-error' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!query.trim()) {
          input.current?.focus();
          return;
        }
        const exactCard = matches.find(
          (member) => clientCard(member, memberCards) === query.replace(/\D/g, ''),
        );
        if (selected || exactCard || matches.length === 1)
          choose(selected ?? exactCard ?? matches[0]);
        else {
          setSubmitted(true);
          setOpen(true);
          input.current?.focus();
        }
      }}
    >
      <Search size={18} aria-hidden="true" />
      <label className="sr-only" htmlFor={`${id}-input`}>
        {mode === 'profile'
          ? 'Карта, ФИО или телефон клиента'
          : 'Клиент для посещения: карта, ФИО или телефон'}
      </label>
      <input
        ref={input}
        id={`${id}-input`}
        role="combobox"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Карта, ФИО или телефон"
        value={query}
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? `${id}-results` : undefined}
        aria-activedescendant={visible && selected ? `${id}-option-${selected.id}` : undefined}
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(-1);
          setSubmitted(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && matches.length) {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              event.key === 'ArrowDown'
                ? (index + 1) % matches.length
                : (index <= 0 ? matches.length : index) - 1,
            );
          }
        }}
      />
      {query && (
        <button
          type="button"
          className="client-search-clear"
          aria-label="Очистить поиск клиента"
          onClick={() => {
            setQuery('');
            setSubmitted(false);
            setActive(-1);
            input.current?.focus();
          }}
        >
          <X size={14} />
        </button>
      )}
      <button type="submit" aria-label="Найти клиента" title="Найти клиента · Enter">
        <CornerDownLeft size={16} />
      </button>
      <span className="sr-only" id={`${id}-help`}>
        Введите номер карты, ФИО или телефон. Стрелки — выбор, Enter —{' '}
        {mode === 'profile' ? 'открыть карточку' : 'выбрать клиента'}, Escape — закрыть список.
      </span>
      {visible && (
        <div className="client-search-dropdown">
          <div className="client-search-caption" role="status">
            {matches.length ? `Найдено клиентов: ${matches.length}` : 'Ничего не найдено'}
          </div>
          <div role="listbox" aria-label="Найденные клиенты" id={`${id}-results`}>
            {matches.map((member, index) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index === active}
                id={`${id}-option-${member.id}`}
                key={member.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(member)}
                onMouseEnter={() => setActive(index)}
              >
                <Avatar member={member} />
                <span>
                  <strong>{member.fullName ?? member.name}</strong>
                  <small>
                    {member.phone}
                    <i />
                    Карта {clientCard(member, memberCards)}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          {!matches.length && (
            <p className="client-search-empty">
              Проверьте данные или попробуйте другой способ поиска. Например: Смирнова, 123-45-67
              или 100001.
            </p>
          )}
          <p className="client-search-help">
            {mode === 'profile'
              ? 'Поиск открывает карточку. Посещение оформляется отдельно.'
              : 'Выбор клиента не создаёт посещение. Для этого нужна кнопка подтверждения.'}
          </p>
        </div>
      )}
    </form>
  );
}
