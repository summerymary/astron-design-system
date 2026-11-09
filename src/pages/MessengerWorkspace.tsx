import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  MessageCircle,
  Send,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { Select } from '../components/Select';
import { SearchBox, SectionLinks, Tabs } from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { AttentionFlags } from '../components/AttentionFlags';
import { ChatHistory } from '../components/ChatHistory';
import { useWorkspace } from '../components/WorkspaceProvider';
import {
  appendClientMessage,
  clientChatDraft,
  deleteClientMessage,
  editClientMessage,
  findClientChat,
  messageTime,
  readChatMessages,
} from '../lib/client-messages';
import type { ChatMessage } from '../lib/client-messages';
import type { Member } from '../types';
import type { DemoRecord } from '../data/workspace';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
export function MessagesWorkspace({
  external,
  navigate,
  initialMember,
  members,
  onMember,
}: {
  external: boolean;
  navigate: Navigate;
  initialMember: Member | null;
  members: Member[];
  onMember?: (member: Member) => void;
}) {
  const { data, put } = useWorkspace();
  const displayChats: DemoRecord[] = data.chats.map((row) => {
    const member = members.find((item) => String(item.id) === row.memberId);
    const last = readChatMessages(row).at(-1);
    return {
      ...row,
      name: member?.name || row.name,
      preview: last ? (last.deletedAt ? 'Сообщение удалено' : last.text) : row.preview,
      time: last?.createdAt ? messageTime(last.createdAt) : row.time,
    };
  });
  const existing = initialMember ? findClientChat(displayChats, initialMember.id) : undefined;
  const draft = initialMember && !external && !existing ? clientChatDraft(initialMember) : null;
  const viewId = external ? 'external' : 'support';
  const savedId = data['chat-view']?.find((row) => row.id === viewId)?.chatId;
  const [selectedId, setSelectedId] = useState<string | null>(
    existing?.id ||
      draft?.id ||
      displayChats.find(
        (row) =>
          row.id === savedId &&
          (external ? row.channel !== 'Поддержка' : row.channel === 'Поддержка'),
      )?.id ||
      null,
  );
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('Все каналы');
  const [attention, setAttention] = useState('Все');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const closeDelete = useCallback(() => setPendingDelete(null), []);
  const chat =
    displayChats.find((row) => row.id === selectedId) || (draft?.id === selectedId ? draft : null);
  const linkedMember = members.find((member) => String(member.id) === chat?.memberId);
  const text = editing?.text ?? (chat ? drafts[chat.id] || '' : '');
  const rows = [...(draft ? [draft] : []), ...displayChats].filter(
    (row) =>
      (external ? row.channel !== 'Поддержка' : row.channel === 'Поддержка') &&
      (attention === 'Все' ||
        (attention === 'Важные' ? row.important === 'true' : row.unread === 'true')) &&
      row.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')) &&
      (channel === 'Все каналы' || row.channel === channel),
  );
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing?.id]);
  const choose = (id: string | null) => {
    setSelectedId(id);
    put('chat-view', { id: viewId, chatId: id || '' });
    setEditing(null);
    setError('');
    setAnnouncement('');
  };
  return (
    <div className="ws-stack messenger-workspace">
      <SectionLinks
        ids={external ? ['messages'] : ['external-messages', 'notifications']}
        navigate={navigate}
      />
      <section
        className={`panel messenger-shell${chat ? ' has-selection' : ''}`}
        aria-label={external ? 'Мессенджеры' : 'Чаты клуба'}
      >
        <aside className="messenger-inbox" aria-label="Список диалогов">
          <div className="messenger-inbox-heading">
            <h2>{external ? 'Мессенджеры' : 'Диалоги'}</h2>
            <span className="count-badge">{rows.length}</span>
          </div>
          <div className="messenger-search">
            <SearchBox
              value={query}
              onChange={setQuery}
              label="Поиск диалога"
              placeholder="Найти диалог"
            />
            {external && (
              <Select
                aria-label="Канал обращений"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                {['Все каналы', 'Telegram', 'ВКонтакте', 'WhatsApp'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            )}
          </div>
          <Tabs
            items={['Все', 'Важные', 'Не просмотрены']}
            value={attention}
            onChange={setAttention}
            label="Отметки чатов"
          />
          <div className="messenger-chat-list">
            {rows.map((row) => (
              <button
                key={row.id}
                className={`messenger-chat-row${row.id === selectedId ? ' selected' : ''}`}
                aria-pressed={row.id === selectedId}
                onClick={() => choose(row.id)}
              >
                <span className="messenger-avatar" aria-hidden="true">
                  {initials(row.name)}
                </span>
                <span className="messenger-chat-copy">
                  <span className="messenger-chat-title">
                    <strong>{row.name}</strong>
                    <time>{row.time}</time>
                  </span>
                  <span className="messenger-chat-preview">{row.preview}</span>
                  <span className="messenger-chat-channel">
                    {row.channel}
                    {row.important === 'true' && (
                      <Star size={14} fill="currentColor" aria-label="Важный диалог" />
                    )}
                    {row.unread === 'true' && (
                      <span className="messenger-unread" aria-label="Не просмотрено" />
                    )}
                  </span>
                </span>
              </button>
            ))}
            {!rows.length && (
              <div className="messenger-empty">
                <strong>Диалогов не найдено</strong>
                <p>Измените поиск или фильтры.</p>
              </div>
            )}
          </div>
        </aside>
        <div className="messenger-conversation">
          {chat ? (
            <>
              <header className="messenger-chat-header">
                <button
                  className="icon-button messenger-back"
                  aria-label="К списку диалогов"
                  onClick={() => choose(null)}
                >
                  <ArrowLeft size={20} />
                </button>
                <span className="messenger-avatar" aria-hidden="true">
                  {initials(chat.name)}
                </span>
                <div className="messenger-contact">
                  <h2>{chat.name}</h2>
                  <span>
                    {chat.channel} · {chat.status}
                  </span>
                </div>
                {linkedMember && onMember && (
                  <button
                    className="icon-button"
                    aria-label="Открыть карточку клиента"
                    title="Карточка клиента"
                    onClick={() => onMember(linkedMember)}
                  >
                    <UserRound size={20} />
                    <ArrowUpRight size={12} />
                  </button>
                )}
                {data.chats.some((row) => row.id === chat.id) && (
                  <button
                    className={`icon-button${chat.status === 'Решено' ? ' chat-resolved' : ''}`}
                    title={chat.status === 'Решено' ? 'Вернуть в работу' : 'Вопрос решён'}
                    aria-label={chat.status === 'Решено' ? 'Вернуть в работу' : 'Вопрос решён'}
                    onClick={() =>
                      put('chats', {
                        ...chat,
                        status: chat.status === 'Решено' ? 'В работе' : 'Решено',
                      })
                    }
                  >
                    <Check size={20} />
                  </button>
                )}
              </header>
              <div className="messenger-flags">
                <AttentionFlags record={chat} onChange={(row) => put('chats', row)} />
              </div>
              <ChatHistory
                key={chat.id}
                entries={readChatMessages(chat)}
                name={chat.name}
                onEdit={(entry) => {
                  setEditing({ id: entry.id, text: entry.text });
                  setError('');
                }}
                onDelete={setPendingDelete}
              />
              <form
                className="messenger-compose"
                onSubmit={(event) => {
                  event.preventDefault();
                  try {
                    put(
                      'chats',
                      editing
                        ? editClientMessage(chat, editing.id, text)
                        : appendClientMessage(chat, text),
                    );
                    setAnnouncement(
                      editing ? 'Сообщение изменено.' : 'Сообщение добавлено в демочат.',
                    );
                    if (editing) setEditing(null);
                    else setDrafts((prev) => ({ ...prev, [chat.id]: '' }));
                    setError('');
                  } catch (problem) {
                    setError(problem instanceof Error ? problem.message : 'Проверьте сообщение.');
                  }
                }}
              >
                {editing && (
                  <div className="messenger-editing">
                    <div>
                      <strong>Редактирование сообщения</strong>
                      <span>После сохранения появится отметка «изменено».</span>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Отменить редактирование"
                      onClick={() => {
                        setEditing(null);
                        setError('');
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                <div className="messenger-compose-row">
                  <label className="form-field">
                    <span className="sr-only">
                      {editing ? 'Текст редактируемого сообщения' : 'Сообщение клиенту'}
                    </span>
                    <textarea
                      ref={input}
                      rows={2}
                      required
                      maxLength={2000}
                      value={text}
                      placeholder="Напишите сообщение…"
                      onChange={(e) => {
                        if (editing) setEditing({ ...editing, text: e.target.value });
                        else setDrafts((prev) => ({ ...prev, [chat.id]: e.target.value }));
                        setError('');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                        if (event.key === 'Escape' && editing) {
                          event.preventDefault();
                          setEditing(null);
                          setError('');
                        }
                      }}
                    />
                  </label>
                  <Button
                    type="submit"
                    aria-label={editing ? 'Сохранить сообщение' : 'Отправить сообщение'}
                    disabled={!text.trim()}
                  >
                    {editing ? <Check size={20} /> : <Send size={20} />}
                    <span>{editing ? 'Сохранить' : 'Отправить'}</span>
                  </Button>
                </div>
                {error && (
                  <p className="messenger-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="messenger-compose-hint">
                  <span>Демочат · без внешней отправки</span>
                  <span>Ctrl / ⌘ + Enter</span>
                </div>
                <span className="sr-only" role="status">
                  {announcement}
                </span>
              </form>
            </>
          ) : (
            <div className="messenger-empty messenger-start">
              <MessageCircle size={38} strokeWidth={1.5} />
              <h2>Выберите диалог</h2>
              <p>Сообщения и действия появятся здесь.</p>
            </div>
          )}
        </div>
      </section>
      {pendingDelete && chat && (
        <Modal
          title="Удалить сообщение клуба?"
          subtitle="В демочате останется отметка об удалении. Текст сообщения будет убран из переписки."
          onClose={closeDelete}
        >
          <blockquote className="message-delete-preview">{pendingDelete.text}</blockquote>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeDelete}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                try {
                  put('chats', deleteClientMessage(chat, pendingDelete.id));
                  if (editing?.id === pendingDelete.id) setEditing(null);
                  closeDelete();
                  setAnnouncement('Сообщение удалено.');
                  setError('');
                } catch (problem) {
                  closeDelete();
                  setError(
                    problem instanceof Error ? problem.message : 'Не удалось удалить сообщение.',
                  );
                }
              }}
            >
              Удалить сообщение
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
