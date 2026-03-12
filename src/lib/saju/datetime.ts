export function composeBirthDateTime(
  birthDate: string,
  birthTime: string | null | undefined,
  birthTimeUnknown: boolean
): Date {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = birthDate
    .split('-')
    .map((value) => Number(value));
  const effectiveTime = birthTimeUnknown ? '12:00' : (birthTime ?? '00:00');
  const [hour = Number.NaN, minute = Number.NaN] = effectiveTime
    .split(':')
    .map((value) => Number(value));

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return new Date(Number.NaN);
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

export function toBirthDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toBirthTime(date: Date): string {
  return date.toISOString().slice(11, 16);
}
