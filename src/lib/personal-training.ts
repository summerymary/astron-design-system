import type { DemoRecord } from '../data/workspace';

export type PersonalTrainer = {
  id: string;
  name: string;
  categoryId: string;
  category: string;
  lessonPrice: number;
  club: string;
};
export function personalTrainers(data: Record<string, DemoRecord[]>): PersonalTrainer[] {
  return (data['trainer-profiles'] || []).flatMap((profile) => {
    const category = (data['trainer-categories'] || []).find(
      (row) => row.id === profile.categoryId,
    );
    const employee = (data.employees || []).find(
      (row) => row.name === profile.name && row.status === 'Активен',
    );
    return category && employee && profile.status === 'Активен'
      ? [
          {
            id: profile.id,
            name: profile.name,
            categoryId: category.id,
            category: category.name,
            lessonPrice: Number(category.lessonPrice),
            club: employee.club,
          },
        ]
      : [];
  });
}
export function clientTrainers(
  data: Record<string, DemoRecord[]>,
  memberId: number,
): PersonalTrainer[] {
  const assigned = (data['personal-clients'] || []).filter(
    (row) => row.memberId === String(memberId),
  );
  return personalTrainers(data).filter((trainer) =>
    assigned.some((row) => row.trainerId === trainer.id),
  );
}
export function personalBooking(event: DemoRecord, data: Record<string, DemoRecord[]>): DemoRecord {
  if (event.kind !== 'personal') return event;
  const trainer = personalTrainers(data).find(
    (row) => row.id === event.trainerId || row.name === event.trainer,
  );
  return {
    ...event,
    trainerId: trainer?.id || event.trainerId,
    trainerCategory: trainer?.categoryId || event.trainerCategory || '',
  };
}
export function requiresTrainingBooking(pass: { training?: string; kindId?: string }): boolean {
  const training = pass.training?.trim().toLocaleLowerCase('ru');
  if (training)
    return (
      !training.includes('тренаж') &&
      (training.includes('персональ') || training.includes('группов'))
    );
  return pass.kindId === 'personal' || pass.kindId === 'group';
}
