import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deduplicateRegistrations } from "@/lib/deduplicateRegistrations";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  Clock, Users, TrendingUp, UserCheck, Lock, Download, CalendarDays, Percent,
  BarChart3, Activity, Eye, EyeOff, Store, FileText, Star, Radio, UserX, Shield,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import InfoTooltip from "./InfoTooltip";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface Props {
  userId: string;
  userPlan?: string;
  subscriptionEnabled?: boolean;
}

const COLORS = ["hsl(43 100% 50%)", "hsl(43 100% 65%)", "hsl(0 84% 60%)", "hsl(0 0% 60%)", "hsl(200 80% 55%)", "hsl(280 70% 55%)"];

const OrganizerAnalytics = ({ userId, userPlan = "free", subscriptionEnabled = false }: Props) => {
  // Basic
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [totalRegs, setTotalRegs] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [noShowRate, setNoShowRate] = useState(0);
  const [noShowCount, setNoShowCount] = useState(0);
  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(null);

  // Advanced
  const [peakArrival, setPeakArrival] = useState<{ hour: string; count: number }[]>([]);
  const [peakHour, setPeakHour] = useState("");
  const [returningPct, setReturningPct] = useState(0);
  const [firstTimePct, setFirstTimePct] = useState(0);
  const [sourceData, setSourceData] = useState<{ name: string; value: number }[]>([]);
  const [attendeeTypeData, setAttendeeTypeData] = useState<{ name: string; value: number }[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<{ name: string; value: number }[]>([]);
  const [cumulativeData, setCumulativeData] = useState<{ date: string; total: number }[]>([]);
  const [eventCompareData, setEventCompareData] = useState<{ name: string; registered: number; attended: number; rate: number }[]>([]);
  const [funnelData, setFunnelData] = useState<{ stage: string; count: number; pct: number }[]>([]);
  const [weekdayData, setWeekdayData] = useState<{ day: string; count: number }[]>([]);
  const [avgRegPerEvent, setAvgRegPerEvent] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);

  // New advanced
  const [checkinTimeline, setCheckinTimeline] = useState<{ time: string; count: number }[]>([]);
  const [peakCheckinWindow, setPeakCheckinWindow] = useState("");
  const [demographicData, setDemographicData] = useState<{ name: string; value: number }[]>([]);
  const [vendorStats, setVendorStats] = useState({ total: 0, approved: 0, pending: 0 });
  const [performanceScore, setPerformanceScore] = useState(0);
  const [performanceBreakdown, setPerformanceBreakdown] = useState<{ label: string; score: number; max: number }[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [viewsByEvent, setViewsByEvent] = useState<{ name: string; views: number }[]>([]);
  const [viewSources, setViewSources] = useState<{ name: string; value: number }[]>([]);
  const [viewsTimeline, setViewsTimeline] = useState<{ date: string; views: number }[]>([]);

  // Live dashboard
  const [liveCheckins, setLiveCheckins] = useState(0);
  const [liveRate, setLiveRate] = useState(0);
  const [recentLiveCheckins, setRecentLiveCheckins] = useState<{ name: string; time: string }[]>([]);
  const [isLive, setIsLive] = useState(false);

  const isAdvanced = !subscriptionEnabled || userPlan === "pro" || userPlan === "corporate";

  // Event filter
  const [selectedEventId, setSelectedEventId] = useState<string>("all");

  // Store events and regs for export
  const [allRegs, setAllRegs] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);

  const fetchAnalytics = useCallback(async () => {
    const { data: allEventsData } = await supabase.from("events").select("id, title, ticket_price, date, expected_attendees").eq("organizer_id", userId);
    if (!allEventsData || allEventsData.length === 0) return;

    setAllEvents(allEventsData);
    const events = selectedEventId === "all" ? allEventsData : allEventsData.filter(e => e.id === selectedEventId);
    setTotalEvents(events.length);
    const ids = events.map(e => e.id);
    const { data: regs } = await supabase.from("registrations")
      .select("created_at, status, checked_in, checked_in_at, event_id, email, phone, source, attendee_type, payment_method, full_name, custom_answers")
      .in("event_id", ids);
    if (!regs) return;

    const dedupedRegs = deduplicateRegistrations(regs);
    // Use deduplicated data for all analytics from here on
    const recs = dedupedRegs;
    setAllRegs(recs);
    setTotalRegs(recs.length);
    const approved = recs.filter(r => r.status === "approved").length;
    const pending = recs.filter(r => r.status === "pending").length;
    const rejected = recs.filter(r => r.status === "rejected").length;
    const checkedIn = recs.filter(r => r.checked_in).length;
    const noShows = approved - checkedIn;

    setTotalApproved(approved);
    setCheckedInCount(checkedIn);
    setNoShowCount(Math.max(noShows, 0));
    setStatusData([
      { name: "Approved", value: approved },
      { name: "Pending", value: pending },
      { name: "Rejected", value: rejected },
    ]);
    setAttendanceRate(approved > 0 ? ((checkedIn / approved) * 100) : 0);
    setConversionRate(recs.length > 0 ? ((approved / recs.length) * 100) : 0);
    setNoShowRate(approved > 0 ? ((Math.max(noShows, 0) / approved) * 100) : 0);
    setAvgRegPerEvent(events.length > 0 ? (recs.length / events.length) : 0);

    // Remaining capacity
    const totalExpected = events.reduce((sum, e) => sum + (e.expected_attendees || 0), 0);
    setRemainingCapacity(totalExpected > 0 ? Math.max(totalExpected - recs.length, 0) : null);

    // Revenue
    let rev = 0;
    recs.filter(r => r.status === "approved").forEach(r => {
      const ev = events.find(e => e.id === r.event_id);
      if (ev) {
        const price = parseFloat(ev.ticket_price?.replace(/[^0-9.]/g, "") || "0");
        if (!isNaN(price)) rev += price;
      }
    });
    setRevenue(rev);

    // Daily registrations (14 days)
    const now = new Date();
    const daily: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      daily[d.toISOString().split("T")[0]] = 0;
    }
    recs.forEach(r => { const d = r.created_at.split("T")[0]; if (d in daily) daily[d]++; });
    setDailyData(Object.entries(daily).map(([date, count]) => ({ date: date.slice(5), count })));

    // Live dashboard
    const todayStr = new Date().toISOString().split("T")[0];
    const todayCheckins = recs.filter(r => r.checked_in && r.checked_in_at && r.checked_in_at.startsWith(todayStr));
    setLiveCheckins(todayCheckins.length);
    setLiveRate(approved > 0 ? ((todayCheckins.length / approved) * 100) : 0);
    const recentLive = todayCheckins
      .sort((a, b) => new Date(b.checked_in_at!).getTime() - new Date(a.checked_in_at!).getTime())
      .slice(0, 5)
      .map(r => ({ name: r.full_name, time: new Date(r.checked_in_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
    setRecentLiveCheckins(recentLive);

    if (isAdvanced) {
      // Peak arrival time — compute average check-in time in h:m:s and show as 1-hour range
      const checkinTimes = recs.filter(r => r.checked_in_at).map(r => {
        const d = new Date(r.checked_in_at!);
        return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
      });
      
      // Hourly distribution for chart
      const hourCounts: Record<string, number> = {};
      for (let h = 6; h <= 23; h++) hourCounts[`${h.toString().padStart(2, "0")}:00`] = 0;
      recs.filter(r => r.checked_in_at).forEach(r => {
        const hour = new Date(r.checked_in_at!).getHours();
        const key = `${hour.toString().padStart(2, "0")}:00`;
        if (key in hourCounts) hourCounts[key]++;
      });
      const peakArr = Object.entries(hourCounts).map(([hour, count]) => ({ hour, count }));
      setPeakArrival(peakArr);
      
      if (checkinTimes.length > 0) {
        const avgSeconds = (checkinTimes.reduce((a, b) => a + b, 0) / checkinTimes.length);
        const avgH = Math.floor(avgSeconds / 3600);
        const avgM = Math.floor((avgSeconds % 3600) / 60);
        // Create a 1-hour range centered on the average
        const startSeconds = Math.max(0, avgSeconds - 1800);
        const endSeconds = startSeconds + 3600;
        const startH = Math.floor(startSeconds / 3600);
        const startM = Math.floor((startSeconds % 3600) / 60);
        const endH = Math.floor(endSeconds / 3600);
        const endM = Math.floor((endSeconds % 3600) / 60);
        const fmt = (h: number, m: number) => `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        setPeakHour(`${fmt(startH, startM)} - ${fmt(endH, endM)}`);
      } else {
        setPeakHour("N/A");
      }

      // Check-in timeline (30-min intervals)
      const intervalCounts: Record<string, number> = {};
      for (let h = 6; h <= 23; h++) {
        intervalCounts[`${h.toString().padStart(2, "0")}:00`] = 0;
        intervalCounts[`${h.toString().padStart(2, "0")}:30`] = 0;
      }
      recs.filter(r => r.checked_in_at).forEach(r => {
        const d = new Date(r.checked_in_at!);
        const h = d.getHours();
        const m = d.getMinutes() < 30 ? "00" : "30";
        const key = `${h.toString().padStart(2, "0")}:${m}`;
        if (key in intervalCounts) intervalCounts[key]++;
      });
      const ciTimeline = Object.entries(intervalCounts)
        .map(([time, count]) => ({ time, count }))
        .filter(e => e.count > 0 || Object.values(intervalCounts).some(c => c > 0));
      setCheckinTimeline(ciTimeline);
      const peakInterval = ciTimeline.reduce((max, e) => e.count > max.count ? e : max, { time: "", count: 0 });
      const peakIdx = ciTimeline.findIndex(e => e.time === peakInterval.time);
      const nextTime = peakIdx < ciTimeline.length - 1 ? ciTimeline[peakIdx + 1]?.time : "";
      setPeakCheckinWindow(peakInterval.count > 0 ? `${peakInterval.time} – ${nextTime || "end"}` : "N/A");

      // Returning vs first-time — only count attendees registered for DIFFERENT events
      const emailEventSets: Record<string, Set<string>> = {};
      recs.forEach(r => {
        if (!emailEventSets[r.email]) emailEventSets[r.email] = new Set();
        emailEventSets[r.email].add(r.event_id);
      });
      const uniqueEmails = Object.keys(emailEventSets).length;
      const returning = Object.values(emailEventSets).filter(s => s.size > 1).length;
      setReturningPct(uniqueEmails > 0 ? ((returning / uniqueEmails) * 100) : 0);
      setFirstTimePct(uniqueEmails > 0 ? 100 - ((returning / uniqueEmails) * 100) : 0);

      // Registration source
      const sources: Record<string, number> = {};
      const SOURCE_LABELS: Record<string, string> = { platform: "Direct Link", door: "Door Entry", "qr-self": "QR Self-Register", import: "Import/Upload" };
      recs.forEach(r => { const src = SOURCE_LABELS[r.source] || r.source || "Unknown"; sources[src] = (sources[src] || 0) + 1; });
      setSourceData(Object.entries(sources).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      // Attendee type (ticket type)
      const types: Record<string, number> = {};
      const TYPE_LABELS: Record<string, string> = { participant: "General", vendor: "Vendor", speaker: "Speaker", vip: "VIP", media: "Media", other: "Other" };
      recs.forEach(r => { const t = TYPE_LABELS[r.attendee_type] || r.attendee_type || "General"; types[t] = (types[t] || 0) + 1; });
      setAttendeeTypeData(Object.entries(types).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      // Payment methods
      const payments: Record<string, number> = {};
      const PAY_LABELS: Record<string, string> = { bank_transfer: "Bank Transfer", telebirr: "Telebirr", mpessa: "M-Pesa", cash: "Cash", door: "Door", free: "Free", other: "Other" };
      recs.forEach(r => { const pm = PAY_LABELS[r.payment_method] || r.payment_method || "Other"; payments[pm] = (payments[pm] || 0) + 1; });
      setPaymentMethodData(Object.entries(payments).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      // Cumulative registrations (30 days)
      const cumDaily: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); cumDaily[d.toISOString().split("T")[0]] = 0; }
      recs.forEach(r => { const d = r.created_at.split("T")[0]; if (d in cumDaily) cumDaily[d]++; });
      let cumTotal = 0;
      setCumulativeData(Object.entries(cumDaily).map(([date, count]) => { cumTotal += count; return { date: date.slice(5), total: cumTotal }; }));

      // Event comparison
      const evCompare = events.map(ev => {
        const evRegs = recs.filter(r => r.event_id === ev.id);
        const evApproved = evRegs.filter(r => r.status === "approved").length;
        const evChecked = evRegs.filter(r => r.checked_in).length;
        return { name: ev.title.length > 20 ? ev.title.slice(0, 18) + "…" : ev.title, registered: evRegs.length, attended: evChecked, rate: evApproved > 0 ? ((evChecked / evApproved) * 100) : 0 };
      }).sort((a, b) => b.registered - a.registered).slice(0, 8);
      setEventCompareData(evCompare);

      // Funnel
      setFunnelData([
        { stage: "Registered", count: recs.length, pct: 100 },
        { stage: "Approved", count: approved, pct: recs.length > 0 ? ((approved / recs.length) * 100) : 0 },
        { stage: "Checked In", count: checkedIn, pct: recs.length > 0 ? ((checkedIn / recs.length) * 100) : 0 },
      ]);

      // Weekday distribution
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayCounts: Record<string, number> = {};
      days.forEach(d => { dayCounts[d] = 0; });
      recs.forEach(r => { dayCounts[days[new Date(r.created_at).getDay()]]++; });
      setWeekdayData(days.map(d => ({ day: d, count: dayCounts[d] })));

      // Demographics from custom_answers (organization field)
      const orgCounts: Record<string, number> = {};
      recs.forEach(r => {
        const answers = r.custom_answers as any;
        const org = answers?.organization || answers?.Organization;
        if (org && typeof org === "string" && org.trim()) {
          const key = org.trim();
          orgCounts[key] = (orgCounts[key] || 0) + 1;
        }
      });
      setDemographicData(Object.entries(orgCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10));

      // Vendor stats
      const { data: vendors } = await supabase.from("vendor_registrations").select("status").in("event_id", ids);
      if (vendors) {
        setVendorStats({
          total: vendors.length,
          approved: vendors.filter(v => v.status === "approved").length,
          pending: vendors.filter(v => v.status === "pending").length,
        });
      }

      // Event Page Views
      const { data: views } = await supabase.from("event_views").select("event_id, referrer, created_at").in("event_id", ids);
      if (views) {
        setTotalViews(views.length);

        // Views by event
        const evViewCounts: Record<string, number> = {};
        views.forEach(v => { evViewCounts[v.event_id] = (evViewCounts[v.event_id] || 0) + 1; });
        setViewsByEvent(
          events.map(ev => ({
            name: ev.title.length > 20 ? ev.title.slice(0, 18) + "…" : ev.title,
            views: evViewCounts[ev.id] || 0,
          })).sort((a, b) => b.views - a.views).slice(0, 8)
        );

        // View sources — accurate attribution
        const refCounts: Record<string, number> = {};
        views.forEach(v => {
          let src = "Direct";
          if (v.referrer) {
            try {
              const host = new URL(v.referrer).hostname.replace(/^www\./, "");
              if (host.includes("instagram")) src = "Instagram";
              else if (host.includes("facebook") || host.includes("fb.")) src = "Facebook";
              else if (host.includes("linkedin")) src = "LinkedIn";
              else if (host.includes("twitter") || host.includes("x.com")) src = "X / Twitter";
              else if (host.includes("google")) src = "Google";
              else if (host.includes("t.me") || host.includes("telegram")) src = "Telegram";
              else if (host.includes("tiktok")) src = "TikTok";
              else if (host.includes("youtube")) src = "YouTube";
              else if (host.includes("whatsapp")) src = "WhatsApp";
              else if (host.includes("snapchat")) src = "Snapchat";
              else if (host.includes("reddit")) src = "Reddit";
              else if (host.includes("pinterest")) src = "Pinterest";
              else if (host.includes("threads")) src = "Threads";
              else if (host.includes("bing")) src = "Bing";
              else if (host.includes("yahoo")) src = "Yahoo";
              else if (host === window.location.hostname || host.includes("lovable.app") || host.includes("vionevents.com")) src = "Internal";
              else src = host;
            } catch { src = "Other"; }
          }
          refCounts[src] = (refCounts[src] || 0) + 1;
        });
        setViewSources(Object.entries(refCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

        // Views timeline (14 days)
        const vDaily: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); vDaily[d.toISOString().split("T")[0]] = 0; }
        views.forEach(v => { const d = v.created_at.split("T")[0]; if (d in vDaily) vDaily[d]++; });
        setViewsTimeline(Object.entries(vDaily).map(([date, views]) => ({ date: date.slice(5), views })));
      }

      const localAttRate = approved > 0 ? (checkedIn / approved) * 100 : 0;
      const localConvRate = recs.length > 0 ? (approved / recs.length) * 100 : 0;
      const localRetRate = uniqueEmails > 0 ? (returning / uniqueEmails) * 100 : 0;
      const localAvgRegs = recs.length / Math.max(events.length, 1);

      const attScore = Math.min((localAttRate * 0.35), 35);
      const growthScore = Math.min((localAvgRegs * 0.15), 15);
      const convScore = Math.min((localConvRate * 0.25), 25);
      const retScore = Math.min((localRetRate * 0.15), 15);
      const srcDiversityScore = Math.min(Object.keys(sources).length * 2.5, 10);
      const total = (attScore + growthScore + convScore + retScore + srcDiversityScore);
      setPerformanceScore(Math.min(total, 100));
      setPerformanceBreakdown([
        { label: "Attendance Rate", score: attScore, max: 35 },
        { label: "Conversion Rate", score: convScore, max: 25 },
        { label: "Community Building", score: retScore, max: 15 },
        { label: "Registration Volume", score: growthScore, max: 15 },
        { label: "Source Diversity", score: (srcDiversityScore), max: 10 },
      ]);
    }
  }, [userId, isAdvanced, selectedEventId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Realtime for live dashboard
  useEffect(() => {
    if (!isAdvanced) return;
    const channel = supabase
      .channel("analytics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, () => {
        fetchAnalytics();
      })
      .subscribe();
    setIsLive(true);
    return () => { supabase.removeChannel(channel); setIsLive(false); };
  }, [isAdvanced, fetchAnalytics]);

  // Export functions
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      { Metric: "Total Registrations", Value: totalRegs },
      { Metric: "Total Approved", Value: totalApproved },
      { Metric: "Total Checked In", Value: checkedInCount },
      { Metric: "Attendance Rate", Value: `${attendanceRate}%` },
      { Metric: "No-Show Rate", Value: `${noShowRate}%` },
      { Metric: "No-Shows", Value: noShowCount },
      { Metric: "Conversion Rate", Value: `${conversionRate}%` },
      { Metric: "Revenue (ETB)", Value: revenue },
      { Metric: "Total Events", Value: totalEvents },
      { Metric: "Avg Registrations/Event", Value: avgRegPerEvent },
      ...(isAdvanced ? [
        { Metric: "Peak Arrival Time", Value: peakHour },
        { Metric: "Returning Attendees", Value: `${returningPct}%` },
        { Metric: "First-Time Attendees", Value: `${firstTimePct}%` },
        { Metric: "Event Performance Score", Value: `${performanceScore}/100` },
      ] : []),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyData.map(d => ({ Date: d.date, Registrations: d.count }))), "Daily Registrations");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statusData.map(s => ({ Status: s.name, Count: s.value }))), "Status Breakdown");
    if (isAdvanced) {
      if (sourceData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sourceData.map(s => ({ Source: s.name, Count: s.value }))), "Registration Sources");
      if (attendeeTypeData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendeeTypeData.map(t => ({ Type: t.name, Count: t.value }))), "Ticket Types");
      if (paymentMethodData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentMethodData.map(p => ({ Method: p.name, Count: p.value }))), "Payment Methods");
      if (eventCompareData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventCompareData.map(e => ({ Event: e.name, Registered: e.registered, Attended: e.attended, "Rate %": e.rate }))), "Event Comparison");
      if (peakArrival.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peakArrival.map(p => ({ Hour: p.hour, "Check-ins": p.count }))), "Check-in Times");
      if (checkinTimeline.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(checkinTimeline.map(c => ({ Time: c.time, "Check-ins": c.count }))), "Check-in Timeline");
      if (demographicData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(demographicData.map(d => ({ Organization: d.name, Count: d.value }))), "Demographics");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(funnelData.map(f => ({ Stage: f.stage, Count: f.count, Percentage: `${f.pct}%` }))), "Funnel");
    }
    XLSX.writeFile(wb, `Analytics_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel report exported!");
  };

  const exportCSV = () => {
    const rows = allRegs.map(r => ({
      Name: r.full_name, Email: r.email, Phone: r.phone, Status: r.status,
      "Checked In": r.checked_in ? "Yes" : "No", Source: r.source,
      Type: r.attendee_type, "Payment Method": r.payment_method,
      "Registered At": r.created_at, "Checked In At": r.checked_in_at || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendees");
    XLSX.writeFile(wb, `Attendees_${new Date().toISOString().split("T")[0]}.csv`, { bookType: "csv" });
    toast.success("CSV exported!");
  };

  const isCorporate = !subscriptionEnabled || userPlan === "corporate";

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Analytics Report", 20, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 28);

    let y = 40;
    const lines = [
      `Total Registrations: ${totalRegs}`,
      `Total Approved: ${totalApproved}`,
      `Total Checked In: ${checkedInCount}`,
      `Attendance Rate: ${attendanceRate}%`,
      `No-Show Rate: ${noShowRate}% (${noShowCount} attendees)`,
      `Conversion Rate: ${conversionRate}%`,
      `Revenue: ${revenue.toLocaleString()} ETB`,
      `Total Events: ${totalEvents}`,
      `Avg Registrations/Event: ${avgRegPerEvent}`,
    ];
    if (isAdvanced) {
      lines.push(`Peak Arrival Time: ${peakHour}`, `Returning Attendees: ${returningPct}%`, `First-Time Attendees: ${firstTimePct}%`, `Event Performance Score: ${performanceScore}/100`);
    }
    doc.setFontSize(11);
    lines.forEach(l => { doc.text(l, 20, y); y += 7; });
    doc.save(`Analytics_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF report exported!");
  };

  const exportDetailedPDF = () => {
    if (!isCorporate) {
      toast.error("Detailed analytics report is available on the Corporate plan only.");
      return;
    }

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 0;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 20) { doc.addPage(); y = margin; }
    };

    const drawSectionTitle = (title: string) => {
      checkPage(20);
      doc.setFillColor(245, 190, 50);
      doc.rect(margin, y, pageW - margin * 2, 8, "F");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 3, y + 5.5);
      y += 12;
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
    };

    const drawRow = (label: string, value: string, bold = false) => {
      checkPage(8);
      doc.setFontSize(10);
      if (bold) doc.setFont("helvetica", "bold");
      doc.text(label, margin + 2, y);
      doc.text(value, pageW - margin - 2, y, { align: "right" });
      if (bold) doc.setFont("helvetica", "normal");
      y += 6;
    };

    const drawSeparator = () => {
      checkPage(5);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
    };

    // Title page
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setTextColor(245, 190, 50);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("Detailed Analytics", pageW / 2, 60, { align: "center" });
    doc.text("Report", pageW / 2, 72, { align: "center" });
    doc.setFontSize(12);
    doc.setTextColor(180, 180, 180);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, pageW / 2, 90, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Performance Score: ${performanceScore}/100`, pageW / 2, 102, { align: "center" });

    // Content pages
    doc.addPage();
    y = margin;
    doc.setTextColor(50, 50, 50);

    // 1. Registration Overview
    drawSectionTitle("1. Registration Overview");
    drawRow("Total Registrations", totalRegs.toString(), true);
    drawRow("Total Approved", totalApproved.toString());
    drawRow("Total Checked In", checkedInCount.toString());
    drawRow("Attendance Rate", `${attendanceRate}%`, true);
    drawRow("No-Show Rate", `${noShowRate}%`);
    drawRow("No-Shows", noShowCount.toString());
    drawRow("Remaining Capacity", remainingCapacity !== null ? remainingCapacity.toLocaleString() : "N/A");
    drawRow("Revenue (ETB)", revenue.toLocaleString(), true);
    y += 4;

    // 2. Event Summary
    drawSectionTitle("2. Event Summary");
    drawRow("Total Events", totalEvents.toString());
    drawRow("Avg Registrations/Event", avgRegPerEvent.toString());
    drawRow("Conversion Rate", `${conversionRate}%`);
    y += 4;

    // 3. Registration Funnel
    drawSectionTitle("3. Registration Funnel");
    funnelData.forEach(f => drawRow(f.stage, `${f.count} (${f.pct}%)`));
    y += 4;

    // 4. Returning vs New Attendees
    drawSectionTitle("4. Attendee Retention");
    drawRow("Returning Attendees", `${returningPct}%`, true);
    drawRow("First-Time Attendees", `${firstTimePct}%`);
    y += 4;

    // 5. No-Show Analysis
    drawSectionTitle("5. No-Show Analysis");
    drawRow("Registered (Approved)", totalApproved.toString());
    drawRow("Attended (Checked In)", checkedInCount.toString());
    drawRow("No-Shows", noShowCount.toString(), true);
    drawRow("No-Show Rate", `${noShowRate}%`);
    y += 4;

    // 6. Check-in Insights
    drawSectionTitle("6. Check-in Insights");
    drawRow("Peak Arrival Time", peakHour);
    drawRow("Peak Check-in Window", peakCheckinWindow);
    if (checkinTimeline.length > 0) {
      y += 2;
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("Top check-in intervals:", margin + 2, y); y += 5;
      doc.setFont("helvetica", "normal");
      checkinTimeline.filter(c => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 5).forEach(c => {
        drawRow(`  ${c.time}`, `${c.count} check-ins`);
      });
    }
    y += 4;

    // 7. Registration Sources
    if (sourceData.length > 0) {
      drawSectionTitle("7. Registration Source Tracking");
      sourceData.forEach(s => {
        const pct = totalRegs > 0 ? ((s.value / totalRegs) * 100) : 0;
        drawRow(s.name, `${s.value} (${pct}%)`);
      });
      y += 4;
    }

    // 8. Ticket Type Analytics
    if (attendeeTypeData.length > 0) {
      drawSectionTitle("8. Ticket Type Analytics");
      attendeeTypeData.forEach(t => drawRow(t.name, t.value.toString()));
      y += 4;
    }

    // 9. Payment Methods
    if (paymentMethodData.length > 0) {
      drawSectionTitle("9. Payment Method Breakdown");
      paymentMethodData.forEach(p => drawRow(p.name, p.value.toString()));
      y += 4;
    }

    // 10. Demographics
    if (demographicData.length > 0) {
      drawSectionTitle("10. Attendee Demographics (Organizations)");
      demographicData.forEach((d, i) => drawRow(`${i + 1}. ${d.name}`, d.value.toString()));
      y += 4;
    }

    // 11. Event Comparison
    if (eventCompareData.length > 1) {
      drawSectionTitle("11. Event Comparison");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      checkPage(8);
      doc.text("Event", margin + 2, y);
      doc.text("Registered", margin + 90, y);
      doc.text("Attended", margin + 115, y);
      doc.text("Rate", margin + 140, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      drawSeparator();
      eventCompareData.forEach(e => {
        checkPage(7);
        doc.text(e.name, margin + 2, y);
        doc.text(e.registered.toString(), margin + 95, y);
        doc.text(e.attended.toString(), margin + 120, y);
        doc.text(`${e.rate}%`, margin + 142, y);
        y += 5;
      });
      y += 4;
    }

    // 12. Vendor Analytics
    if (vendorStats.total > 0) {
      drawSectionTitle("12. Vendor Analytics");
      drawRow("Total Vendors", vendorStats.total.toString());
      drawRow("Approved", vendorStats.approved.toString());
      drawRow("Pending", vendorStats.pending.toString());
      y += 4;
    }

    // 13. Daily Registration Data
    drawSectionTitle("13. Daily Registrations (14 days)");
    dailyData.forEach(d => drawRow(d.date, `${d.count} registrations`));
    y += 4;

    // 14. Weekday Distribution
    if (weekdayData.length > 0) {
      drawSectionTitle("14. Registrations by Weekday");
      weekdayData.forEach(w => drawRow(w.day, w.count.toString()));
      y += 4;
    }

    // 15. Performance Score
    drawSectionTitle("15. Event Performance Score");
    drawRow("Overall Score", `${performanceScore}/100`, true);
    drawSeparator();
    performanceBreakdown.forEach(b => drawRow(`  ${b.label}`, `${b.score}/${b.max}`));

    // Footer on last page
    const totalPages = doc.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i - 1} of ${totalPages - 1}`, pageW / 2, pageH - 10, { align: "center" });
      doc.text("ET Events — Detailed Analytics Report", margin, pageH - 10);
    }

    doc.save(`Detailed_Analytics_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Detailed analytics report exported!");
  };

  const tooltipStyle = { backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 8, fontSize: 12 };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-primary";
    if (score >= 40) return "text-yellow-400";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Analytics
            <InfoTooltip title="Event Analytics" description="Your complete event performance hub. All data here is computed from real registration, check-in, and payment records — nothing is estimated." />
            {isLive && isAdvanced && (
              <span className="ml-2 flex items-center gap-1 text-xs font-normal text-green-400">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </span>
            )}
          </h3>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {allEvents.map(ev => (
                <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportExcel} className="border-border hover:border-primary">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="border-border hover:border-primary">
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
          {isAdvanced && (
            <Button variant="outline" size="sm" onClick={exportPDF} className="border-border hover:border-primary">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> PDF
            </Button>
          )}
          {isCorporate ? (
            <Button size="sm" onClick={exportDetailedPDF} className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Analyze
            </Button>
          ) : isAdvanced ? (
            <Button size="sm" disabled className="opacity-50" title="Available on Corporate plan">
              <Lock className="mr-1.5 h-3.5 w-3.5" /> Analyze
            </Button>
          ) : null}
        </div>
      </div>

      {/* 1. Registration Overview */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">Registration Overview <InfoTooltip title="Registration Overview" description="A snapshot of your current registration numbers. Registrations = total sign-ups. Checked-in = people who actually arrived. Attendance & No-Show rates help you plan staffing and future capacity." /></h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Registrations", value: totalRegs, icon: Users },
            { label: "Checked-in", value: checkedInCount, icon: UserCheck },
            { label: "Attendance Rate", value: `${attendanceRate}%`, icon: TrendingUp },
            { label: "No-Show Rate", value: `${noShowRate}%`, icon: EyeOff },
            { label: "Remaining Capacity", value: remainingCapacity !== null ? remainingCapacity.toLocaleString() : "—", icon: Shield },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <s.icon className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="font-display text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Events", value: totalEvents },
          { label: "Revenue (ETB)", value: revenue.toLocaleString() },
          { label: "Avg/Event", value: avgRegPerEvent },
          { label: "Conversion Rate", value: `${conversionRate}%` },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="font-display text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 2. Registration Timeline + Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Registration Timeline (14 days) <InfoTooltip title="Registration Timeline" description="Shows how registrations grew day by day over the last 14 days. Spikes indicate when your promotion efforts or sharing worked best." /></h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(43 100% 50%)" radius={[4, 4, 0, 0]} name="Registrations" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Status Breakdown <InfoTooltip title="Status Breakdown" description="Shows the proportion of Approved, Pending, and Rejected registrations. Useful for tracking how many registrations still need your review." /></h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" labelLine={false}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Advanced Analytics */}
      {isAdvanced ? (
        <>
          {/* 12. Real-Time Dashboard */}
          <div className="rounded-xl border border-primary/30 bg-card p-4 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <Radio className="h-4 w-4 animate-pulse" /> Real-Time Event Dashboard <InfoTooltip title="Real-Time Dashboard" description="Live data updating automatically. Shows today's check-ins, current attendance percentage, peak arrival time, and the most recent arrivals. Best used during your event for live monitoring." />
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-secondary p-3 text-center">
                <p className="font-display text-2xl font-bold text-foreground">{liveCheckins}</p>
                <p className="text-xs text-muted-foreground">Today's Check-ins</p>
              </div>
              <div className="rounded-lg bg-secondary p-3 text-center">
                <p className="font-display text-2xl font-bold text-foreground">{liveRate}%</p>
                <p className="text-xs text-muted-foreground">Today's Attendance</p>
              </div>
              <div className="rounded-lg bg-secondary p-3 text-center col-span-2 sm:col-span-1">
                <p className="font-display text-2xl font-bold text-foreground">{peakHour}</p>
                <p className="text-xs text-muted-foreground">Peak Arrival</p>
              </div>
            </div>
            {recentLiveCheckins.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Recent Arrivals</p>
                {recentLiveCheckins.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-1.5">
                    <span className="text-sm text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Page Views & Sources */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> Event Page Views ({totalViews.toLocaleString()})
                <InfoTooltip title="Event Page Views" description="Total number of times your published event pages were viewed by visitors. Tracks every unique page load across all your events." />
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={viewsTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="views" stroke="hsl(200 80% 55%)" fill="hsl(200 80% 55%)" fillOpacity={0.15} strokeWidth={2} name="Views" />
                </AreaChart>
              </ResponsiveContainer>
              {viewsByEvent.length > 1 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs text-muted-foreground uppercase">Views by Event</p>
                  {viewsByEvent.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-1.5">
                      <span className="text-sm text-foreground truncate max-w-[200px]">{ev.name}</span>
                      <span className="text-sm font-bold text-foreground">{ev.views.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                Viewer Sources
                <InfoTooltip title="Viewer Sources" description="Where your event page visitors are coming from — direct visits, social media platforms (Instagram, Facebook, LinkedIn, etc.), search engines, or other websites. Helps you measure which marketing channels drive the most traffic." />
              </h3>
              {viewSources.length > 0 ? (
                <div className="space-y-3">
                  {viewSources.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-foreground">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{s.value}</span>
                        <span className="text-xs text-muted-foreground">({totalViews > 0 ? ((s.value / totalViews) * 100) : 0}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No view data yet</p>
              )}
              {totalViews > 0 && totalRegs > 0 && (
                <div className="mt-4 rounded-lg bg-secondary p-3 text-center">
                  <p className="text-xs text-muted-foreground">View → Registration Rate</p>
                  <p className="font-display text-xl font-bold text-primary">{((totalRegs / totalViews) * 100)}%</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Check-In Activity Timeline */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Check-In Activity Timeline <InfoTooltip title="Check-In Activity Timeline" description="Tracks when attendees checked in throughout the day in 30-minute intervals. Helps you plan registration desk staffing and understand arrival patterns for future events." /></h3>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">Peak: {peakCheckinWindow}</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={checkinTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="hsl(142 70% 45%)" fill="hsl(142 70% 45%)" fillOpacity={0.15} strokeWidth={2} name="Check-ins" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 5. Returning vs New + 8. No-Show Analysis */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Eye className="mx-auto h-5 w-5 text-green-400 mb-1" />
              <p className="font-display text-2xl font-bold text-green-400">{returningPct}%</p>
              <p className="text-xs text-muted-foreground">Returning Attendees</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Users className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="font-display text-2xl font-bold text-primary">{firstTimePct}%</p>
              <p className="text-xs text-muted-foreground">First-Time Attendees</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <UserX className="mx-auto h-5 w-5 text-destructive mb-1" />
              <p className="font-display text-2xl font-bold text-destructive">{noShowCount}</p>
              <p className="text-xs text-muted-foreground">No-Shows</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Percent className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
              <p className="font-display text-2xl font-bold text-foreground">{noShowRate}%</p>
              <p className="text-xs text-muted-foreground">No-Show Rate</p>
            </div>
          </div>

          {/* Registration Funnel */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Registration Funnel <InfoTooltip title="Registration Funnel" description="Visualizes drop-off at each stage: Registered → Approved → Checked In. A big gap between Approved and Checked In means high no-shows. A gap between Registered and Approved means slow payment reviews." /></h3>
            <div className="flex flex-col gap-3">
              {funnelData.map((f, i) => (
                <div key={f.stage} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{f.stage}</span>
                    <span className="text-muted-foreground">{f.count} ({f.pct}%)</span>
                  </div>
                  <div className="h-8 w-full rounded-lg bg-secondary overflow-hidden">
                    <div className="h-full rounded-lg transition-all duration-700" style={{ width: `${f.pct}%`, background: i === 0 ? "hsl(43 100% 50%)" : i === 1 ? "hsl(43 100% 65%)" : "hsl(142 70% 45%)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 7. Registration Source + 6. Ticket Type */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Registration Sources <InfoTooltip title="Registration Sources" description="Shows where your attendees came from — direct link, door entry, QR self-registration, or imported lists. Helps you understand which marketing channel is driving the most sign-ups." /></h3>
              {sourceData.length > 0 ? (
                <div className="space-y-3">
                  {sourceData.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-foreground">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{s.value}</span>
                        <span className="text-xs text-muted-foreground">({totalRegs > 0 ? ((s.value / totalRegs) * 100) : 0}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Ticket Type Analytics <InfoTooltip title="Ticket Type Analytics" description="Breaks down registrations by attendee type — General, VIP, Speaker, Vendor, etc. Useful for understanding which ticket categories are most popular and planning future pricing." /></h3>
              {attendeeTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attendeeTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} width={80} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="hsl(43 100% 50%)" radius={[0, 4, 4, 0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              )}
            </div>
          </div>

          {/* 4. Attendee Demographics */}
          {demographicData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Attendee Demographics (Organizations) <InfoTooltip title="Attendee Demographics" description="Shows the top organizations your attendees belong to, based on data collected during registration. Helps you understand your audience profile and tailor future events." /></h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {demographicData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">{i + 1}</span>
                      <span className="text-sm text-foreground truncate max-w-[200px]">{d.name}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Payment Methods */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Payment Methods <InfoTooltip title="Payment Methods" description="Shows the distribution of payment methods used by attendees — Bank Transfer, Telebirr, M-Pesa, etc. Helps you decide which payment options to prioritize for future events." /></h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={paymentMethodData} cx="50%" cy="50%" outerRadius={70} dataKey="value" labelLine={false}>
                    {paymentMethodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Weekday Distribution */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Registrations by Weekday <InfoTooltip title="Weekday Distribution" description="Shows which days of the week get the most registrations. Useful for timing your promotions and social media posts for maximum impact." /></h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={weekdayData}>
                  <PolarGrid stroke="hsl(0 0% 20%)" />
                  <PolarAngleAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
                  <PolarRadiusAxis tick={{ fontSize: 10, fill: "hsl(0 0% 40%)" }} />
                  <Radar dataKey="count" stroke="hsl(43 100% 50%)" fill="hsl(43 100% 50%)" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative Growth */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Registration Growth (30 days) <InfoTooltip title="Cumulative Growth" description="Shows the total number of registrations growing over the past 30 days. A steep upward curve means strong momentum. Flat periods may indicate your promotion needs a boost." /></h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total" stroke="hsl(43 100% 50%)" fill="hsl(43 100% 50%)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Peak Arrival Times */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Peak Arrival Times <InfoTooltip title="Peak Arrival Times" description="Shows which hours of the day had the most check-ins. Plan your event schedule, registration desk, and opening activities around when most people actually arrive." /></h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={peakArrival}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="hsl(43 100% 50%)" strokeWidth={2} dot={{ fill: "hsl(43 100% 50%)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 9. Vendor Analytics */}
          {vendorStats.total > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Store className="h-4 w-4" /> Vendor Analytics <InfoTooltip title="Vendor Analytics" description="Summary of vendor registrations for your events — total applications, approved vendors, and those still pending review." />
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="font-display text-xl font-bold text-foreground">{vendorStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Vendors</p>
                </div>
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="font-display text-xl font-bold text-green-400">{vendorStats.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="font-display text-xl font-bold text-primary">{vendorStats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </div>
          )}

          {/* 11. Event Performance Score */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Star className="h-4 w-4" /> Event Performance Score <InfoTooltip title="Performance Score" description="A composite score (0–100) calculated from your actual data: Attendance Rate (35%), Conversion Rate (25%), Community Building i.e. returning attendees (15%), Registration Volume (15%), and Source Diversity (10%). Higher scores mean better overall event health." />
            </h3>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
              <div className="flex flex-col items-center">
                <p className={`font-display text-5xl font-black ${getScoreColor(performanceScore)}`}>{performanceScore}</p>
                <p className="text-sm text-muted-foreground">/100</p>
              </div>
              <div className="flex-1 space-y-2 w-full">
                {performanceBreakdown.map(b => (
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

          {/* Event Comparison */}
          {eventCompareData.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">Event Comparison <InfoTooltip title="Event Comparison" description="Side-by-side comparison of your events by registration count and attendance. Quickly see which events performed best and identify patterns." /></h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={eventCompareData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="registered" fill="hsl(43 100% 50%)" name="Registered" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="attended" fill="hsl(142 70% 45%)" name="Attended" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="font-display text-lg font-bold text-foreground">Advanced Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Real-time dashboard, check-in timeline, attendee demographics, no-show analysis, registration sources, ticket type analytics, vendor analytics, event performance score, and exportable PDF reports are available on the Pro and Corporate plans.
          </p>
        </div>
      )}
    </div>
  );
};

export default OrganizerAnalytics;
