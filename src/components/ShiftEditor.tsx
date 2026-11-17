import { useState } from 'react';
import type { DemoRecord, Field } from '../data/workspace';
import { demoId, useWorkspace } from './WorkspaceProvider';
import { FieldControl } from './WorkspaceUI';
import { Button, Modal } from './ui';
import { SHIFT_WORKPLACES, shiftHours, shiftProblem } from '../lib/shifts';

export function ShiftEditor({
  initial,
  employee,
  onClose,
  onSaved,
}: {
  initial: DemoRecord;
  employee?: DemoRecord;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { data, put } = useWorkspace();
  const [draft, setDraft] = useState<DemoRecord>({ ...initial, id: initial.id || demoId('shift') });
  const [error, setError] = useState('');
  const employees = data.employees.filter(
    (row) => row.status === 'Активен' || row.id === draft.employeeId,
  );
  const receptions = data.receptions.filter(
    (row) => row.club === draft.club && row.status === 'Активен',
  );
  const fields: Field[] = [
    {
      key: 'name',
      label: 'Администратор',
      options: employee
        ? [employee.name]
        : employees
            .filter(
              (row) =>
                row.position?.toLocaleLowerCase('ru').includes('администратор') ||
                row.id === draft.employeeId,
            )
            .map((row) => row.name),
      required: true,
    },
    { key: 'club', label: 'Клуб', options: data.clubs.map((row) => row.name), required: true },
    {
      key: 'reception',
      label: 'Ресепшен',
      options: receptions.map((row) => row.name),
      required: true,
    },
    { key: 'workplace', label: 'Рабочее место', options: SHIFT_WORKPLACES, required: true },
    { key: 'start', label: 'Начало', type: 'datetime-local', required: true },
    { key: 'end', label: 'Окончание', type: 'datetime-local', required: true },
  ];
  return (
    <Modal title={initial.id ? 'Изменить смену' : 'Добавить смену'} onClose={onClose}>
      <form
        className="ws-form"
        onSubmit={(event) => {
          event.preventDefault();
          const record: DemoRecord = {
            ...draft,
            name: employee?.name || draft.name,
            employeeId:
              employee?.id || data.employees.find((row) => row.name === draft.name)?.id || '',
          };
          const problem = shiftProblem(record, data.shifts);
          if (problem) {
            setError(problem);
            return;
          }
          if (
            !data.receptions.some(
              (row) => row.club === record.club && row.name === record.reception,
            )
          ) {
            setError('Выберите ресепшен выбранного клуба.');
            return;
          }
          put('shifts', {
            ...record,
            hours: String(shiftHours(record)),
            rate: record.rate || '250',
            status: record.status || 'Запланирована',
          });
          onSaved?.();
          onClose();
        }}
      >
        <div className="ws-fields">
          {fields.map((field) => (
            <FieldControl
              key={field.key}
              field={field}
              value={draft[field.key] || ''}
              onChange={(value) => {
                setDraft((previous) => ({
                  ...previous,
                  [field.key]: value,
                  ...(field.key === 'club'
                    ? {
                        reception:
                          data.receptions.find(
                            (row) => row.club === value && row.status === 'Активен',
                          )?.name || '',
                      }
                    : {}),
                }));
                setError('');
              }}
            />
          ))}
        </div>
        <p className="muted">
          Два администратора могут работать одновременно на разных местах. При передаче компьютера
          конец одной смены совпадает с началом следующей.
        </p>
        {error && (
          <p className="ws-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">Сохранить смену</Button>
        </div>
      </form>
    </Modal>
  );
}
