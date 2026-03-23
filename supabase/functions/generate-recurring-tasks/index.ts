// supabase/functions/generate-recurring-tasks/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Daily cron Edge Function — runs at 00:10 UTC every day (after check-streaks).
// Scheduled via Supabase Dashboard → Edge Functions → generate-recurring-tasks
//   cron: "10 0 * * *"
//
// Responsibility:
//   Find recurring tasks (recurrence != 'once') that were last approved or
//   expired, compute the next due date, and create a new pending instance —
//   unless one already exists for that target period.
//
// Pure helpers live in lib/recurringTaskHelpers.ts so they can be tested by
// Jest without pulling in Deno-specific imports.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  nextDueDate,
  shouldGenerate,
  type Recurrence,
} from '../_shared/recurringTaskHelpers.ts';

export { nextDueDate, shouldGenerate };
export type { Recurrence };

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskRow {
  id:                   string;
  family_id:            string;
  assigned_to:          string | null;
  assigned_by:          string | null;
  title:                string;
  description:          string | null;
  category:             string;
  icon:                 string;
  points:               number;
  recurrence:           string;
  recurrence_day:       number | null;
  due_date:             string | null;
  status:               string;
  requires_photo_proof: boolean;
}

// ─── serve ───────────────────────────────────────────────────────────────────

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const results = {
    generated: 0,
    skipped:   0,
    errors:    [] as string[],
  };

  const { data: tasks, error: fetchErr } = await supabase
    .from('tasks')
    .select('*')
    .neq('recurrence', 'once')
    .in('status', ['approved', 'expired']);

  if (fetchErr) {
    return new Response(
      JSON.stringify({ ok: false, error: fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  for (const task of (tasks ?? []) as TaskRow[]) {
    if (!shouldGenerate(task.status)) continue;

    const fromDate   = task.due_date ? new Date(task.due_date) : today;
    const dueDateStr = nextDueDate(task.recurrence as Recurrence, fromDate);

    // Idempotency: check for existing pending/submitted task in the same slot.
    // Must use .is() for NULL assigned_to — .eq('assigned_to', '') never matches NULL rows.
    let idempotencyQuery = supabase
      .from('tasks')
      .select('id')
      .eq('family_id', task.family_id)
      .eq('title', task.title)
      .eq('due_date', dueDateStr)
      .in('status', ['pending', 'submitted']);

    idempotencyQuery = task.assigned_to === null
      ? idempotencyQuery.is('assigned_to', null)
      : idempotencyQuery.eq('assigned_to', task.assigned_to);

    const { data: existing } = await idempotencyQuery.maybeSingle();

    if (existing) {
      results.skipped++;
      continue;
    }

    const { error: insertErr } = await supabase.from('tasks').insert({
      family_id:            task.family_id,
      assigned_to:          task.assigned_to,
      assigned_by:          task.assigned_by,
      title:                task.title,
      description:          task.description,
      category:             task.category,
      icon:                 task.icon,
      points:               task.points,
      due_date:             dueDateStr,
      recurrence:           task.recurrence,
      recurrence_day:       task.recurrence_day,
      status:               'pending',
      requires_photo_proof: task.requires_photo_proof,
    });

    if (insertErr) {
      results.errors.push(`insert for task ${task.id}: ${insertErr.message}`);
    } else {
      results.generated++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, today: today.toISOString().slice(0, 10), ...results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
