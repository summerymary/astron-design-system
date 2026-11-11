import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCheck, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { deliveryLabels, messageDate, messageTime } from '../lib/client-messages';
import type { ChatMessage } from '../lib/client-messages';
import { Empty } from './WorkspaceUI';
import '../styles/messenger.css';

export function ChatHistory({
  entries,
  name,
  onEdit,
  onDelete,
}: {
  entries: ChatMessage[];
  name: string;
  onEdit?: (entry: ChatMessage) => void;
  onDelete?: (entry: ChatMessage) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const lastId = entries.at(-1)?.id;
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lastId]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest('.message-actions, .message-menu')
      )
        setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  return (
    <div
      className="message-history"
      ref={log}
      role="log"
      aria-label={`Переписка: ${name}`}
      tabIndex={0}
      onScroll={() => setMenu(null)}
    >
      {!entries.length && (
        <Empty title="Начните разговор" text="Напишите первое сообщение клиенту." />
      )}
      {entries.map((entry, index) => {
        const own = entry.sender === 'club';
        const day = messageDate(entry.createdAt);
        const newDay = index === 0 || day !== messageDate(entries[index - 1].createdAt);
        const canManage = own && !entry.deletedAt && !!onEdit && !!onDelete;
        return (
          <div className="message-group" key={entry.id}>
            {newDay && (
              <div className="message-day">
                <span>{day}</span>
              </div>
            )}
            <article
              className={`message-row ${own ? 'message-own' : 'message-incoming'}`}
              aria-label={`${own ? 'Клуб' : name}, ${messageTime(entry.createdAt)}`}
            >
              <div className={`message-bubble${entry.deletedAt ? ' message-deleted' : ''}`}>
                <span className="message-author">{own ? 'Клуб' : name}</span>
                <p>{entry.deletedAt ? 'Сообщение удалено' : entry.text}</p>
                <div className="message-meta">
                  {entry.editedAt && !entry.deletedAt && (
                    <span title={`Изменено ${messageTime(entry.editedAt)}`}>изменено</span>
                  )}
                  <time dateTime={entry.createdAt || undefined}>
                    {messageTime(entry.createdAt)}
                  </time>
                  {own && !entry.deletedAt && entry.delivery && (
                    <span
                      className={`message-delivery delivery-${entry.delivery}`}
                      title={deliveryLabels[entry.delivery]}
                      aria-label={deliveryLabels[entry.delivery]}
                    >
                      {entry.delivery === 'sent' ? <Check size={16} /> : <CheckCheck size={16} />}
                      <span>{deliveryLabels[entry.delivery]}</span>
                    </span>
                  )}
                </div>
              </div>
              {canManage && (
                <div
                  className="message-actions"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      setMenu(null);
                      event.currentTarget.querySelector('button')?.focus();
                    }
                  }}
                >
                  <button
                    className="icon-button message-more"
                    aria-label={`Действия с сообщением ${index + 1}`}
                    aria-expanded={menu === entry.id}
                    aria-haspopup="menu"
                    onClick={(event) => {
                      trigger.current = event.currentTarget;
                      const rect = event.currentTarget.getBoundingClientRect();
                      setPosition({
                        left: Math.max(8, Math.min(rect.left, window.innerWidth - 218)),
                        top:
                          rect.bottom + 122 < window.innerHeight
                            ? rect.bottom + 4
                            : Math.max(8, rect.top - 116),
                      });
                      setMenu(menu === entry.id ? null : entry.id);
                    }}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                  {menu === entry.id &&
                    createPortal(
                      <div
                        className="message-menu"
                        role="menu"
                        aria-label="Действия с сообщением"
                        style={position}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            setMenu(null);
                            trigger.current?.focus();
                          }
                          if (event.key === 'Tab') setMenu(null);
                          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                            event.preventDefault();
                            const items = Array.from(
                              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                                '[role="menuitem"]',
                              ),
                            );
                            const index = items.indexOf(
                              document.activeElement as HTMLButtonElement,
                            );
                            items[
                              event.key === 'Home'
                                ? 0
                                : event.key === 'End'
                                  ? items.length - 1
                                  : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
                                    items.length
                            ]?.focus();
                          }
                        }}
                      >
                        <button
                          role="menuitem"
                          autoFocus
                          onClick={() => {
                            setMenu(null);
                            onEdit(entry);
                          }}
                        >
                          <Pencil size={16} />
                          Редактировать
                        </button>
                        <button
                          role="menuitem"
                          className="message-delete-action"
                          onClick={() => {
                            setMenu(null);
                            onDelete(entry);
                          }}
                        >
                          <Trash2 size={16} />
                          Удалить сообщение
                        </button>
                      </div>,
                      document.body,
                    )}
                </div>
              )}
            </article>
          </div>
        );
      })}
    </div>
  );
}
