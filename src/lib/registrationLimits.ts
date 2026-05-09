import { supabase } from "@/integrations/supabase/client";

/**
 * Plan-based EVENT quotas (per yearly subscription).
 * Registrations are unlimited for every paid plan.
 */
const PLAN_EVENT_LIMITS: Record<string, number> = {
  free: 0,
  organizer: 1,
  pro: 3,
  corporate: 7,
};

/**
 * Backward compatibility: registrations are now unlimited.
 * Returns a very large number so legacy callers never block.
 */
export async function getRemainingSlots(_eventId: string): Promise<number> {
  return 999999;
}

/**
 * Backward compatibility for code that asked for remaining "slots" by organizer.
 * Returns unlimited registrations now.
 */
export async function getRemainingSlotsByOrganizer(_userId: string): Promise<{
  remaining: number;
  plan: string;
  total: number;
  limit: number;
}> {
  return { remaining: 999999, plan: "organizer", total: 0, limit: 999999 };
}

/**
 * Returns how many additional events the organizer can still create
 * within their current 1-year subscription period.
 */
export async function getRemainingEvents(userId: string): Promise<{
  remaining: number;
  plan: string;
  used: number;
  limit: number;
  expiresAt: string | null;
}> {
  const { data: prof } = await supabase
    .from("organizer_profiles")
    .select("subscription_plan, subscription_paid, subscription_expires_at")
    .eq("user_id", userId)
    .single();

  const plan = prof?.subscription_plan || "free";
  const limit = PLAN_EVENT_LIMITS[plan] ?? 0;
  const expiresAt = prof?.subscription_expires_at || null;

  if (!prof?.subscription_paid || !expiresAt || new Date(expiresAt) < new Date()) {
    return { remaining: 0, plan, used: 0, limit, expiresAt };
  }

  const periodStart = new Date(new Date(expiresAt).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", userId)
    .gte("created_at", periodStart);

  const used = count || 0;
  const remaining = Math.max(limit - used, 0);

  return { remaining, plan, used, limit, expiresAt };
}

export function getPlanLabel(plan: string): string {
  const labels: Record<string, string> = {
    free: "Free",
    organizer: "Organizer",
    pro: "Pro Organizer",
    corporate: "Corporate",
  };
  return labels[plan] || plan;
}

/** Number of events allowed per yearly subscription for a given plan. */
export function getPlanEventLimit(plan: string): number {
  return PLAN_EVENT_LIMITS[plan] ?? 0;
}

/** Backward-compatible alias — now returns the plan's EVENT limit. */
export function getPlanLimit(plan: string): number {
  return PLAN_EVENT_LIMITS[plan] ?? 0;
}

/**
 * Check if organizer's subscription is expired.
 */
export async function isSubscriptionExpired(userId: string): Promise<{
  expired: boolean;
  expiresAt: string | null;
  latestEventDate: string | null;
}> {
  const { data: prof } = await supabase
    .from("organizer_profiles")
    .select("subscription_expires_at, subscription_paid")
    .eq("user_id", userId)
    .single();

  if (!prof?.subscription_paid) {
    return { expired: true, expiresAt: null, latestEventDate: null };
  }

  const expiresAt = prof.subscription_expires_at;
  if (!expiresAt) {
    return { expired: false, expiresAt: null, latestEventDate: null };
  }

  const expired = new Date(expiresAt) < new Date();

  const { data: latestEvent } = await supabase
    .from("events")
    .select("date, duration")
    .eq("organizer_id", userId)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  return { expired, expiresAt, latestEventDate: latestEvent?.date || null };
}
