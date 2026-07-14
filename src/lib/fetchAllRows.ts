/**
 * Supabase PostgREST caps every query at 1000 rows by default. When an
 * organizer has more than 1000 registrations, `select(...)` silently
 * truncates the response — the client then computes stats and renders on
 * partial data, which both looks wrong and (because the truncated 1000-row
 * JSON is still huge) makes every dashboard feel laggy.
 *
 * `fetchAllRows` pages through the query in chunks so callers reliably get
 * the full dataset without hitting that hidden ceiling. Keep the chunk
 * comfortably under Supabase's hard limits (max_rows = 1000 by default).
 */
const CHUNK = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builder: any,
  hardCap = 50000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (from < hardCap) {
    const to = Math.min(from + CHUNK - 1, hardCap - 1);
    // Each call re-issues the underlying query with a new range.
    // The Supabase builder is thenable so we clone by re-invoking .range.
    const { data, error } = await builder.range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < CHUNK) break;
    from += CHUNK;
  }
  return rows;
}
