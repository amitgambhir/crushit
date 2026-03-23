// Hand-maintained types matching the Supabase schema in migrations/001_initial_schema.sql.
// Run `npx supabase gen types typescript` to auto-generate once the project is linked.

export type Role = 'parent' | 'kid';
export type TaskStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';
export type Recurrence = 'once' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly';
export type TaskCategory = 'chores' | 'school' | 'personal' | 'health' | 'creative' | 'kindness' | 'custom';
export type RewardCategory = 'screen_time' | 'food' | 'outing' | 'toy' | 'privilege' | 'experience' | 'custom';
export type StreakType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RedemptionStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';
export type EventType =
  | 'task_completed'
  | 'reward_redeemed'
  | 'streak_milestone'
  | 'badge_earned'
  | 'level_up'
  | 'points_awarded'
  | 'crush_drop'
  | 'task_rejected'
  | 'redemption_rejected'
  | 'redemption_fulfilled';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  family_id: string | null;
  display_name: string;
  username: string | null;
  role: Role;
  avatar_url: string | null;
  avatar_emoji: string;
  total_points: number;
  lifetime_points: number;
  level: number;
  xp: number;
  date_of_birth: string | null;
  color_theme: string;
  created_at: string;
  last_active: string;
  push_token: string | null;
  // pin_hash is never returned to the client
}

export interface TaskTemplate {
  id: string;
  family_id: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  icon: string;
  default_points: number;
  estimated_minutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  family_id: string;
  template_id: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  icon: string;
  points: number;
  due_date: string | null;
  recurrence: Recurrence | null;
  recurrence_day: number | null;
  status: TaskStatus;
  requires_photo_proof: boolean;
  proof_photo_url: string | null;
  proof_note: string | null;
  completed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface RewardTemplate {
  id: string;
  family_id: string | null;
  title: string;
  description: string | null;
  category: RewardCategory;
  icon: string;
  cost_points: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Reward {
  id: string;
  family_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  category: RewardCategory;
  icon: string;
  cost_points: number;
  available_to: string[] | null;
  quantity_available: number | null;
  quantity_redeemed: number;
  is_surprise: boolean;
  surprise_reveal_at_points: number | null;
  is_active: boolean;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Redemption {
  id: string;
  reward_id: string;
  kid_id: string;
  points_spent: number;
  status: RedemptionStatus;
  parent_note: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

export interface Streak {
  id: string;
  kid_id: string;
  family_id: string;
  streak_type: StreakType;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  streak_start_date: string | null;
  updated_at: string;
}

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  badge_color: string;
  category: 'milestone' | 'streak' | 'tasks' | 'special';
  condition_type: string;
  condition_value: number;
}

export interface KidAchievement {
  id: string;
  kid_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface ActivityLog {
  id: string;
  family_id: string;
  user_id: string | null;
  event_type: EventType;
  title: string;
  body: string | null;
  points_delta: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
