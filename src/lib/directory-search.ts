export type SearchableDirectoryRecord = {
  id: string;
  title: string;
  details: string;
};
export type SearchableDirectory = {
  id: string;
  title: string;
  description: string;
  group: string;
  keywords?: string;
  records: SearchableDirectoryRecord[];
};
export function searchWords(value: string): string[] {
  return (
    value
      .toLocaleLowerCase('ru')
      .replace(/ё/g, 'е')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}
export function matchesSearch(text: string, query: string): boolean {
  const searchable = searchWords(text).join(' ');
  return searchWords(query).every((word) => searchable.includes(word));
}
export function directorySnippet(details: string, query: string): string {
  const parts = details.split(' · ');
  const words = searchWords(query);
  const relevant = parts.filter((part) => words.some((word) => matchesSearch(part, word)));
  const chosen = relevant.length ? relevant : parts;
  return chosen.slice(0, 3).join(' · ') + (chosen.length > 3 ? '…' : '');
}
export function searchDirectories(entries: SearchableDirectory[], query: string) {
  if (!searchWords(query).length) return [];
  return entries.flatMap((entry) => {
    const context = [entry.title, entry.description, entry.group, entry.keywords].join(' ');
    const records = entry.records.filter((row) =>
      matchesSearch(`${context} ${row.title} ${row.details}`, query),
    );
    return records.length || matchesSearch(context, query) ? [{ ...entry, records }] : [];
  });
}
