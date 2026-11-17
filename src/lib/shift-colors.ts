import type { DemoRecord } from '../data/workspace';

// Employee identity colours, independent of shift status and the club theme.
export const SHIFT_STAFF_COLORS = [
  '#376AA3',
  '#2C806C',
  '#8660A9',
  '#AD6540',
  '#A34F77',
  '#637A35',
  '#487D91',
  '#7769B1',
] as const;

const normalize = (name: string) =>
  name.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');

export function shiftStaffKey(row: DemoRecord, employees: DemoRecord[]) {
  return (
    row.employeeId ||
    employees.find((employee) => normalize(employee.name) === normalize(row.name))?.id ||
    normalize(row.name)
  );
}

/** Use the complete roster/history, never just the current search results. */
export function shiftStaffColors(employees: DemoRecord[], allShifts: DemoRecord[]) {
  const staffKeys = [...new Set(allShifts.map((row) => shiftStaffKey(row, employees)))].sort();
  const keys = [
    ...staffKeys,
    ...employees
      .map((employee) => employee.id)
      .filter((key) => !staffKeys.includes(key))
      .sort(),
  ];
  const used = new Set<number>();
  return new Map(
    keys.map((key, position) => {
      let hash = 2166136261;
      for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
      let index = position % SHIFT_STAFF_COLORS.length;
      while (used.has(index) && used.size < SHIFT_STAFF_COLORS.length)
        index = (index + 1) % SHIFT_STAFF_COLORS.length;
      used.add(index);
      const color =
        position < SHIFT_STAFF_COLORS.length
          ? SHIFT_STAFF_COLORS[index]
          : `hsl(${hash % 360} 48% 43%)`;
      return [key, color];
    }),
  );
}
