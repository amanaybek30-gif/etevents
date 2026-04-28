import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users, UserCheck, BarChart3, UserPlus, Copy, Trash2, Shield,
  Clock, TrendingUp, AlertCircle, Upload
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";

interface Props {
  userId: string;
  userPlan?: string;
  subscriptionEnabled?: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  access_token: string;
  is_active: boolean;
  event_id: string;
  created_at: string;
}

interface StaffStat {
  staffId: string;
  staffName: string;
  count: number;
}

interface TimelineBucket {
  time: string;
  count: number;
}

const StaffCheckinDashboard = ({ userId, userPlan = "free", subscriptionEnabled = false }: Props) => {
  const staffLimit = userPlan === "corporate" ? Infinity : 1; // Pro = 1 staff, Corporate = unlimited
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);

  // Staff management
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffEvent, setNewStaffEvent] = useState("");
  const [importingStaff, setImportingStaff] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    const { data: evs } = await supabase.from("events").select("id, title").eq("organizer_id", userId);
    if (!evs || evs.length === 0) { setLoading(false); return; }
    setEvents(evs);

    const ids = selectedEvent === "all" ? evs.map(e => e.id) : [selectedEvent];

    // Fetch registrations
    const { data: regs } = await supabase.from("registrations")
      .select("checked_in_by, checked_in, checked_in_at, status")
      .in("event_id", ids);

    // Fetch staff
    const { data: staffData } = await supabase.from("event_staff")
      .select("*")
      .eq("organizer_id", userId) as { data: StaffMember[] | null };
    if (staffData) setStaffList(staffData);

    const staffMap = new Map<string, string>();
    if (staffData) {
      staffData.forEach(s => {
        // Map user_id to staff name - the checked_in_by stores the user_id of whoever checked in
        // For staff using tokens, we track by the organizer_id or staff record
      });
    }

    if (regs) {
      const approved = regs.filter(r => r.status === "approved");
      setTotalApproved(approved.length);
      const checkedIn = regs.filter(r => r.checked_in);
      setTotalCheckins(checkedIn.length);

      // Staff stats
      const statMap: Record<string, number> = {};
      checkedIn.forEach(r => {
        const staffId = (r as any).checked_in_by || "unknown";
        statMap[staffId] = (statMap[staffId] || 0) + 1;
      });

      // Resolve staff names
      const stats: StaffStat[] = Object.entries(statMap).map(([id, count]) => {
        const staff = staffData?.find(s => s.id === id || s.access_token === id);
        return {
          staffId: id,
          staffName: staff?.name || (id === "unknown" ? "Untracked (legacy)" : id === userId ? "You (Organizer)" : `Staff ${id.substring(0, 6)}...`),
          count,
        };
      });
      stats.sort((a, b) => b.count - a.count);
      setStaffStats(stats);

      // Timeline - group by 15-min intervals
      const timeMap: Record<string, number> = {};
      checkedIn.forEach(r => {
        const at = (r as any).checked_in_at;
        if (!at) return;
        const d = new Date(at);
        const mins = Math.floor(d.getMinutes() / 15) * 15;
        const key = `${d.getHours().toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
        timeMap[key] = (timeMap[key] || 0) + 1;
      });
      const sorted = Object.entries(timeMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, count]) => ({ time, count }));
      setTimeline(sorted);
    }
    setLoading(false);
  }, [userId, selectedEvent]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (events.length === 0) return;
    const channel = supabase
      .channel('staff-checkin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [events, fetchData]);

  const fuzzyMatch = (header: string, targets: string[]) => {
    const h = header.toLowerCase().replace(/[^a-z]/g, "");
    return targets.some(t => h.includes(t));
  };

  const handleImportStaff = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newStaffEvent) { toast.error("Select an event first before importing"); e.target.value = ""; return; }

    setImportingStaff(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rows.length === 0) { toast.error("File is empty"); setImportingStaff(false); return; }

      const headers = Object.keys(rows[0]);
      const nameCol = headers.find(h => fuzzyMatch(h, ["name", "fullname", "staffname"]));
      const emailCol = headers.find(h => fuzzyMatch(h, ["email", "mail"]));
      const phoneCol = headers.find(h => fuzzyMatch(h, ["phone", "mobile", "tel", "cell"]));

      if (!nameCol) { toast.error("Could not find a 'Name' column in the file"); setImportingStaff(false); return; }
      if (!emailCol && !phoneCol) { toast.error("Need at least an 'Email' or 'Phone' column"); setImportingStaff(false); return; }

      const staffToInsert = rows
        .filter(r => String(r[nameCol]).trim())
        .map(r => ({
          event_id: newStaffEvent,
          organizer_id: userId,
          name: String(r[nameCol]).trim().slice(0, 200),
          email: emailCol ? String(r[emailCol]).trim().toLowerCase() || null : null,
          phone: phoneCol ? String(r[phoneCol]).trim() || null : null,
        }))
        .filter(s => s.email || s.phone);

      if (staffToInsert.length === 0) { toast.error("No valid staff rows found"); setImportingStaff(false); return; }

      // Enforce staff limit per plan
      const existingStaff = staffList.filter(s => s.event_id === newStaffEvent && s.is_active);
      const allowed = subscriptionEnabled ? Math.max(staffLimit - existingStaff.length, 0) : staffToInsert.length;
      if (allowed === 0) {
        toast.error(staffLimit === 1
          ? "Pro plan allows only 1 check-in staff per event. Upgrade to Corporate for unlimited."
          : "Staff limit reached for this event.");
        setImportingStaff(false);
        return;
      }
      const limitedInsert = staffToInsert.slice(0, allowed);

      const { data: inserted, error } = await supabase
        .from("event_staff")
        .insert(limitedInsert as any)
        .select();

      if (error) { toast.error("Failed to import staff"); console.error(error); setImportingStaff(false); return; }

      toast.success(`${inserted?.length || 0} staff members imported!`);

      // Send invite emails to all staff with emails
      if (inserted) {
        for (const s of inserted as any[]) {
          if (s.email) {
            const checkinUrl = `${window.location.origin}/staff-checkin/${s.access_token}`;
            supabase.functions.invoke("send-staff-invite-email", {
              body: { staffId: s.id, checkinUrl },
            }).catch(err => console.error("Email send failed for", s.name, err));
          }
        }
        const emailCount = (inserted as any[]).filter(s => s.email).length;
        if (emailCount > 0) toast.success(`Invite emails being sent to ${emailCount} staff members`);
      }

      fetchData();
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Failed to read the file");
    } finally {
      setImportingStaff(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) { toast.error("Staff name is required"); return; }
    if (!newStaffEmail.trim() && !newStaffPhone.trim()) { toast.error("Email or phone is required"); return; }
    if (!newStaffEvent) { toast.error("Select an event"); return; }

    // Enforce staff limit per plan
    const eventStaff = staffList.filter(s => s.event_id === newStaffEvent && s.is_active);
    if (subscriptionEnabled && eventStaff.length >= staffLimit) {
      toast.error(staffLimit === 1
        ? "Pro plan allows only 1 check-in staff per event. Upgrade to Corporate for unlimited."
        : "Staff limit reached for this event.");
      return;
    }

    const { data: inserted, error } = await supabase.from("event_staff").insert({
      event_id: newStaffEvent,
      organizer_id: userId,
      name: newStaffName.trim(),
      email: newStaffEmail.trim() || null,
      phone: newStaffPhone.trim() || null,
    } as any).select().single();

    if (error || !inserted) { toast.error("Failed to add staff"); return; }
    toast.success(`${newStaffName} added as check-in staff!`);

    // Send invite email automatically if staff has an email
    const staffEmail = newStaffEmail.trim();
    if (staffEmail) {
      const checkinUrl = `${window.location.origin}/staff-checkin/${(inserted as any).access_token}`;
      supabase.functions.invoke("send-staff-invite-email", {
        body: { staffId: (inserted as any).id, checkinUrl },
      }).then(({ error: emailErr }) => {
        if (emailErr) {
          console.error("Failed to send staff invite email:", emailErr);
          toast.error("Staff added but invite email failed to send");
        } else {
          toast.success(`Invite email sent to ${staffEmail}`);
        }
      });
    }

    setNewStaffName(""); setNewStaffEmail(""); setNewStaffPhone("");
    setAddingStaff(false);
    fetchData();
  };

  const removeStaff = async (id: string) => {
    await supabase.from("event_staff").delete().eq("id", id);
    toast.success("Staff removed");
    fetchData();
  };

  const copyStaffLink = (staff: StaffMember) => {
    const event = events.find(e => e.id === staff.event_id);
    const url = `${window.location.origin}/staff-checkin/${staff.access_token}`;
    navigator.clipboard.writeText(url);
    toast.success(`Check-in link copied for ${staff.name}!`);
  };

  const attendanceRate = totalApproved > 0 ? ((totalCheckins / totalApproved) * 100) : 0;

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Multi-Staff Check-In Dashboard
        </h3>
        <p className="text-sm text-muted-foreground">
          Manage check-in staff, track performance, and monitor real-time arrival statistics across all entrances.
        </p>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-foreground">{totalCheckins}</p>
          <p className="text-xs text-muted-foreground">Total Check-ins</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-foreground">{totalApproved}</p>
          <p className="text-xs text-muted-foreground">Registered</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-primary">{attendanceRate}%</p>
          <p className="text-xs text-muted-foreground">Attendance Rate</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-primary">{staffList.filter(s => s.is_active).length}</p>
          <p className="text-xs text-muted-foreground">Active Staff</p>
        </div>
      </div>

      {/* Event Filter */}
      {events.length > 1 && (
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-[220px] border-border bg-secondary"><SelectValue placeholder="Filter event" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {/* Staff Management */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Check-In Staff
          </h3>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportStaff}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-border"
              disabled={importingStaff}
              onClick={() => {
                if (!newStaffEvent && events.length > 0) {
                  setAddingStaff(true);
                  toast.error("Select an event first, then import");
                  return;
                }
                fileInputRef.current?.click();
              }}
            >
              <Upload className="h-4 w-4 mr-1" /> {importingStaff ? "Importing..." : "Import Staff"}
            </Button>
            <Button size="sm" onClick={() => setAddingStaff(!addingStaff)} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
              <UserPlus className="h-4 w-4 mr-1" /> Add Staff
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Each staff member gets a unique check-in link. They can scan QR codes, search attendees, and mark attendance — but cannot edit event settings.
        </p>

        {addingStaff && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground">Event *</Label>
              <Select value={newStaffEvent} onValueChange={setNewStaffEvent}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Staff Name *</Label>
              <Input value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="e.g. Sara Kebede" className="border-border bg-secondary" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">Email</Label>
                <Input value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} placeholder="sara@example.com" className="border-border bg-secondary" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Phone</Label>
                <Input value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} placeholder="+251..." className="border-border bg-secondary" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddStaff} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Add Staff</Button>
              <Button variant="outline" onClick={() => setAddingStaff(false)} className="border-border">Cancel</Button>
            </div>
          </div>
        )}

        {staffList.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No staff added yet. Add staff to enable multi-entrance check-in.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staffList.map(staff => {
              const event = events.find(e => e.id === staff.event_id);
              return (
                <div key={staff.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{staff.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {staff.email || staff.phone} · {event?.title || "Unknown event"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => copyStaffLink(staff)} title="Copy check-in link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeStaff(staff.id)} title="Remove staff">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Staff Performance */}
      {staffStats.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Staff Performance
          </h3>
          <div className="space-y-2">
            {staffStats.map((stat, index) => {
              const percentage = totalCheckins > 0 ? ((stat.count / totalCheckins) * 100) : 0;
              return (
                <div key={stat.staffId} className="rounded-lg border border-border bg-secondary/50 p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground text-sm">{stat.staffName}</span>
                      <span className="font-display text-lg font-bold text-foreground">{stat.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{percentage}% of total check-ins</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Check-in Timeline */}
      {timeline.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Arrival Timeline (15-min intervals)
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }}
                  labelFormatter={(v) => `Time: ${v}`}
                  formatter={(v: number) => [`${v} check-ins`, ""]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Peak time */}
          {timeline.length > 0 && (() => {
            const peak = timeline.reduce((max, t) => t.count > max.count ? t : max, timeline[0]);
            return (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Peak arrival: <strong className="text-foreground">{peak.time}</strong> with <strong className="text-foreground">{peak.count}</strong> check-ins</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Entry Statistics Table */}
      {timeline.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Entry Statistics
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Time</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Check-ins</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((t, i) => {
                  const cumulative = timeline.slice(0, i + 1).reduce((sum, b) => sum + b.count, 0);
                  return (
                    <tr key={t.time} className="border-b border-border/50">
                      <td className="py-2 px-3 text-foreground font-mono">{t.time}</td>
                      <td className="py-2 px-3 text-right text-foreground">{t.count}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{cumulative}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffCheckinDashboard;
