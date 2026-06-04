export function startOfDay(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  );
}

export function startOfWeek(value: Date): Date {
  const date = startOfDay(value);
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  return date;
}

export function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function normalizeBillingMonthStartDay(day: number): number {
  if (!Number.isFinite(day)) {
    return 1;
  }

  return Math.max(1, Math.min(31, Math.trunc(day)));
}

function makeBillingMonthStart(year: number, month: number, day: number): Date {
  const normalizedDay = normalizeBillingMonthStartDay(day);
  return new Date(
    year,
    month,
    Math.min(normalizedDay, daysInMonth(year, month)),
    0,
    0,
    0,
    0
  );
}

export function startOfBillingMonth(value: Date, startDay: number): Date {
  const currentStart = makeBillingMonthStart(
    value.getFullYear(),
    value.getMonth(),
    startDay
  );
  if (value >= currentStart) {
    return currentStart;
  }

  return makeBillingMonthStart(value.getFullYear(), value.getMonth() - 1, startDay);
}

export function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

export function subtractDays(value: Date, days: number): Date {
  return new Date(value.getTime() - days * 24 * 60 * 60_000);
}

export function minutesBetween(left: Date, right: Date): number {
  return Math.round((right.getTime() - left.getTime()) / 60_000);
}
