import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, CreditCard, AlertTriangle, Clock, XCircle, TrendingUp, CheckCircle, UserPlus, Send, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { AdminSection } from "./AdminSidebar";

interface Props { onNavigate: (s: AdminSection) => void; }

const AdminDashboard = ({ onNavigate }: Props) => {
  const [stats, setStats] = useState({ totalEvents: 0, totalRegistrations: 0, pendingPayments: 0, activeToday: 0, approved: 0, rejected: 0, totalUsers: 0, telegramUsers: 0 });
  const [partnerOrgs, setPartnerOrgs] = useState<{ name: string; eventCount: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; text: string; type: string; time: string }[]>([]);
  const [regChartData, setRegChartData] = useState<{ date: string; count: number }[]>([]);
  const [userChartData, setUserChartData] = useState<{ date: string; count: number }[]>([]);
  const [alerts, setAlerts] = useState<{ text: string; type: string }[]>([]);
  const [recentUsers, setRecentUsers] = useState<{ id: string; name: string; email: string | null; phone: string | null; type: string; created_at: string }[]>([]);

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
    fetchChartData();
    fetchRecentUsers();
    fetchPartnerOrgs();

    // Realtime subscription for telegram_accounts
    const channel = supabase
      .channel('admin-telegram-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'telegram_accounts' }, () => {
        fetchTelegramCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTelegramCount = async () => {
    const { count } = await supabase.from("telegram_accounts").select("id", { count: "exact", head: true }).not("telegram_chat_id", "is", null);
    setStats(prev => ({ ...prev, telegramUsers: count ?? 0 }));
  };

  const fetchStats = async () => {
    const [eventsRes, regsRes, pendingRes, approvedRes, rejectedRes, organizersRes, explorersRes, telegramRes] = await Promise.all([
      supabase.from("events").select("id, date", { count: "exact" }),
      supabase.from("registrations").select("id", { count: "exact", head: true }),
      supabase.from("registrations").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("registrations").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("registrations").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      supabase.from("organizer_profiles").select("id", { count: "exact", head: true }),
      supabase.from("attendee_accounts").select("id", { count: "exact", head: true }),
      supabase.from("telegram_accounts").select("id", { count: "exact", head: true }).not("telegram_chat_id", "is", null),
    ]);
    const today = new Date().toISOString().split("T")[0];
    const activeToday = eventsRes.data?.filter(e => e.date === today).length ?? 0;
    const totalUsers = (organizersRes.count ?? 0) + (explorersRes.count ?? 0);

    const s = {
      totalEvents: eventsRes.count ?? 0,
      totalRegistrations: regsRes.count ?? 0,
      pendingPayments: pendingRes.count ?? 0,
      activeToday,
      approved: approvedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
      totalUsers,
      telegramUsers: telegramRes.count ?? 0,
    };
    setStats(s);

    const a: { text: string; type: string }[] = [];
    if (s.pendingPayments > 0) a.push({ text: `${s.pendingPayments} pending approvals`, type: "warning" });
    if (s.rejected > 5) a.push({ text: `${s.rejected} rejected payments — review trends`, type: "error" });
    setAlerts(a);
  };

  const fetchPartnerOrgs = async () => {
    const { data: events } = await supabase.from("events").select("partners");
    if (!events) return;
    const partnerMap: Record<string, number> = {};
    events.forEach(e => {
      (e.partners ?? []).forEach((p: string) => {
        const name = p.trim();
        if (name) partnerMap[name] = (partnerMap[name] || 0) + 1;
      });
    });
    const sorted = Object.entries(partnerMap)
      .map(([name, eventCount]) => ({ name, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount);
    setPartnerOrgs(sorted);
  };

  const fetchRecentActivity = async () => {
    const { data: regs } = await supabase.from("registrations").select("id, full_name, status, payment_method, created_at, event_id").order("created_at", { ascending: false }).limit(10);
    const { data: evts } = await supabase.from("events").select("id, title, created_at").order("created_at", { ascending: false }).limit(5);

    const activity: { id: string; text: string; type: string; time: string }[] = [];
    regs?.forEach(r => {
      if (r.status === "approved") activity.push({ id: r.id, text: `Payment approved — ${r.full_name}`, type: "success", time: r.created_at });
      else if (r.status === "rejected") activity.push({ id: r.id, text: `Payment rejected — ${r.full_name}`, type: "error", time: r.created_at });
      else activity.push({ id: r.id, text: `New registration — ${r.full_name}`, type: "info", time: r.created_at });
    });
    evts?.forEach(e => activity.push({ id: e.id, text: `New event created — ${e.title}`, type: "info", time: e.created_at }));
    activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setRecentActivity(activity.slice(0, 12));
  };

  const fetchChartData = async () => {
    const [{ data: regs }, { data: orgs }, { data: explorers }] = await Promise.all([
      supabase.from("registrations").select("created_at").order("created_at"),
      supabase.from("organizer_profiles").select("created_at").order("created_at"),
      supabase.from("attendee_accounts").select("created_at").order("created_at"),
    ]);
    if (regs) {
      const byDate: Record<string, number> = {};
      regs.forEach(r => {
        const d = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        byDate[d] = (byDate[d] || 0) + 1;
      });
      setRegChartData(Object.entries(byDate).slice(-14).map(([date, count]) => ({ date, count })));
    }
    // Merge organizers + explorers into one "Users" chart
    const byDate: Record<string, number> = {};
    orgs?.forEach(o => {
      const d = new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      byDate[d] = (byDate[d] || 0) + 1;
    });
    explorers?.forEach(e => {
      const d = new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      byDate[d] = (byDate[d] || 0) + 1;
    });
    setUserChartData(Object.entries(byDate).slice(-14).map(([date, count]) => ({ date, count })));
  };

  const fetchRecentUsers = async () => {
    const [{ data: orgs }, { data: explorers }] = await Promise.all([
      supabase.from("organizer_profiles").select("id, organization_name, email, phone, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("attendee_accounts").select("id, full_name, email, phone, created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    const merged: typeof recentUsers = [];
    orgs?.forEach(o => merged.push({ id: o.id, name: o.organization_name, email: o.email, phone: o.phone, type: "Organizer", created_at: o.created_at }));
    explorers?.forEach(e => merged.push({ id: e.id, name: e.full_name, email: e.email, phone: e.phone, type: "Explorer", created_at: e.created_at }));
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRecentUsers(merged.slice(0, 10));
  };

  const metricCards = [
    { label: "Total Events", value: stats.totalEvents, icon: Calendar, color: "text-primary" },
    { label: "Total Registrations", value: stats.totalRegistrations, icon: Users, color: "text-primary" },
    { label: "Users", value: stats.totalUsers, icon: UserPlus, color: "text-primary" },
    { label: "Pending Payments", value: stats.pendingPayments, icon: Clock, color: "text-yellow-500" },
    { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-green-500" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-destructive" },
    { label: "Telegram Users", value: stats.telegramUsers, icon: Send, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {metricCards.map(m => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <m.icon className={`mx-auto mb-2 h-5 w-5 ${m.color}`} />
            <p className="font-display text-2xl font-bold text-foreground">{m.value}</p>
            <p className="text-xs text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 font-display text-sm font-semibold text-foreground">Registrations Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={regChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 font-display text-sm font-semibold text-foreground">User Signups Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={userChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Users" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity + Alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Recent Activity</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentActivity.map(a => (
              <div key={a.id + a.time} className="flex items-start gap-3 rounded-lg bg-secondary/50 px-3 py-2">
                <span className={`mt-0.5 text-sm ${a.type === "success" ? "text-green-500" : a.type === "error" ? "text-destructive" : "text-primary"}`}>
                  {a.type === "success" ? "✔" : a.type === "error" ? "✖" : "●"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{a.text}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.time).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" /> Alerts
          </h3>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 text-sm ${a.type === "error" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"}`}>
                {a.text}
              </div>
            ))}
            {alerts.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No alerts — all clear! ✓</p>}
            <Button variant="outline" size="sm" className="w-full mt-2 text-xs" onClick={() => onNavigate("transactions")}>
              View Transactions →
            </Button>
          </div>
        </div>
      </div>

      {/* Recent User Signups */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Recent User Signups
          </h3>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => onNavigate("users")}>
            View All →
          </Button>
        </div>
        {recentUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No user signups yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary">
                <tr>
                  {["Name", "Email", "Phone", "Type", "Joined"].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentUsers.map(u => (
                  <tr key={u.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground text-xs">{u.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.email || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.type === "Organizer" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
                        {u.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Partner Organizations */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Partner Organizations
        </h3>
        {partnerOrgs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No partner organizations mentioned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {partnerOrgs.map(p => (
              <div key={p.name} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5">
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">{p.eventCount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
