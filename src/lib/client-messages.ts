import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';

export type DeliveryStatus = 'sent' | 'delivered' | 'read';
export type ChatMessage = {
  id: string;
  sender: 'club' | 'client';
  text: string;
  createdAt: string;
  delivery?: DeliveryStatus;
  editedAt?: string;
  deletedAt?: string;
};
export const deliveryLabels: Record<DeliveryStatus, string> = {
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
};
const validDate = (value: unknown): value is string =>
  typeof value === 'string' && !!value && Number.isFinite(new Date(value).getTime());
export function messageTime(value: string) {
  return validDate(value)
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Время не указано';
}
export function messageDate(value: string) {
  return validDate(value)
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(value))
    : 'Ранее';
}

export function findClientChat(chats: DemoRecord[], memberId: number): DemoRecord | undefined {
  return chats.find((chat) => chat.memberId === String(memberId) && chat.channel === 'Поддержка');
}

export function clientChatDraft(member: Pick<Member, 'id' | 'name'>): DemoRecord {
  return {
    id: `chat-client-${member.id}`,
    memberId: String(member.id),
    name: member.name,
    channel: 'Поддержка',
    preview: 'Переписка не начата',
    messages: '',
    status: 'Новый диалог',
    time: '',
  };
}

export function readChatMessages(chat: DemoRecord): ChatMessage[] {
  if (chat.entries) {
    try {
      const entries: unknown = JSON.parse(chat.entries);
      if (Array.isArray(entries)) {
        const ids = new Set<string>();
        return entries.flatMap((entry, index) => {
          if (!entry || typeof entry !== 'object') return [];
          const row = entry as Record<string, unknown>;
          if ((row.sender !== 'club' && row.sender !== 'client') || typeof row.text !== 'string')
            return [];
          const deletedAt = validDate(row.deletedAt) ? row.deletedAt : undefined;
          let id = typeof row.id === 'string' && row.id ? row.id : `${chat.id}:message:${index}`;
          while (ids.has(id)) id += `:${index}`;
          ids.add(id);
          return [
            {
              id,
              sender: row.sender,
              text: deletedAt ? '' : row.text,
              createdAt: validDate(row.createdAt) ? row.createdAt : '',
              ...(row.sender === 'club' &&
              ['sent', 'delivered', 'read'].includes(String(row.delivery))
                ? { delivery: row.delivery as DeliveryStatus }
                : {}),
              ...(validDate(row.editedAt) ? { editedAt: row.editedAt } : {}),
              ...(deletedAt ? { deletedAt } : {}),
            } as ChatMessage,
          ];
        });
      }
    } catch {
      // Existing demo conversations use a legacy text history.
    }
  }
  const messages: ChatMessage[] = [];
  for (const line of (chat.messages || '').split('\n')) {
    if (!line.trim()) continue;
    const match = /^(Клуб|Клиент):\s?(.*)$/.exec(line);
    if (match)
      messages.push({
        id: `${chat.id}:legacy:${messages.length}`,
        sender: match[1] === 'Клуб' ? 'club' : 'client',
        text: match[2],
        createdAt: '',
      });
    else if (messages.length) messages[messages.length - 1].text += `\n${line}`;
    else
      messages.push({
        id: `${chat.id}:legacy:${messages.length}`,
        sender: 'client',
        text: line,
        createdAt: '',
      });
  }
  return messages;
}

function checkedText(text: string) {
  const body = text.trim();
  if (!body) throw new Error('Напишите сообщение.');
  if (body.length > 2000) throw new Error('Сообщение должно быть не длиннее 2000 символов.');
  return body;
}
function withMessages(chat: DemoRecord, entries: ChatMessage[]): DemoRecord {
  const last = entries.at(-1);
  return {
    ...chat,
    entries: JSON.stringify(entries),
    messages: entries
      .map(
        (entry) =>
          `${entry.sender === 'club' ? 'Клуб' : 'Клиент'}: ${entry.deletedAt ? 'Сообщение удалено' : entry.text}`,
      )
      .join('\n'),
    preview: last ? (last.deletedAt ? 'Сообщение удалено' : last.text) : 'Переписка не начата',
    time: last?.createdAt ? messageTime(last.createdAt) : chat.time || '',
  };
}
export function appendClientMessage(chat: DemoRecord, text: string, now = new Date()): DemoRecord {
  const body = checkedText(text);
  return {
    ...withMessages(chat, [
      ...readChatMessages(chat),
      {
        id: `message-${crypto.randomUUID()}`,
        sender: 'club',
        text: body,
        createdAt: now.toISOString(),
        delivery: 'sent',
      },
    ]),
    status: 'В работе',
  };
}
function editableMessage(entries: ChatMessage[], id: string) {
  const message = entries.find((entry) => entry.id === id);
  if (!message) throw new Error('Сообщение больше не найдено.');
  if (message.sender !== 'club') throw new Error('Можно изменять только сообщения клуба.');
  if (message.deletedAt) throw new Error('Сообщение уже удалено.');
  return message;
}
export function editClientMessage(
  chat: DemoRecord,
  id: string,
  text: string,
  now = new Date(),
): DemoRecord {
  const entries = readChatMessages(chat);
  editableMessage(entries, id);
  const body = checkedText(text);
  return withMessages(
    chat,
    entries.map((entry) =>
      entry.id === id ? { ...entry, text: body, editedAt: now.toISOString() } : entry,
    ),
  );
}
export function deleteClientMessage(chat: DemoRecord, id: string, now = new Date()): DemoRecord {
  const entries = readChatMessages(chat);
  editableMessage(entries, id);
  return withMessages(
    chat,
    entries.map((entry) =>
      entry.id === id ? { ...entry, text: '', deletedAt: now.toISOString() } : entry,
    ),
  );
}
