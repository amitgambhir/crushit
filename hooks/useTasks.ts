import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Task, TaskCategory, TaskTemplate } from '@/lib/database.types';

interface CreateTaskData {
  templateId?: string;
  assignedTo?: string | null;   // null = open / claimable
  title: string;
  description?: string;
  category: TaskCategory;
  icon: string;
  points: number;
  dueDate?: string | null;
  recurrence?: string | null;
  recurrenceDay?: number | null;
  requiresPhotoProof?: boolean;
}

// Tasks with the assigned kid's profile joined
export type TaskWithAssignee = Task & {
  assignee: { id: string; display_name: string; avatar_emoji: string; color_theme: string } | null;
};

export function useTasks(filter?: { status?: string; assignedTo?: string; category?: TaskCategory }) {
  const { family } = useAuthStore();

  return useQuery({
    queryKey: ['tasks', family?.id, filter],
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select('*, assignee:profiles!assigned_to(id, display_name, avatar_emoji, color_theme)')
        .eq('family_id', family!.id)
        .order('created_at', { ascending: false });

      if (filter?.status) q = q.eq('status', filter.status);
      if (filter?.assignedTo) q = q.eq('assigned_to', filter.assignedTo);
      if (filter?.category) q = q.eq('category', filter.category);

      const { data, error } = await q;
      if (error) throw error;
      return data as TaskWithAssignee[];
    },
    enabled: !!family?.id,
  });
}

export function useTaskDetail(taskId: string) {
  const { family } = useAuthStore();
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!assigned_to(id, display_name, avatar_emoji, color_theme)')
        .eq('id', taskId)
        .single();
      if (error) throw error;
      return data as TaskWithAssignee;
    },
    enabled: !!taskId,
  });
}

export function useTaskTemplates() {
  const { family } = useAuthStore();
  return useQuery({
    queryKey: ['task-templates', family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .or(`family_id.is.null,family_id.eq.${family!.id}`)
        .eq('is_active', true)
        .order('category')
        .order('title');
      if (error) throw error;
      return data as TaskTemplate[];
    },
    enabled: !!family?.id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { family, profile } = useAuthStore();

  return useMutation({
    mutationFn: async (data: CreateTaskData) => {
      const { error } = await supabase.from('tasks').insert({
        family_id: family!.id,
        template_id: data.templateId ?? null,
        assigned_to: data.assignedTo ?? null,
        assigned_by: profile!.id,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        icon: data.icon,
        points: data.points,
        due_date: data.dueDate ?? null,
        recurrence: data.recurrence ?? 'once',
        recurrence_day: data.recurrenceDay ?? null,
        requires_photo_proof: data.requiresPhotoProof ?? false,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', family?.id] });
    },
  });
}

// Called by parent to approve a submitted task — routes through the approve_task() Postgres RPC (AD-001).
// Caller identity is resolved from auth.uid() server-side; no p_parent_id needed (migration 014).
export function useApproveTask() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.rpc('approve_task', { p_task_id: taskId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['kids', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['activity', family?.id] });
    },
  });
}

export function useRejectTask() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) => {
      // Routes through reject_task() RPC — caller identity from auth.uid() (migration 014).
      const { error } = await supabase.rpc('reject_task', { p_task_id: taskId, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', family?.id] });
    },
  });
}

// Called by kid to submit a completed task.
// Routes through the submit_task() RPC so status update, completed_at, proof
// fields, and the task_submitted activity_log row are written atomically —
// symmetric with how approve_task() works on the parent side.
export function useSubmitTask() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      taskId,
      proofNote,
      proofPhotoUrl,
    }: {
      taskId: string;
      proofNote?: string;
      proofPhotoUrl?: string;
    }) => {
      const { error } = await supabase.rpc('submit_task', {
        p_task_id:         taskId,
        p_proof_note:      proofNote      ?? null,
        p_proof_photo_url: proofPhotoUrl  ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', family?.id] });
    },
  });
}

export function useAwardCrushDrop() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async ({ kidId, points, reason }: { kidId: string; points: number; reason: string }) => {
      // Caller identity from auth.uid() server-side (migration 014).
      const { error } = await supabase.rpc('award_crush_drop', {
        p_kid_id: kidId,
        p_points: points,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['activity', family?.id] });
    },
  });
}
