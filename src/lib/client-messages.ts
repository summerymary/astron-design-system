import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';

export type ChatMessage = { sender: 'club' | 'client'; text: string };

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
      if (Array.isArray(entries))
        return entries.filter(
          (entry): entry is ChatMessage =>
            !!entry &&
            typeof entry === 'object' &&
            (entry.sender === 'club' || entry.sender === 'client') &&
            typeof entry.text === 'string',
        );
    } catch {
      // Existing demo conversations use a legacy text history.
    }
  }
  const messages: ChatMessage[] = [];
  for (const line of (chat.messages || '').split('\n')) {
    if (!line.trim()) continue;
    const match = /^(Клуб|Клиент):\s?(.*)$/.exec(line);
    if (match) messages.push({ sender: match[1] === 'Клуб' ? 'club' : 'client', text: match[2] });
    else if (messages.length) messages[messages.length - 1].text += `\n${line}`;
    else messages.push({ sender: 'client', text: line });
  }
  return messages;
}

export function appendClientMessage(chat: DemoRecord, text: string): DemoRecord {
  const body = text.trim();
  if (!body) throw new Error('Напишите сообщение.');
  if (body.length > 2000) throw new Error('Сообщение должно быть не длиннее 2000 символов.');
  const entries: ChatMessage[] = [...readChatMessages(chat), { sender: 'club', text: body }];
  return {
    ...chat,
    entries: JSON.stringify(entries),
    messages: entries
      .map((entry) => `${entry.sender === 'club' ? 'Клуб' : 'Клиент'}: ${entry.text}`)
      .join('\n'),
    preview: body,
    status: 'В работе',
    time: 'Сейчас',
  };
}
