import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deduplicateRegistrations } from "@/lib/deduplicateRegistrations";
import { Users, CheckCircle, Clock, XCircle, DollarSign, Plus, ClipboardList, CreditCard, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrganizerSection } from "./OrganizerSidebar";

interface Props {
  userId: string;
  onNavigate: (section: OrganizerSection) => void;
}

interface Stats {
  totalRegs: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  recentActivity: { text: string; time: string }[];
}

const OrganizerOverview = ({ userId, onNavigate }: Props) => {
  const [stats, setStats] = useState<Stats>({ totalRegs: 0, approved: 0, pending: 0, rejected: 0, revenue: 0, recentActivity: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Get organizer's events
      const { data: events } = await supabase.from("events").select("id, title, ticket_price").eq("organizer_id", userId);
      if (!events || events.length === 0) { setLoading(false); return; }

      const eventIds = events.map(e => e.id);
      const { data: regs } = await supabase.from("registrations").select("*").in("event_id", eventIds).order("created_at", { ascending: false });

      if (regs) {
        const dedupedRegs = deduplicateRegistrations(regs);
        const approved = dedupedRegs.filter(r => r.status === "approved");
        // Calculate revenue from approved registrations
        let revenue = 0;
        approved.forEach(r => {
          const ev = events.find(e => e.id === r.event_id);
          if (ev) {
            const price = parseFloat(ev.ticket_price?.replace(/[^0-9.]/g, "") || "0");
            if (!isNaN(price)) revenue += price;
          }
        });

        const recent = dedupedRegs.slice(0, 8).map(r => ({
          text: `${r.status === "approved" ? "✔" : r.status === "rejected" ? "✖" : "⏳"} ${r.full_name} — ${r.status}`,
          time: new Date(r.created_at).toLocaleDateString(),
        }));

        setStats({
          totalRegs: dedupedRegs.length,
          approved: approved.length,
          pending: dedupedRegs.filter(r => r.status === "pending").length,
          rejected: dedupedRegs.filter(r => r.status === "rejected").length,
          revenue,
          recentActivity: recent,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const cards = [
    { label: "Total Registrations", value: stats.totalRegs, icon: Users, color: "text-primary" },
    { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-green-500" },
    { label: "Pending Payments", value: stats.pending, icon: Clock, color: "text-yellow-500" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-destructive" },
    { label: "Revenue (ETB)", value: stats.revenue.toLocaleString(), icon: DollarSign, color: "text-primary" },
  ];

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="font-display text-2xl font-bold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onNavigate("create-event")} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" /> Create New Event
          </Button>
          <Button variant="outline" onClick={() => onNavigate("registrations")} className="border-border hover:border-primary hover:text-primary">
            <ClipboardList className="mr-2 h-4 w-4" /> View Registrations
          </Button>
          <Button variant="outline" onClick={() => onNavigate("payments")} className="border-border hover:border-primary hover:text-primary">
            <CreditCard className="mr-2 h-4 w-4" /> Review Payments
          </Button>
          <Button variant="outline" onClick={() => onNavigate("sharing")} className="border-border hover:border-primary hover:text-primary">
            <Share2 className="mr-2 h-4 w-4" /> Share Event Link
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h3>
        {stats.recentActivity.length > 0 ? (
          <div className="space-y-2">
            {stats.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
                <span className="text-sm text-foreground">{a.text}</span>
                <span className="text-xs text-muted-foreground">{a.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No activity yet. Create an event to get started!</p>
        )}
      </div>
    </div>
  );
};

export default OrganizerOverview;
