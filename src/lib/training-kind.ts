export type TrainingKind = 'group' | 'personal';

/** The declared training directions take priority over the card's visual category. */
export function supportsTraining(
  pass: { training?: string; kindId?: string },
  kind: TrainingKind,
): boolean {
  const training = pass.training?.trim().toLocaleLowerCase('ru');
  return training
    ? training.includes(kind === 'personal' ? 'персональ' : 'группов')
    : pass.kindId === kind;
}
