import { supabase } from "@/integrations/supabase/client";

const PLAN_LIMITS: Record<string, number> = {
  free: 100,
  organizer: 100,
  pro: 300,
  corporate: 999999,
};

/**
 * Get remaining registration slots for the organizer of a given event.
 * Uses a security-definer DB function so it works for unauthenticated users too.
 */
export async function getRemainingSlots(eventId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_organizer_remaining_slots", {
    event_uuid: eventId,
  });
  if (error) {
    console.error("Failed to check registration limit:", error);
    return 0;
  }
  return (data as number) ?? 0;
}

/**
 * Get remaining slots for an organizer by userId (for authenticated organizer paths).
 * Counts all registrations across all their events.
 */
export async function getRemainingSlotsByOrganizer(userId: string): Promise<{
  remaining: number;
  plan: string;
  total: number;
  limit: number;
}> {
  // Get organizer plan
  const { data: prof } = await supabase
    .from("organizer_profiles")
    .select("subscription_plan")
    .eq("user_id", userId)
    .single();

  const plan = prof?.subscription_plan || "free";
  const limit = PLAN_LIMITS[plan] ?? 100;

  // Get all events for this organizer
  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("organizer_id", userId);

  if (!events || events.length === 0) {
    return { remaining: limit, plan, total: 0, limit };
  }

  // Count all registrations across all events
  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .in("event_id", events.map((e) => e.id));

  const total = count || 0;
  const remaining = Math.max(limit - total, 0);

  return { remaining, plan, total, limit };
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

export function getPlanLimit(plan: string): number {
  return PLAN_LIMITS[plan] ?? 100;
}

/**
 * Check if organizer's subscription is expired based on their latest event end date.
 * Returns true if expired (all events have ended and subscription_expires_at is in the past).
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

  const now = new Date();
  const expiryDate = new Date(expiresAt);
  const expired = expiryDate < now;

  // Get the latest event date for context
  const { data: latestEvent } = await supabase
    .from("events")
    .select("date, duration")
    .eq("organizer_id", userId)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  return {
    expired,
    expiresAt,
    latestEventDate: latestEvent?.date || null,
  };
}
