// supabase/functions/_shared/recurringTaskHelpers.ts
// Pure helper functions for the generate-recurring-tasks Edge Function.
// Imported by both the Deno Edge Function and Jest tests (via lib/ re-export).

export type Recurrence = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly';

/**
 * Computes the next due date for a recurring task given a reference date.
 * Returns a YYYY-MM-DD string (UTC).
 */
export function nextDueDate(recurrence: Recurrence, fromDate: Date): string {
  const d = new Date(fromDate);
  d.setUTCHours(0, 0, 0, 0);

  switch (recurrence) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      break;

    case 'weekdays': {
      do {
        d.setUTCDate(d.getUTCDate() + 1);
      } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
      break;
    }

    case 'weekends': {
      do {
        d.setUTCDate(d.getUTCDate() + 1);
      } while (d.getUTCDay() >= 1 && d.getUTCDay() <= 5);
      break;
    }

    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;

    case 'monthly': {
      const targetDay = d.getUTCDate();
      const nextMonth = d.getUTCMonth() + 1;
      const year      = nextMonth > 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
      const month     = nextMonth > 11 ? 0 : nextMonth;
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      d.setUTCFullYear(year, month, Math.min(targetDay, daysInMonth));
      break;
    }
  }

  return d.toISOString().slice(0, 10);
}

/**
 * Returns true when a task's status should trigger a new recurring instance.
 * Only 'approved' and 'expired' terminal states spawn the next task.
 */
export function shouldGenerate(status: string): boolean {
  return status === 'approved' || status === 'expired';
}
