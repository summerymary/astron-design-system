import { Pin, PinOff, Plus, MessageSquare } from 'lucide-react';
import { Button } from './ui';
import type { DemoRecord } from '../data/workspace';
import { prettyDate } from '../data/workspace';

export function PinnedClientComment({
  note,
  onHistory,
  onAdd,
}: {
  note?: DemoRecord;
  onHistory: () => void;
  onAdd?: () => void;
}) {
  return (
    <section
      className={`client-pinned-note ${note ? 'has-note' : ''}`}
      aria-label="Важный комментарий"
    >
      {note ? (
        <>
          <Pin size={18} aria-hidden="true" />
          <div>
            <strong>Закреплённый комментарий</strong>
            <p>{note.text}</p>
          </div>
          <Button variant="ghost" onClick={onHistory}>
            Все комментарии
          </Button>
        </>
      ) : (
        <>
          <MessageSquare size={18} />
          <span>Важный комментарий можно закрепить в карточке</span>
          {onAdd && (
            <Button variant="ghost" onClick={onAdd}>
              Добавить
            </Button>
          )}
        </>
      )}
    </section>
  );
}

export function ClientComments({
  notes,
  pinnedId,
  onPin,
  onAdd,
}: {
  notes: DemoRecord[];
  pinnedId: string;
  onPin?: (id: string) => void;
  onAdd?: () => void;
}) {
  return (
    <section className="client-comments-section" aria-label="История комментариев">
      <div className="client-comments-toolbar">
        <h3>
          История комментариев <span>{notes.length}</span>
        </h3>
        {onAdd && (
          <Button variant="secondary" onClick={onAdd}>
            <Plus size={16} />
            Добавить комментарий
          </Button>
        )}
      </div>
      {!notes.length && <p>Комментариев пока нет.</p>}
      {[...notes]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((note) => (
          <article
            className={`client-comment-entry ${pinnedId === note.id ? 'is-pinned' : ''}`}
            key={note.id}
          >
            <header>
              <strong>{note.author || 'Сотрудник клуба'}</strong>
              <time>{prettyDate(note.createdAt)}</time>
              {pinnedId === note.id && (
                <span>
                  <Pin size={14} />
                  Закреплён
                </span>
              )}
            </header>
            <p>{note.text}</p>
            {onPin && (
              <Button variant="ghost" onClick={() => onPin(pinnedId === note.id ? '' : note.id)}>
                {pinnedId === note.id ? <PinOff size={15} /> : <Pin size={15} />}
                {pinnedId === note.id ? 'Открепить' : 'Закрепить в карточке'}
              </Button>
            )}
          </article>
        ))}
    </section>
  );
}
