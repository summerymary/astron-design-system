import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/client-messages.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { findClientChat, clientChatDraft, readChatMessages, appendClientMessage } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
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
assert.deepEqual(readChatMessages(original), [
  { sender: 'client', text: 'Здравствуйте!' },
  { sender: 'club', text: 'Добрый день.' },
]);
const draft = clientChatDraft({ id: 1006, name: 'Алексей Морозов' });
assert.equal(draft.id, clientChatDraft({ id: 1006, name: 'Другое имя' }).id);
assert.equal(draft.memberId, '1006');
assert.deepEqual(readChatMessages(draft), []);
const body = 'Первая строка\nКлиент: это часть одного исходящего сообщения';
const sent = appendClientMessage(original, `  ${body}  `);
assert.deepEqual(readChatMessages(sent), [
  ...readChatMessages(original),
  { sender: 'club', text: body },
]);
assert.equal(sent.id, original.id);
assert.equal(sent.memberId, original.memberId);
assert.equal(sent.status, 'В работе');
assert.equal(sent.important, 'true');
assert.equal(sent.unread, 'true');
assert.deepEqual(original, copy, 'Sending does not mutate previous history');
const first = appendClientMessage(draft, 'Первое сообщение');
assert.equal(first.id, draft.id);
assert.deepEqual(readChatMessages(first), [{ sender: 'club', text: 'Первое сообщение' }]);
const second = appendClientMessage(first, 'Второе сообщение');
assert.equal(readChatMessages(second).length, 2);
assert.equal(readChatMessages(first).length, 1);
assert.throws(() => appendClientMessage(draft, '  \n  '), /Напишите/);
assert.throws(() => appendClientMessage(draft, 'а'.repeat(2001)), /2000/);
assert.equal(readChatMessages(appendClientMessage(draft, 'а'.repeat(2000)))[0].text.length, 2000);
console.log(
  'Client messaging checks passed: recipient IDs, existing/draft chats, multiline history, validation and immutable updates.',
);
