export type ReportTreeNode = {
  id: string;
  name: string;
  note?: string;
  values: Record<string, number | null>;
  children?: ReportTreeNode[];
};
export type ReportTreeSort = { key: string; asc: boolean };
export function sortReportTree(nodes: ReportTreeNode[], sort: ReportTreeSort): ReportTreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? sortReportTree(node.children, sort) : undefined,
    }))
    .sort((a, b) => {
      if (sort.key === 'name') return (sort.asc ? 1 : -1) * a.name.localeCompare(b.name, 'ru');
      const av = a.values[sort.key] ?? null,
        bv = b.values[sort.key] ?? null;
      if (av === null || bv === null)
        return av === bv ? a.name.localeCompare(b.name, 'ru') : av === null ? 1 : -1;
      return (sort.asc ? av - bv : bv - av) || a.name.localeCompare(b.name, 'ru');
    });
}
export function flattenReportTree(
  nodes: ReportTreeNode[],
  path: string[] = [],
): { node: ReportTreeNode; path: string[] }[] {
  return nodes.flatMap((node) => [
    { node, path: [...path, node.name] },
    ...flattenReportTree(node.children || [], [...path, node.name]),
  ]);
}
