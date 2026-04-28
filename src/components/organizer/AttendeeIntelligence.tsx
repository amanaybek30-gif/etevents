import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deduplicateRegistrations } from "@/lib/deduplicateRegistrations";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Users, BarChart3, Shield } from "lucide-react";
import type { AttendeeProfile, EventOption } from "./crm/types";
import InfoTooltip from "./InfoTooltip";
import CRMStatsCards from "./crm/CRMStatsCards";
import CRMTopSegments from "./crm/CRMTopSegments";
import CRMFilters from "./crm/CRMFilters";
import CRMTable from "./crm/CRMTable";
import CRMProfileModal from "./crm/CRMProfileModal";
import CRMEmailDialog from "./crm/CRMEmailDialog";
import CRMSmartLists from "./crm/CRMSmartLists";
import CRMAnalytics from "./crm/CRMAnalytics";

interface Props { userId: string; }

function computeEngagementScore(p: { totalRegistered: number; totalAttended: number; attendanceRate: number }): number {
  const freqScore = Math.min(p.totalAttended * 15, 40);
  const rateScore = (p.attendanceRate * 0.4);
  const consistencyScore = p.totalRegistered > 0 ? Math.min(((p.totalAttended / p.totalRegistered) * 20), 20) : 0;
  return Math.min(freqScore + rateScore + consistencyScore, 100);
}

const AttendeeIntelligence = ({ userId }: Props) => {
  const [profiles, setProfiles] = useState<AttendeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [eventFilter, setEventFilter] = useState("all_events");
  const [tagFilter, setTagFilter] = useState("all_tags");
  const [selectedProfile, setSelectedProfile] = useState<AttendeeProfile | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [allRegs, setAllRegs] = useState<{ email: string; event_id: string; checked_in: boolean; checked_in_at?: string | null; created_at: string; status: string }[]>([]);

  const fetchData = useCallback(async () => {
    const { data: eventsData } = await supabase.from("events").select("id, title, date").eq("organizer_id", userId);
    if (!eventsData || eventsData.length === 0) { setLoading(false); return; }

    setEvents(eventsData.map(e => ({ id: e.id, title: e.title, date: e.date })));
    const ids = eventsData.map(e => e.id);

    const [regsRes, storedRes, tagsRes, notesRes] = await Promise.all([
      supabase.from("registrations")
        .select("full_name, email, phone, event_id, status, checked_in, checked_in_at, created_at, custom_answers")
        .in("event_id", ids),
      supabase.from("attendee_profiles")
        .select("email, organization, job_title, phone")
        .eq("organizer_id", userId),
      supabase.from("attendee_tags")
        .select("attendee_email, tag")
        .eq("organizer_id", userId),
      supabase.from("attendee_notes")
        .select("id, attendee_email, note, created_at")
        .eq("organizer_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const rawRegs = regsRes.data || [];
    const regs = deduplicateRegistrations(rawRegs);
    const storedProfiles = storedRes.data || [];
    const tags = tagsRes.data || [];
    const notes = notesRes.data || [];

    // Build tag & note maps
    const tagMap: Record<string, string[]> = {};
    tags.forEach(t => {
      const key = t.attendee_email.toLowerCase();
      if (!tagMap[key]) tagMap[key] = [];
      tagMap[key].push(t.tag);
    });

    const noteMap: Record<string, { id: string; note: string; created_at: string }[]> = {};
    notes.forEach(n => {
      const key = n.attendee_email.toLowerCase();
      if (!noteMap[key]) noteMap[key] = [];
      noteMap[key].push({ id: n.id, note: n.note, created_at: n.created_at });
    });

    // Build stored profile metadata
    const profileMeta: Record<string, { organization?: string; job_title?: string; phone?: string }> = {};
    storedProfiles.forEach(sp => {
      profileMeta[sp.email.toLowerCase()] = {
        organization: sp.organization || undefined,
        job_title: sp.job_title || undefined,
        phone: sp.phone || undefined,
      };
    });

    const evMap = Object.fromEntries(eventsData.map(e => [e.id, { title: e.title, date: e.date }]));

    // Duplicate detection: merge by email OR phone
    const profileMap: Record<string, AttendeeProfile> = {};
    const phoneToEmail: Record<string, string> = {};
    const distinctEventSets: Record<string, Set<string>> = {};

    regs.forEach(r => {
      let key = r.email.toLowerCase();

      // Check for phone-based duplicate
      const normalizedPhone = r.phone?.replace(/[^0-9+]/g, "") || "";
      if (normalizedPhone && phoneToEmail[normalizedPhone] && phoneToEmail[normalizedPhone] !== key) {
        // Merge into existing profile
        const existingKey = phoneToEmail[normalizedPhone];
        if (profileMap[existingKey]) {
          key = existingKey;
          if (profileMap[key]) profileMap[key].isDuplicate = true;
        }
      }

      if (normalizedPhone) phoneToEmail[normalizedPhone] = key;

      if (!profileMap[key]) {
        const meta = profileMeta[key];
        let org = meta?.organization || "";
        let jobTitle = meta?.job_title || "";
        let city = "";
        if (!org && r.custom_answers && typeof r.custom_answers === "object") {
          const ca = r.custom_answers as Record<string, any>;
          org = ca.organization || ca.Organization || "";
          city = ca.city || ca.City || "";
        }
        profileMap[key] = {
          email: r.email,
          phone: r.phone,
          full_name: r.full_name,
          organization: org,
          job_title: jobTitle,
          city,
          totalRegistered: 0,
          totalAttended: 0,
          attendanceRate: 0,
          lastEvent: "",
          lastEventDate: "",
          engagementScore: 0,
          tags: tagMap[key] || [],
          notes: noteMap[key] || [],
          events: [],
          isDuplicate: false,
        };
      }

      const p = profileMap[key];
      p.totalRegistered++;
      if (r.checked_in) p.totalAttended++;
      const ev = evMap[r.event_id];
      // Track distinct events for returning attendee logic
      const dKey = `__dist_${key}`;
      if (!(dKey in distinctEventSets)) distinctEventSets[dKey] = new Set();
      distinctEventSets[dKey].add(r.event_id);
      if (ev) {
        p.events.push({ title: ev.title, date: ev.date, status: r.status, checkedIn: !!r.checked_in });
        if (!p.lastEventDate || ev.date > p.lastEventDate) {
          p.lastEvent = ev.title;
          p.lastEventDate = ev.date;
        }
      }
    });

    const allProfiles = Object.entries(profileMap).map(([key, p]) => {
      const dKey = `__dist_${key}`;
      const distinctEvents = distinctEventSets[dKey]?.size || 0;
      return {
        ...p,
        totalRegistered: distinctEvents, // Count distinct events, not total registrations
        attendanceRate: distinctEvents > 0 ? ((p.totalAttended / distinctEvents) * 100) : 0,
        engagementScore: computeEngagementScore({ ...p, totalRegistered: distinctEvents }),
      };
    }).sort((a, b) => b.engagementScore - a.engagementScore);

    setProfiles(allProfiles);
    setAllRegs((regs as any[]).map(r => ({ email: r.email, event_id: r.event_id, checked_in: !!r.checked_in, checked_in_at: r.checked_in_at || null, created_at: r.created_at, status: r.status })));

    // Update selected profile if open
    if (selectedProfile) {
      const updated = allProfiles.find(p => p.email.toLowerCase() === selectedProfile.email.toLowerCase());
      if (updated) setSelectedProfile(updated);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // All unique tags for filter
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    profiles.forEach(p => p.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [profiles]);

  const stats = useMemo(() => {
    const total = profiles.length;
    const totalRate = profiles.reduce((s, p) => s + p.attendanceRate, 0);
    const returning = profiles.filter(p => p.totalRegistered > 1).length;
    return {
      totalUnique: total,
      avgAttendance: total > 0 ? (totalRate / total) : 0,
      returningPct: total > 0 ? ((returning / total) * 100) : 0,
      firstTimePct: total > 0 ? 100 - ((returning / total) * 100) : 0,
    };
  }, [profiles]);

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.full_name.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q) && !p.phone.includes(q) && !p.organization.toLowerCase().includes(q))
          return false;
      }
      if (eventFilter !== "all_events") {
        const ev = events.find(e => e.id === eventFilter);
        if (ev && !p.events.some(pe => pe.title === ev.title)) return false;
      }
      if (tagFilter !== "all_tags") {
        if (!p.tags.includes(tagFilter)) return false;
      }
      switch (segment) {
        case "returning": return p.totalRegistered > 1;
        case "first_time": return p.totalRegistered === 1;
        case "frequent": return p.totalAttended >= 3;
        case "vip": return p.tags.includes("VIP");
        case "no_show": return p.totalRegistered > 0 && p.totalAttended === 0;
        case "high_engagement": return p.engagementScore >= 80;
        default: return true;
      }
    });
  }, [profiles, search, segment, eventFilter, tagFilter, events]);

  const exportExcel = () => {
    if (filtered.length === 0) { toast.error("No data to export"); return; }
    const wb = XLSX.utils.book_new();

    // Contacts sheet
    const contactData = filtered.map(p => ({
      "Full Name": p.full_name, Email: p.email, Phone: p.phone,
      Organization: p.organization, "Job Title": p.job_title, City: p.city || "",
      Tags: p.tags.join(", "),
      "Events Registered": p.totalRegistered, "Events Attended": p.totalAttended,
      "Attendance Rate": `${p.attendanceRate}%`, "Engagement Score": p.engagementScore,
      "Last Event": p.lastEvent,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contactData), "Contacts");

    // Event participation sheet
    const eventData: any[] = [];
    filtered.forEach(p => {
      p.events.forEach(ev => {
        eventData.push({ Name: p.full_name, Email: p.email, Event: ev.title, Date: ev.date, Status: ev.status, Attended: ev.checkedIn ? "Yes" : "No" });
      });
    });
    if (eventData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventData), "Participation History");

    XLSX.writeFile(wb, `CRM_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel exported!");
  };

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error("No data to export"); return; }
    const data = filtered.map(p => ({
      "Full Name": p.full_name, Email: p.email, Phone: p.phone,
      Organization: p.organization, "Job Title": p.job_title,
      Tags: p.tags.join(", "),
      "Registered": p.totalRegistered, "Attended": p.totalAttended,
      "Rate %": p.attendanceRate, "Engagement": p.engagementScore,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    XLSX.writeFile(wb, `CRM_Contacts_${new Date().toISOString().split("T")[0]}.csv`, { bookType: "csv" });
    toast.success("CSV exported!");
  };

  const applySmartList = (filters: any) => {
    if (filters.segment) setSegment(filters.segment);
    if (filters.eventFilter) setEventFilter(filters.eventFilter);
    if (filters.search !== undefined) setSearch(filters.search);
    toast.success("Smart list applied!");
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading attendee data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Attendee Intelligence (Event CRM)
          <InfoTooltip title="Attendee Intelligence (CRM)" description="Your unified attendee database across all events. Profiles are built automatically from registration data — showing event history, engagement scores, and attendance patterns. Use segments, tags, and smart lists to organize and communicate with your audience." />
        </h3>
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <BarChart3 className="h-4 w-4" /> {showAnalytics ? "Hide" : "Show"} CRM Analytics
        </button>
      </div>

      {/* Privacy notice */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
        <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">Data is private to your organization. Attendee data cannot be shared across organizers.</p>
      </div>

      <CRMStatsCards {...stats} />

      {showAnalytics && <CRMAnalytics profiles={profiles} events={events} registrations={allRegs} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CRMTopSegments profiles={profiles} />
        </div>
        <CRMSmartLists
          userId={userId}
          currentFilters={{ segment, eventFilter, search }}
          onApply={applySmartList}
        />
      </div>

      <CRMFilters
        search={search} onSearchChange={setSearch}
        segment={segment} onSegmentChange={setSegment}
        eventFilter={eventFilter} onEventFilterChange={setEventFilter}
        tagFilter={tagFilter} onTagFilterChange={setTagFilter}
        allTags={allTags}
        events={events} filteredCount={filtered.length}
        onExportExcel={exportExcel}
        onExportCSV={exportCSV}
        onSendInvites={() => setShowEmailDialog(true)}
      />

      <CRMTable profiles={filtered} onSelect={setSelectedProfile} />

      {selectedProfile && (
        <CRMProfileModal
          profile={selectedProfile}
          userId={userId}
          onClose={() => setSelectedProfile(null)}
          onUpdate={fetchData}
        />
      )}

      {showEmailDialog && (
        <CRMEmailDialog recipients={filtered} onClose={() => setShowEmailDialog(false)} />
      )}
    </div>
  );
};

export default AttendeeIntelligence;
