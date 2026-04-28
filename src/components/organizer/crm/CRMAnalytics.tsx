import { useMemo } from "react";
import { deduplicateRegistrations } from "@/lib/deduplicateRegistrations";
import { Users, TrendingUp, UserCheck, UserX, Star, Award, AlertTriangle, BarChart3, Repeat, Zap, Heart, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import type { AttendeeProfile, EventOption } from "./types";
import InfoTooltip from "../InfoTooltip";
import { Progress } from "@/components/ui/progress";

interface Props {
  profiles: AttendeeProfile[];
  events: EventOption[];
  registrations: { email: string; event_id: string; checked_in: boolean; checked_in_at?: string | null; created_at: string; status: string }[];
}

const COLORS = ["hsl(43 100% 50%)", "hsl(43 100% 65%)", "hsl(142 70% 45%)", "hsl(200 80% 55%)", "hsl(280 70% 55%)", "hsl(0 84% 60%)"];
const tooltipStyle = { backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 8, fontSize: 12 };

const CRMAnalytics = ({ profiles, events, registrations: rawRegistrations }: Props) => {
  const eventCount = events.length;

  const analytics = useMemo(() => {
    const registrations = deduplicateRegistrations(rawRegistrations) as Props["registrations"];
    const total = profiles.length;
    const returning = profiles.filter(p => p.totalRegistered > 1).length;
    const firstTime = total - returning;
    const frequent = profiles.filter(p => p.totalAttended >= 3).length;
    const avgRate = total > 0 ? (profiles.reduce((s, p) => s + p.attendanceRate, 0) / total) : 0;
    const avgEngagement = total > 0 ? (profiles.reduce((s, p) => s + p.engagementScore, 0) / total) : 0;
    const totalRegistrations = registrations.length;
    const totalCheckedIn = registrations.filter(r => r.checked_in).length;
    const totalApproved = registrations.filter(r => r.status === "approved").length;
    const attendanceRate = totalApproved > 0 ? ((totalCheckedIn / totalApproved) * 100) : 0;
    const noShows = profiles.filter(p => p.totalRegistered > 0 && p.totalAttended === 0).length;

    // Registration timeline (14 days)
    const now = new Date();
    const regTimeline: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      regTimeline[d.toISOString().split("T")[0]] = 0;
    }
    registrations.forEach(r => { const d = r.created_at.split("T")[0]; if (d in regTimeline) regTimeline[d]++; });
    const timelineData = Object.entries(regTimeline).map(([date, count]) => ({ date: date.slice(5), count }));

    // Check-in timeline (hourly)
    const checkinHours: Record<string, number> = {};
    for (let h = 6; h <= 23; h++) checkinHours[`${h.toString().padStart(2, "0")}:00`] = 0;
    registrations.filter(r => r.checked_in && r.checked_in_at).forEach(r => {
      const hour = new Date(r.checked_in_at!).getHours();
      const key = `${hour.toString().padStart(2, "0")}:00`;
      if (key in checkinHours) checkinHours[key]++;
    });
    const checkinData = Object.entries(checkinHours).map(([hour, count]) => ({ hour, count })).filter(e => e.count > 0 || Object.values(checkinHours).some(c => c > 0));
    const peakHourEntry = checkinData.reduce((max, e) => e.count > max.count ? e : max, { hour: "", count: 0 });
    const peakHour = peakHourEntry.count > 0 ? peakHourEntry.hour : "N/A";

    // Most active attendees
    const topAttendees = [...profiles]
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5);

    // Tag distribution
    const tagCounts: Record<string, number> = {};
    profiles.forEach(p => p.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Organization distribution
    const orgCounts: Record<string, number> = {};
    profiles.forEach(p => { if (p.organization) orgCounts[p.organization] = (orgCounts[p.organization] || 0) + 1; });
    const topOrgs = Object.entries(orgCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Event comparison (requires ≥ 2 events)
    let eventCompare: { name: string; registered: number; attended: number; rate: number }[] = [];
    let audienceGrowth = 0;
    let audienceGrowthPct = 0;
    if (eventCount >= 2) {
      const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
      eventCompare = sortedEvents.map(ev => {
        const evRegs = registrations.filter(r => r.event_id === ev.id);
        const evApproved = evRegs.filter(r => r.status === "approved").length;
        const evChecked = evRegs.filter(r => r.checked_in).length;
        return {
          name: ev.title.length > 20 ? ev.title.slice(0, 18) + "…" : ev.title,
          registered: evRegs.length,
          attended: evChecked,
          rate: evApproved > 0 ? ((evChecked / evApproved) * 100) : 0,
        };
      });
      const prev = eventCompare[eventCompare.length - 2];
      const current = eventCompare[eventCompare.length - 1];
      if (prev && current && prev.registered > 0) {
        audienceGrowth = current.registered - prev.registered;
        audienceGrowthPct = ((audienceGrowth / prev.registered) * 100);
      }
    }

    // Returning attendee rate for current event (latest)
    let returningRate = 0;
    let returningCount = 0;
    if (eventCount >= 2) {
      const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
      const latestEvent = sortedEvents[sortedEvents.length - 1];
      const previousEventIds = sortedEvents.slice(0, -1).map(e => e.id);
      const previousEmails = new Set(
        registrations.filter(r => previousEventIds.includes(r.event_id)).map(r => r.email.toLowerCase())
      );
      const latestRegs = registrations.filter(r => r.event_id === latestEvent.id);
      returningCount = latestRegs.filter(r => previousEmails.has(r.email.toLowerCase())).length;
      returningRate = latestRegs.length > 0 ? ((returningCount / latestRegs.length) * 100) : 0;
    }

    // Engagement trend (requires ≥ 3 events)
    let engagementTrend: { event: string; rate: number }[] = [];
    if (eventCount >= 3) {
      const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
      engagementTrend = sortedEvents.map(ev => {
        const evRegs = registrations.filter(r => r.event_id === ev.id);
        const evApproved = evRegs.filter(r => r.status === "approved").length;
        const evChecked = evRegs.filter(r => r.checked_in).length;
        return {
          event: ev.title.length > 15 ? ev.title.slice(0, 13) + "…" : ev.title,
          rate: evApproved > 0 ? ((evChecked / evApproved) * 100) : 0,
        };
      });
    }

    // Community Strength Score
    const retScore = Math.min(((returning / Math.max(total, 1)) * 40), 40);
    const attRateScore = Math.min((attendanceRate * 0.35), 35);
    const repeatScore = Math.min(((frequent / Math.max(total, 1)) * 25), 25);
    const communityStrength = Math.min(retScore + attRateScore + repeatScore, 100);

    // Smart insights
    const insights: string[] = [];
    if (total > 0) {
      if (firstTime > returning) insights.push("Most of your attendees are first-time participants.");
      else if (returning > firstTime) insights.push("Your audience has a strong returning base — great community building!");
      
      if (eventCount >= 2 && returningRate > 0) {
        insights.push(`${returningRate}% of attendees at your latest event previously attended your past events.`);
      }
      if (eventCount >= 2 && audienceGrowthPct !== 0) {
        if (audienceGrowthPct > 0) insights.push(`Your event registrations increased by ${audienceGrowthPct}% compared to your previous event.`);
        else insights.push(`Your event registrations decreased by ${Math.abs(audienceGrowthPct)}% compared to your previous event.`);
      }
      if (attendanceRate > 0) {
        if (eventCount >= 2 && eventCompare.length >= 2) {
          const prev = eventCompare[eventCompare.length - 2];
          const curr = eventCompare[eventCompare.length - 1];
          if (curr.rate > prev.rate) insights.push("Your event attendance rate is higher than your previous event.");
        }
      }
      if (peakHour !== "N/A") {
        const nextHour = parseInt(peakHour) + 1;
        insights.push(`Most attendees arrived between ${peakHour} and ${nextHour.toString().padStart(2, "0")}:00.`);
      }
      if (noShows > 0 && total > 5) {
        insights.push(`${noShows} attendee${noShows > 1 ? "s" : ""} registered but never attended any of your events.`);
      }
    }

    // Suggested re-invite lists
    const reInviteSuggestions = {
      pastAttendees: returning,
      frequentAttendees: frequent,
      noShows: noShows,
    };

    // Audience interest detection (event categories)
    const categoryInterests: Record<string, number> = {};
    profiles.forEach(p => {
      p.events.forEach(ev => {
        // Group by simplified event title patterns
        const simplified = ev.title.toLowerCase();
        if (simplified.includes("startup") || simplified.includes("business") || simplified.includes("entrepreneur")) {
          categoryInterests["Business & Startups"] = (categoryInterests["Business & Startups"] || 0) + 1;
        }
        if (simplified.includes("tech") || simplified.includes("developer") || simplified.includes("code")) {
          categoryInterests["Technology"] = (categoryInterests["Technology"] || 0) + 1;
        }
        if (simplified.includes("art") || simplified.includes("music") || simplified.includes("culture")) {
          categoryInterests["Arts & Culture"] = (categoryInterests["Arts & Culture"] || 0) + 1;
        }
        if (simplified.includes("network") || simplified.includes("connect") || simplified.includes("meetup")) {
          categoryInterests["Networking"] = (categoryInterests["Networking"] || 0) + 1;
        }
      });
    });
    const topInterests = Object.entries(categoryInterests).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Audience growth tracker (unique attendees per event)
    let growthTracker: { event: string; unique: number }[] = [];
    if (eventCount >= 2) {
      const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
      const seenEmails = new Set<string>();
      growthTracker = sortedEvents.map(ev => {
        const evEmails = registrations.filter(r => r.event_id === ev.id).map(r => r.email.toLowerCase());
        evEmails.forEach(e => seenEmails.add(e));
        return {
          event: ev.title.length > 15 ? ev.title.slice(0, 13) + "…" : ev.title,
          unique: seenEmails.size,
        };
      });
    }

    return {
      total, returning, firstTime, frequent, avgRate, avgEngagement,
      totalRegistrations, totalCheckedIn, attendanceRate, noShows,
      timelineData, checkinData, peakHour,
      topAttendees, topTags, topOrgs,
      eventCompare, audienceGrowth, audienceGrowthPct,
      returningRate, returningCount,
      engagementTrend, communityStrength, retScore, attRateScore, repeatScore,
      insights, reInviteSuggestions, topInterests, growthTracker,
    };
  }, [profiles, events, rawRegistrations, eventCount]);

  const insufficientData = profiles.length === 0;

  if (insufficientData) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
        <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Not enough data to generate insights yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Unique Audience", value: analytics.total.toLocaleString(), icon: Users },
          { label: "Returning", value: analytics.returning.toLocaleString(), icon: Repeat },
          { label: "First-Time", value: analytics.firstTime.toLocaleString(), icon: UserCheck },
          { label: "Frequent (3+)", value: analytics.frequent.toLocaleString(), icon: Star },
          { label: "Attendance Rate", value: `${analytics.attendanceRate}%`, icon: TrendingUp },
          { label: "No-Shows", value: analytics.noShows.toLocaleString(), icon: UserX },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <s.icon className="mx-auto h-4 w-4 text-primary mb-1" />
            <p className="font-display text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Community Strength Score */}
      <div className="rounded-xl border border-primary/30 bg-card p-4 sm:p-6">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-4">
          <Heart className="h-4 w-4 text-primary" /> Community Strength Score
          <InfoTooltip title="Community Strength Score" description="A composite score (0–100) measuring how strong your event community is, based on returning attendees (40%), attendance rate (35%), and repeat participation (25%)." />
        </h4>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <div className="flex flex-col items-center">
            <p className={`font-display text-5xl font-black ${analytics.communityStrength >= 70 ? "text-green-400" : analytics.communityStrength >= 40 ? "text-primary" : "text-destructive"}`}>
              {analytics.communityStrength}
            </p>
            <p className="text-sm text-muted-foreground">/100</p>
          </div>
          <div className="flex-1 space-y-2 w-full">
            {[
              { label: "Returning Attendees", score: analytics.retScore, max: 40 },
              { label: "Attendance Rate", score: analytics.attRateScore, max: 35 },
              { label: "Repeat Participation", score: analytics.repeatScore, max: 25 },
            ].map(b => (
              <div key={b.label} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="text-foreground font-medium">{b.score}/{b.max}</span>
                </div>
                <Progress value={(b.score / b.max) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Smart Insights */}
      {analytics.insights.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Zap className="h-4 w-4 text-primary" /> Smart Insights
          </h4>
          <div className="space-y-1.5">
            {analytics.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2">
                <span className="text-primary mt-0.5">💡</span>
                <p className="text-sm text-foreground">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Re-Engagement Suggestions */}
      {eventCount >= 2 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Target className="h-4 w-4 text-primary" /> Suggested Re-Invite List
            <InfoTooltip title="Smart Re-Invite Lists" description="When you create a new event, these suggestions help you quickly target the most likely attendees from your audience base." />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="font-display text-xl font-bold text-foreground">{analytics.reInviteSuggestions.pastAttendees}</p>
              <p className="text-xs text-muted-foreground">Returning attendees to re-invite</p>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="font-display text-xl font-bold text-foreground">{analytics.reInviteSuggestions.frequentAttendees}</p>
              <p className="text-xs text-muted-foreground">Frequent attendees (loyal fans)</p>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="font-display text-xl font-bold text-foreground">{analytics.reInviteSuggestions.noShows}</p>
              <p className="text-xs text-muted-foreground">No-shows to recover</p>
            </div>
          </div>
        </div>
      )}

      {/* Registration Timeline */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
          Registration Timeline (14 days)
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={analytics.timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="hsl(43 100% 50%)" radius={[4, 4, 0, 0]} name="Registrations" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Check-in Timeline */}
      {analytics.checkinData.some(c => c.count > 0) && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            Check-in Timeline
            <span className="text-xs text-muted-foreground font-normal ml-2">Peak: {analytics.peakHour}</span>
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analytics.checkinData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="hsl(142 70% 45%)" fill="hsl(142 70% 45%)" fillOpacity={0.15} strokeWidth={2} name="Check-ins" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Returning Attendee Analysis — only if ≥ 2 events */}
        {eventCount >= 2 ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              Returning Attendees
              <InfoTooltip title="Returning Attendee Analysis" description="Attendees who attended or registered for at least one previous event by the same organizer. Only available after hosting 2+ events." />
            </h4>
            <div className="text-center">
              <p className="font-display text-3xl font-bold text-primary">{analytics.returningRate}%</p>
              <p className="text-xs text-muted-foreground">of latest event came from past events</p>
              <p className="text-sm text-foreground mt-1">{analytics.returningCount} returning attendees</p>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={[{ name: "Returning", value: analytics.returningRate }, { name: "New", value: 100 - analytics.returningRate }]} cx="50%" cy="50%" outerRadius={45} innerRadius={30} dataKey="value">
                  <Cell fill="hsl(43 100% 50%)" />
                  <Cell fill="hsl(0 0% 20%)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center py-4">Returning attendee analytics will appear after you host more than one event.</p>
          </div>
        )}

        {/* Audience Growth — only if ≥ 2 events */}
        {eventCount >= 2 ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              Audience Growth
              <InfoTooltip title="Audience Growth" description="Compares registration count between your latest and previous event to measure growth." />
            </h4>
            <div className="text-center">
              <p className={`font-display text-3xl font-bold ${analytics.audienceGrowthPct >= 0 ? "text-green-400" : "text-destructive"}`}>
                {analytics.audienceGrowthPct >= 0 ? "+" : ""}{analytics.audienceGrowthPct}%
              </p>
              <p className="text-xs text-muted-foreground">vs previous event</p>
              <p className="text-sm text-foreground mt-1">{analytics.audienceGrowth >= 0 ? "+" : ""}{analytics.audienceGrowth} registrations</p>
            </div>
            {analytics.growthTracker.length > 0 && (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={analytics.growthTracker}>
                  <XAxis dataKey="event" tick={{ fontSize: 8, fill: "hsl(0 0% 60%)" }} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(0 0% 60%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="unique" stroke="hsl(43 100% 50%)" fill="hsl(43 100% 50%)" fillOpacity={0.15} strokeWidth={2} name="Cumulative Audience" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center py-4">Audience growth analytics will appear after you host more than one event.</p>
          </div>
        )}

        {/* Engagement Trend — only if ≥ 3 events */}
        {eventCount >= 3 ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              Engagement Trends
              <InfoTooltip title="Engagement Trends" description="Shows attendance rate trends across your events. Requires 3+ events to detect meaningful patterns." />
            </h4>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={analytics.engagementTrend}>
                <XAxis dataKey="event" tick={{ fontSize: 8, fill: "hsl(0 0% 60%)" }} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(0 0% 60%)" }} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="rate" fill="hsl(142 70% 45%)" radius={[4, 4, 0, 0]} name="Attendance %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center py-4">Engagement trend insights will appear after more events are hosted.</p>
          </div>
        )}
      </div>

      {/* Event Comparison */}
      {eventCount >= 2 && analytics.eventCompare.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <BarChart3 className="h-4 w-4" /> Event Comparison
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.eventCompare}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(0 0% 60%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="registered" fill="hsl(43 100% 50%)" name="Registered" radius={[4, 4, 0, 0]} />
              <Bar dataKey="attended" fill="hsl(142 70% 45%)" name="Attended" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Most Active */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">Most Active Attendees <InfoTooltip title="Most Active Attendees" description="Ranked by engagement score — a composite of how many events they attended, their attendance rate, and consistency. These are your most loyal community members." /></h4>
          {analytics.topAttendees.map((p, i) => (
            <div key={p.email} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">{i + 1}</span>
                <span className="text-sm text-foreground truncate">{p.full_name}</span>
              </div>
              <span className="text-xs font-semibold text-primary shrink-0 ml-2">{p.engagementScore}/100</span>
            </div>
          ))}
          {analytics.topAttendees.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No data</p>}
        </div>

        {/* Top Tags */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">Tag Distribution <InfoTooltip title="Tag Distribution" description="Shows the most commonly used tags across your attendees. Tags like VIP, Speaker, or Sponsor help you categorize important contacts for targeted communication." /></h4>
          {analytics.topTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analytics.topTags.map(([tag, count]) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  {tag} <span className="text-primary/60">({count})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No tags assigned yet</p>
          )}
        </div>

        {/* Top Organizations */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">Top Organizations <InfoTooltip title="Top Organizations" description="The organizations most represented in your attendee base. Useful for sponsorship outreach and understanding your audience's professional background." /></h4>
          {analytics.topOrgs.map(([org, count]) => (
            <div key={org} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
              <span className="text-sm text-foreground truncate">{org}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">{count}</span>
            </div>
          ))}
          {analytics.topOrgs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No data</p>}
        </div>
      </div>

      {/* Audience Interest Detection */}
      {analytics.topInterests.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            Audience Interests
            <InfoTooltip title="Audience Interest Detection" description="Detects patterns in what types of events your attendees gravitate toward, based on event title analysis." />
          </h4>
          <div className="flex flex-wrap gap-2">
            {analytics.topInterests.map(([interest, count]) => (
              <span key={interest} className="inline-flex items-center gap-1 rounded-full bg-secondary text-foreground px-3 py-1.5 text-sm font-medium">
                {interest} <span className="text-muted-foreground text-xs">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMAnalytics;
