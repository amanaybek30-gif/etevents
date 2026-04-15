/**
 * Deduplicate registrations: if the same email appears multiple times for the same event,
 * keep only one record (prefer approved > pending > rejected, then latest created_at).
 */
export function deduplicateRegistrations<T extends { email: string; event_id: string; status?: string; created_at?: string }>(
  regs: T[]
): T[] {
  const STATUS_PRIORITY: Record<string, number> = { approved: 3, pending: 2, rejected: 1 };
  const map = new Map<string, T>();

  for (const r of regs) {
    const key = `${r.email.toLowerCase()}::${r.event_id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
      continue;
    }
    // Prefer higher-priority status
    const newPri = STATUS_PRIORITY[r.status || ""] || 0;
    const oldPri = STATUS_PRIORITY[existing.status || ""] || 0;
    if (newPri > oldPri || (newPri === oldPri && (r.created_at || "") > (existing.created_at || ""))) {
      map.set(key, r);
    }
  }

  return Array.from(map.values());
}
