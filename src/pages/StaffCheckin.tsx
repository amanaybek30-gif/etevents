import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera, Search, UserCheck, AlertTriangle, CheckCircle2,
  WifiOff, Wifi, Loader2, Shield, Smartphone
} from "lucide-react";
import SEO from "@/components/SEO";

interface OfflineCheckin {
  ticketId: string;
  timestamp: string;
}

const OFFLINE_QUEUE_KEY = "staff_checkin_offline_queue";
const SESSION_KEY = "staff_session_id";
const HEARTBEAT_INTERVAL = 15000;

function detectDeviceType(): "mobile" | "desktop" {
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    if (window.innerWidth >= 768) return "desktop";
    return "mobile";
  }
  return "desktop";
}

function generateSessionId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/** Extract ticket ID from scanned QR content — handles raw IDs, labels, and URLs */
function extractTicketId(scannedText: string): string {
  const cleaned = scannedText
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐‑‒–—−]/g, "-")
    .trim();

  let decoded = cleaned;
  try {
    decoded = decodeURIComponent(cleaned);
  } catch {
    // keep original when not URL-encoded
  }

  const ticketMatch = decoded.match(/TKT[^A-Z0-9]*([A-Z0-9]{6,})/i);
  if (ticketMatch) return `TKT-${ticketMatch[1].toUpperCase()}`;

  try {
    const url = new URL(decoded);
    const ticketParam = url.searchParams.get("ticket") || url.searchParams.get("ticketId") || "";
    if (ticketParam) return extractTicketId(ticketParam);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return extractTicketId(last);
  } catch {
    // not a URL
  }

  const compact = decoded.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.startsWith("TKT") && compact.length > 6) {
    return `TKT-${compact.slice(3)}`;
  }

  return decoded.toUpperCase();
}

const StaffCheckin = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventId, setEventId] = useState("");

  // Scanner
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [manualTicketId, setManualTicketId] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Status
  const [lastResult, setLastResult] = useState<{
    type: "success" | "duplicate" | "error";
    name: string;
    message: string;
    time?: string;
  } | null>(null);

  // Stats
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [myCheckins, setMyCheckins] = useState(0);
  const [recentCheckins, setRecentCheckins] = useState<{ name: string; time: string; ticketId: string }[]>([]);

  // Offline
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineCheckin[]>([]);
  const [syncing, setSyncing] = useState(false);

  const sessionIdRef = useRef<string>("");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceType = useRef(detectDeviceType());

  // Session management
  const registerSession = useCallback(async (staffToken: string): Promise<boolean> => {
    const myDevice = deviceType.current;
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    sessionIdRef.current = sessionId;

    if (myDevice === "mobile") {
      const { data: existing } = await supabase
        .from("staff_sessions")
        .select("id, session_id, last_heartbeat")
        .eq("staff_token", staffToken)
        .eq("device_type", "mobile");

      if (existing && existing.length > 0) {
        const now = Date.now();
        const active = existing.filter(
          s => s.session_id !== sessionId && (now - new Date(s.last_heartbeat).getTime()) < 30000
        );
        if (active.length > 0) return false;
        const staleIds = existing.filter(
          s => s.session_id !== sessionId && (now - new Date(s.last_heartbeat).getTime()) >= 30000
        ).map(s => s.id);
        if (staleIds.length > 0) {
          await supabase.from("staff_sessions").delete().in("id", staleIds);
        }
      }
    }

    const { data: myExisting } = await supabase
      .from("staff_sessions")
      .select("id")
      .eq("staff_token", staffToken)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (myExisting) {
      await supabase.from("staff_sessions").update({ last_heartbeat: new Date().toISOString() }).eq("id", myExisting.id);
    } else {
      if (myDevice === "mobile") {
        await supabase.from("staff_sessions").delete().eq("staff_token", staffToken).eq("device_type", "mobile");
      }
      await supabase.from("staff_sessions").insert({
        staff_token: staffToken,
        session_id: sessionId,
        device_type: myDevice,
      });
    }
    return true;
  }, []);

  const sendHeartbeat = useCallback(async (staffToken: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    await supabase.from("staff_sessions")
      .update({ last_heartbeat: new Date().toISOString() })
      .eq("staff_token", staffToken)
      .eq("session_id", sessionId);

    if (deviceType.current === "mobile") {
      const { data: mySessions } = await supabase
        .from("staff_sessions")
        .select("id")
        .eq("staff_token", staffToken)
        .eq("session_id", sessionId);
      if (!mySessions || mySessions.length === 0) {
        setSessionBlocked(true);
        setAuthorized(false);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      }
    }
  }, []);

  // Fetch stats via RPC
  const fetchStats = useCallback(async (staffToken: string) => {
    const { data, error } = await supabase.rpc("staff_get_event_stats", { p_access_token: staffToken });
    if (error || !data || data.length === 0) return;
    const row = data[0];
    setTotalApproved(Number(row.total_approved) || 0);
    setCheckedInCount(Number(row.total_checked_in) || 0);
    setMyCheckins(Number((row as any).my_checkins) || 0);
    const recent = (row.recent_checkins as any[] || []).map((r: any) => ({
      name: r.name,
      ticketId: r.ticketId,
      time: r.time ? new Date(r.time).toLocaleTimeString() : "",
    }));
    setRecentCheckins(recent);
  }, []);

  // Authorize by token
  useEffect(() => {
    const authorize = async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase.from("event_staff")
        .select("*")
        .eq("access_token", token)
        .eq("is_active", true)
        .single() as { data: any };

      if (!data) { setLoading(false); return; }

      const allowed = await registerSession(token);
      if (!allowed) { setSessionBlocked(true); setLoading(false); return; }

      setStaffName(data.name);
      setEventId(data.event_id);
      setAuthorized(true);

      const { data: ev } = await supabase.from("events").select("title").eq("id", data.event_id).single();
      if (ev) setEventTitle(ev.title);

      await fetchStats(token);

      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) setOfflineQueue(JSON.parse(stored));

      heartbeatRef.current = setInterval(() => sendHeartbeat(token), HEARTBEAT_INTERVAL);
      setLoading(false);
    };
    authorize();

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (token && sessionIdRef.current) {
        supabase.from("staff_sessions").delete()
          .eq("staff_token", token).eq("session_id", sessionIdRef.current).then(() => {});
      }
    };
  }, [token]);

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && !syncing) syncOfflineQueue();
  }, [isOnline, offlineQueue.length]);

  // Realtime
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel('staff-portal-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations' }, () => {
        if (token) fetchStats(token);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, token, fetchStats]);

  const checkIn = async (rawInput: string) => {
    const ticketId = extractTicketId(rawInput);
    if (!ticketId) return;

    if (!isOnline) {
      const newQueue = [...offlineQueue, { ticketId, timestamp: new Date().toISOString() }];
      setOfflineQueue(newQueue);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
      setLastResult({ type: "success", name: ticketId, message: "Queued for sync (offline mode)" });
      toast.info("Saved offline — will sync when internet reconnects");
      return;
    }

    // Use RPC for check-in
    const { data, error } = await supabase.rpc("staff_checkin_attendee", {
      p_access_token: token || "",
      p_ticket_id: ticketId,
    });

    if (error || !data || data.length === 0) {
      setLastResult({ type: "error", name: "", message: "Check-in failed" });
      toast.error("Check-in failed");
      return;
    }

    const result = data[0];

    if (result.result_status === "error") {
      setLastResult({ type: "error", name: result.attendee_name || "", message: result.message });
      toast.error(result.message);
      return;
    }

    if (result.result_status === "duplicate") {
      const checkedAt = result.checked_in_time ? new Date(result.checked_in_time).toLocaleTimeString() : "earlier";
      setLastResult({
        type: "duplicate",
        name: result.attendee_name,
        message: `Already checked in at ${checkedAt}`,
        time: checkedAt,
      });
      toast.error(`⚠ Already checked in at ${checkedAt}`);
      return;
    }

    // Success
    setLastResult({ type: "success", name: result.attendee_name, message: "Successfully checked in!" });
    toast.success(`✓ ${result.attendee_name} checked in!`);

    // Fire and forget check-in email
    supabase.functions.invoke("send-checkin-email", { body: { ticketId } }).catch(() => {});

    // Refresh stats
    if (token) fetchStats(token);
    setSearchResults([]);
    setSearchQuery("");
  };

  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    setSyncing(true);
    let synced = 0;
    let failed = 0;

    for (const item of offlineQueue) {
      try {
        const { data } = await supabase.rpc("staff_checkin_attendee", {
          p_access_token: token || "",
          p_ticket_id: item.ticketId,
        });
        if (data?.[0]?.result_status === "success") synced++;
        else failed++;
      } catch { failed++; }
    }

    setOfflineQueue([]);
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    setSyncing(false);
    toast.success(`Synced ${synced} offline check-ins${failed > 0 ? `, ${failed} failed` : ""}`);
    if (token) fetchStats(token);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !token) return;
    const { data } = await supabase.rpc("staff_search_attendees", {
      p_access_token: token,
      p_query: searchQuery.trim(),
    });
    setSearchResults(data || []);
  };

  const startScanner = async () => {
    setScannerActive(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("staff-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => { scanner.stop(); setScannerActive(false); checkIn(text); },
          () => {}
        );
      } catch { toast.error("Camera access denied"); setScannerActive(false); }
    }, 100);
  };

  const stopScanner = () => { scannerRef.current?.stop().catch(() => {}); setScannerActive(false); };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sessionBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm text-center space-y-4">
          <Smartphone className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="font-display text-xl font-bold text-foreground">Session Active on Another Device</h1>
          <p className="text-sm text-muted-foreground">
            This check-in account is already being used on another mobile device. Only one mobile device can be active at a time.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="border-border">Retry</Button>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm text-center space-y-4">
          <Shield className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="font-display text-xl font-bold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground">This check-in link is invalid or has been deactivated.</p>
        </div>
      </div>
    );
  }

  const attendanceRate = totalApproved > 0 ? ((checkedInCount / totalApproved) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Staff Check-in" description="Check in attendees for your event" path={`/staff-checkin/${token}`} noindex />
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-base font-bold text-foreground">{eventTitle}</h1>
            <p className="text-xs text-muted-foreground">Staff: {staffName}</p>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-destructive" />}
            {offlineQueue.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{offlineQueue.length} queued</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
            <p className="font-display text-xl font-bold text-primary">{myCheckins}</p>
            <p className="text-[10px] text-muted-foreground">My Check-ins</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="font-display text-xl font-bold text-primary">{attendanceRate}%</p>
            <p className="text-[10px] text-muted-foreground">Attendance</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="font-display text-xl font-bold text-foreground">{checkedInCount}</p>
            <p className="text-[10px] text-muted-foreground">Total Checked In</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="font-display text-xl font-bold text-foreground">{totalApproved}</p>
            <p className="text-[10px] text-muted-foreground">Registered</p>
          </div>
        </div>

        {/* Last Result Banner */}
        {lastResult && (
          <div className={`rounded-xl p-4 flex items-start gap-3 ${
            lastResult.type === "success" ? "bg-green-500/10 border border-green-500/20" :
            lastResult.type === "duplicate" ? "bg-amber-500/10 border border-amber-500/20" :
            "bg-destructive/10 border border-destructive/20"
          }`}>
            {lastResult.type === "success" ? (
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            ) : lastResult.type === "duplicate" ? (
              <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-display font-bold text-foreground">
                {lastResult.type === "duplicate" ? "⚠ Already Checked In" : lastResult.type === "success" ? "✓ Check-In Successful" : "✗ Error"}
              </p>
              {lastResult.name && <p className="text-sm text-foreground">{lastResult.name}</p>}
              <p className="text-xs text-muted-foreground">{lastResult.message}</p>
            </div>
          </div>
        )}

        {/* Scanner */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Ticket ID..."
              value={manualTicketId}
              onChange={e => setManualTicketId(e.target.value)}
              className="border-border bg-secondary"
              onKeyDown={e => { if (e.key === "Enter") { checkIn(manualTicketId); setManualTicketId(""); } }}
            />
            <Button onClick={() => { checkIn(manualTicketId); setManualTicketId(""); }} className="bg-gradient-gold text-primary-foreground hover:opacity-90 shrink-0">
              <UserCheck className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full border-border hover:border-primary hover:text-primary"
            onClick={scannerActive ? stopScanner : startScanner}
          >
            <Camera className="mr-2 h-4 w-4" /> {scannerActive ? "Stop Scanner" : "Scan QR Code"}
          </Button>
          {scannerActive && (
            <div className="mx-auto max-w-sm overflow-hidden rounded-lg border border-primary/30">
              <div id="staff-qr-reader" className="w-full" />
            </div>
          )}
        </div>

        {/* Manual Search */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Search Attendee
          </h3>
          <p className="text-xs text-muted-foreground">Find by name, email, or phone number</p>
          <div className="flex gap-2">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
              className="border-border bg-secondary"
            />
            <Button onClick={handleSearch} variant="outline" className="border-border shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {searchResults.map((r: any) => (
                <div key={r.ticket_id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email} · {r.phone}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.ticket_id}</p>
                  </div>
                  {r.checked_in ? (
                    <span className="text-xs text-amber-500 shrink-0 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Checked in
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => checkIn(r.ticket_id)} className="bg-gradient-gold text-primary-foreground hover:opacity-90 h-8 shrink-0">
                      <UserCheck className="h-3 w-3 mr-1" /> Check In
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Offline Sync */}
        {offlineQueue.length > 0 && isOnline && (
          <Button onClick={syncOfflineQueue} disabled={syncing} className="w-full bg-gradient-gold text-primary-foreground">
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
            Sync {offlineQueue.length} Offline Check-ins
          </Button>
        )}

        {/* Recent Check-ins */}
        {recentCheckins.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-bold text-foreground">Recent Check-ins</h3>
            {recentCheckins.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{c.ticketId}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{c.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffCheckin;
