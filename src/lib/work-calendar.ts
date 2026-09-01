// Work Calendar - manages weekends and holidays for working-day calculations

export interface Holiday {
  date: string; // ISO format YYYY-MM-DD
  name: string;
}

export interface WorkCalendarConfig {
  excludeSaturday: boolean;
  excludeSunday: boolean;
  holidays: Holiday[];
}

export const defaultWorkCalendar: WorkCalendarConfig = {
  excludeSaturday: true,
  excludeSunday: true,
  holidays: [],
};

/** Check if a date is a non-working day */
export function isNonWorkingDay(date: Date, config: WorkCalendarConfig): boolean {
  const day = date.getDay();
  if (config.excludeSaturday && day === 6) return true;
  if (config.excludeSunday && day === 0) return true;
  const iso = toISODateString(date);
  return config.holidays.some(h => h.date === iso);
}

/** Get the next working day on or after the given date */
export function nextWorkingDay(date: Date, config: WorkCalendarConfig): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  while (isNonWorkingDay(d, config)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Add working days to a date. If workingDays is 0, returns the same date (snapped to working day). */
export function addWorkingDays(startDate: Date, workingDays: number, config: WorkCalendarConfig): Date {
  let d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  // Snap start to working day
  d = nextWorkingDay(d, config);

  if (workingDays <= 0) return d;

  let remaining = workingDays;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (!isNonWorkingDay(d, config)) {
      remaining--;
    }
  }
  return d;
}

/** Count working days between two dates (exclusive of end) */
export function getWorkingDaysDuration(start: Date, end: Date, config: WorkCalendarConfig): number {
  if (end <= start) return 0;
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endTime = new Date(end);
  endTime.setHours(0, 0, 0, 0);
  while (d < endTime) {
    d.setDate(d.getDate() + 1);
    if (!isNonWorkingDay(d, config)) {
      count++;
    }
  }
  return count;
}

function toISODateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Get holiday name for a date, or null */
export function getHolidayName(date: Date, config: WorkCalendarConfig): string | null {
  const iso = toISODateString(date);
  const h = config.holidays.find(h => h.date === iso);
  return h?.name ?? null;
}
