import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Modal } from './ui';
import { DataTable, FieldControl, Notice } from './WorkspaceUI';
import type { DemoRecord } from '../data/workspace';
import { addDays, dayText, eventTime, weekStart } from '../lib/schedule';
import { planWeekCopy } from '../lib/schedule-copy';
import '../styles/schedule-copy.css';

export function ScheduleCopyDialog({
  events,
  rooms,
  club,
  targetDay,
  onClose,
  onCopy,
}: {
  events: DemoRecord[];
  rooms: DemoRecord[];
  club: string;
  targetDay: string;
  onClose: () => void;
  onCopy: (sourceDay: string) => void;
}) {
  const week = weekStart(targetDay);
  const [copySource, setCopySource] = useState(addDays(week, -7));
  const copyPlan = planWeekCopy(events, rooms, club, copySource, week);
  const copyReady = copyPlan.items.filter((item) => !item.reason);
  return (
    <Modal
      size="wide"
      title="Копировать расписание недели"
      subtitle={`${club} · все залы`}
      onClose={onClose}
    >
      <div className="week-copy-body">
        <div className="ws-actions">
          <Button variant="secondary" onClick={() => setCopySource(addDays(week, -7))}>
            Предыдущая неделя
          </Button>
          <FieldControl
            field={{
              key: 'source-week',
              label: 'Любая дата исходной недели',
              type: 'date',
            }}
            value={copySource}
            onChange={setCopySource}
          />
        </div>
        <div className="week-copy-range">
          <div>
            <small>Откуда</small>
            <strong>
              {copyPlan.sourceWeek
                ? `${dayText(copyPlan.sourceWeek)} — ${dayText(addDays(copyPlan.sourceWeek, 6))}`
                : 'Выберите неделю'}
            </strong>
          </div>
          <ArrowRight size={20} aria-hidden="true" />
          <div>
            <small>Куда</small>
            <strong>
              {dayText(week)} — {dayText(addDays(week, 6))}
            </strong>
          </div>
        </div>
        <p>
          Копируются групповые занятия с теми же временем, залом и тренером. Существующее расписание
          сохраняется. Участники, резерв и отметки присутствия не переносятся.
        </p>
        {!!(copyPlan.excludedPersonal + copyPlan.excludedCancelled) && (
          <p className="week-copy-note">
            Не копируются: персональные записи — {copyPlan.excludedPersonal}, отменённые занятия —{' '}
            {copyPlan.excludedCancelled}.
          </p>
        )}
        {copyPlan.error ? (
          <Notice tone="warning">{copyPlan.error}</Notice>
        ) : (
          <>
            <p role="status">
              <strong>Будет добавлено: {copyReady.length}</strong> · пропущено:{' '}
              {copyPlan.items.length - copyReady.length}
            </p>
            <div className="week-copy-preview" aria-label="Предварительный просмотр копирования">
              <DataTable
                rows={copyPlan.items.map((item) => ({
                  ...item.record,
                  result: item.reason ? 'Пропущено' : 'Будет добавлено',
                  reason: item.reason || '',
                }))}
                columns={[
                  {
                    key: 'day',
                    label: 'Когда',
                    render: (row) => (
                      <>
                        <strong>{dayText(row.day, true)}</strong>
                        <p>{eventTime(row)}</p>
                      </>
                    ),
                  },
                  {
                    key: 'name',
                    label: 'Занятие',
                    render: (row) => (
                      <>
                        <strong>{row.name}</strong>
                        <p>
                          {row.room} · {row.trainer}
                        </p>
                      </>
                    ),
                  },
                  {
                    key: 'result',
                    label: 'Результат',
                    render: (row) => (
                      <>
                        <strong>{row.result}</strong>
                        {row.reason && <p>{row.reason}</p>}
                      </>
                    ),
                  },
                ]}
              />
            </div>
            {copyPlan.items.length !== copyReady.length && (
              <Notice tone="warning">
                Занятия с пересечениями по залу или тренеру, либо с неактуальными настройками, будут
                пропущены. Причина указана в каждой строке.
              </Notice>
            )}
          </>
        )}
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button disabled={!!copyPlan.error || !copyReady.length} onClick={() => onCopy(copySource)}>
          Копировать занятия · {copyReady.length}
        </Button>
      </div>
    </Modal>
  );
}
