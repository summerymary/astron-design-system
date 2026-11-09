import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function moduleURL(url) {
  let code = ts.transpileModule(await readFile(url, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  for (const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    code = code.replace(match[0], `from '${await moduleURL(new URL(match[1] + '.ts', url))}'`);
  }
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const {
  findClientChat,
  clientChatDraft,
  readChatMessages,
  appendClientMessage,
  editClientMessage,
  deleteClientMessage,
  messageTime,
} = await import(await moduleURL(new URL('../src/lib/client-messages.ts', import.meta.url)));
const original = {
  id: 'chat-1',
  memberId: '1001',
  name: 'Анна Смирнова',
  channel: 'Поддержка',
  messages: 'Клиент: Здравствуйте!\nКлуб: Добрый день.',
  status: 'Решено',
  important: 'true',
  unread: 'true',
};
const copy = structuredClone(original);
assert.equal(findClientChat([original], 1001), original);
assert.equal(findClientChat([original], 1002), undefined);
assert.equal(
  findClientChat([{ ...original, memberId: '1002' }], 1001),
  undefined,
  'Names do not identify recipients',
);
assert.equal(findClientChat([{ ...original, channel: 'Telegram' }], 1001), undefined);
const renamed = { ...original, name: 'Новое имя' };
assert.equal(findClientChat([renamed], 1001), renamed);
const content = (chat) => readChatMessages(chat).map(({ sender, text }) => ({ sender, text }));
assert.deepEqual(content(original), [
  { sender: 'client', text: 'Здравствуйте!' },
  { sender: 'club', text: 'Добрый день.' },
]);
const draft = clientChatDraft({ id: 1006, name: 'Алексей Морозов' });
assert.equal(draft.id, clientChatDraft({ id: 1006, name: 'Другое имя' }).id);
assert.equal(draft.memberId, '1006');
assert.deepEqual(readChatMessages(draft), []);
const body = 'Первая строка\nКлиент: это часть одного исходящего сообщения';
const sent = appendClientMessage(original, `  ${body}  `);
assert.deepEqual(content(sent), [...content(original), { sender: 'club', text: body }]);
assert.equal(sent.id, original.id);
assert.equal(sent.memberId, original.memberId);
assert.equal(sent.status, 'В работе');
assert.equal(sent.important, 'true');
assert.equal(sent.unread, 'true');
assert.deepEqual(original, copy, 'Sending does not mutate previous history');
const first = appendClientMessage(draft, 'Первое сообщение');
assert.equal(first.id, draft.id);
assert.deepEqual(content(first), [{ sender: 'club', text: 'Первое сообщение' }]);
const second = appendClientMessage(first, 'Второе сообщение');
assert.equal(readChatMessages(second).length, 2);
assert.equal(readChatMessages(first).length, 1);
assert.throws(() => appendClientMessage(draft, '  \n  '), /Напишите/);
assert.throws(() => appendClientMessage(draft, 'а'.repeat(2001)), /2000/);
assert.equal(readChatMessages(appendClientMessage(draft, 'а'.repeat(2000)))[0].text.length, 2000);
const firstEntry = readChatMessages(first)[0];
assert.ok(firstEntry.id);
assert.ok(Number.isFinite(Date.parse(firstEntry.createdAt)));
assert.equal(firstEntry.delivery, 'sent', 'Local send does not invent a delivery or read receipt');
assert.notEqual(readChatMessages(second)[1].id, firstEntry.id);
assert.equal(
  readChatMessages(original)[0].createdAt,
  '',
  'Unknown legacy times are not fabricated',
);
assert.equal(readChatMessages(original)[0].delivery, undefined);
assert.equal(messageTime('2026-11-06T10:05:00Z'), '13:05');
assert.equal(messageTime(''), 'Время не указано');
const editTime = new Date('2026-11-09T10:00:00Z');
const edited = editClientMessage(second, firstEntry.id, '  Новый текст\nс переносом  ', editTime);
const editedEntry = readChatMessages(edited)[0];
assert.equal(editedEntry.text, 'Новый текст\nс переносом');
assert.equal(editedEntry.id, firstEntry.id);
assert.equal(editedEntry.createdAt, firstEntry.createdAt);
assert.equal(editedEntry.delivery, firstEntry.delivery);
assert.equal(editedEntry.editedAt, editTime.toISOString());
assert.equal(readChatMessages(second)[0].text, 'Первое сообщение', 'Editing is immutable');
assert.equal(readChatMessages(edited)[1].text, 'Второе сообщение');
assert.throws(() => editClientMessage(second, firstEntry.id, ' \n '), /Напишите/);
assert.throws(() => editClientMessage(second, firstEntry.id, 'а'.repeat(2001)), /2000/);
assert.throws(
  () => editClientMessage(original, readChatMessages(original)[0].id, 'Подмена'),
  /только сообщения клуба/,
);
assert.throws(
  () => deleteClientMessage(original, readChatMessages(original)[0].id),
  /только сообщения клуба/,
);
assert.throws(() => editClientMessage(second, 'missing', 'Текст'), /не найдено/);
const deleted = deleteClientMessage(edited, firstEntry.id, editTime);
assert.equal(readChatMessages(deleted)[0].text, '');
assert.equal(readChatMessages(deleted)[0].deletedAt, editTime.toISOString());
assert.equal(readChatMessages(deleted)[0].createdAt, firstEntry.createdAt);
assert.ok(
  !deleted.entries.includes('Новый текст') && !deleted.messages.includes('Новый текст'),
  'Deletion removes original text from both representations',
);
assert.equal(readChatMessages(edited)[0].text, editedEntry.text, 'Deletion is immutable');
assert.throws(() => editClientMessage(deleted, firstEntry.id, 'Вернуть'), /уже удалено/);
assert.throws(() => deleteClientMessage(deleted, firstEntry.id), /уже удалено/);
const deletedLast = deleteClientMessage(second, readChatMessages(second)[1].id);
assert.equal(deletedLast.preview, 'Сообщение удалено');
const editedLast = editClientMessage(
  original,
  readChatMessages(original)[1].id,
  'Обновлённый ответ',
);
assert.equal(editedLast.preview, 'Обновлённый ответ');
assert.equal(editedLast.status, 'Решено');
assert.equal(editedLast.important, 'true');
assert.equal(editedLast.unread, 'true');
const statusEntries = ['sent', 'delivered', 'read'].map((delivery, index) => ({
  id: String(index),
  sender: 'club',
  text: 'Ответ',
  createdAt: editTime.toISOString(),
  delivery,
}));
assert.deepEqual(
  readChatMessages({ ...draft, entries: JSON.stringify(statusEntries) }).map(
    (entry) => entry.delivery,
  ),
  ['sent', 'delivered', 'read'],
);
const duplicate = {
  ...draft,
  entries: JSON.stringify([
    { id: 'same', sender: 'club', text: 'Свой' },
    { id: 'same', sender: 'client', text: 'Чужой' },
  ]),
};
const uniqueEntries = readChatMessages(duplicate);
assert.notEqual(uniqueEntries[0].id, uniqueEntries[1].id);
assert.equal(
  readChatMessages(editClientMessage(duplicate, uniqueEntries[0].id, 'Изменён'))[1].text,
  'Чужой',
);
console.log(
  'Client messaging checks passed: recipient IDs, stable entries, delivery states, timestamps, own-message editing/deletion, legacy history, validation and immutable updates.',
);
