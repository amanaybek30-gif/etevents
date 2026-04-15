import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deduplicateRegistrations } from "@/lib/deduplicateRegistrations";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  Users, Calendar, TrendingUp, DollarSign, Download, UserCheck, UserX,
  BarChart3, Activity, Star, Store, CreditCard, Shield, Clock, Percent, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import InfoTooltip from "@/components/organizer/InfoTooltip";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { toast } from "sonner";

const COLORS = [
  "hsl(43 100% 50%)", "hsl(200 80% 55%)", "hsl(142 70% 45%)",
  "hsl(0 80% 55%)", "hsl(280 70% 55%)", "hsl(43 100% 65%)",
  "hsl(330 70% 55%)", "hsl(170 60% 45%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(0 0% 7%)",
  border: "1px solid hsl(0 0% 18%)",
  borderRadius: 8,
  fontSize: 12,
};

const AdminAnalytics = () => {
  // Platform KPIs
  const [totalRegs, setTotalRegs] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalOrganizers, setTotalOrganizers] = useState(0);
  const [totalCheckedIn, setTotalCheckedIn] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [totalRejected, setTotalRejected] = useState(0);
  const [platformAttendanceRate, setPlatformAttendanceRate] = useState(0);
  const [platformNoShowRate, setPlatformNoShowRate] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalVendors, setTotalVendors] = useState(0);
  const [totalSurveys, setTotalSurveys] = useState(0);
  const [totalSurveyResponses, setTotalSurveyResponses] = useState(0);

  // Charts
  const [regTimeline, setRegTimeline] = useState<{ date: string; count: number }[]>([]);
  const [cumulativeRegs, setCumulativeRegs] = useState<{ date: string; total: number }[]>([]);
  const [orgSignups, setOrgSignups] = useState<{ date: string; count: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<{ name: string; value: number }[]>([]);
  const [sourceData, setSourceData] = useState<{ name: string; value: number }[]>([]);
  const [attendeeTypeData, setAttendeeTypeData] = useState<{ name: string; value: number }[]>([]);
  const [topEvents, setTopEvents] = useState<{ name: string; registered: number; attended: number }[]>([]);
  const [topOrganizers, setTopOrganizers] = useState<{ name: string; events: number; registrations: number; plan: string }[]>([]);
  const [planDistribution, setPlanDistribution] = useState<{ name: string; value: number }[]>([]);
  const [weekdayData, setWeekdayData] = useState<{ day: string; count: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [checkinTimeline, setCheckinTimeline] = useState<{ hour: string; count: number }[]>([]);
  const [peakHour, setPeakHour] = useState("N/A");
  const [returningPct, setReturningPct] = useState(0);
  const [firstTimePct, setFirstTimePct] = useState(0);
  const [avgRegsPerEvent, setAvgRegsPerEvent] = useState(0);
  const [avgRegsPerOrganizer, setAvgRegsPerOrganizer] = useState(0);
  const [publishedEvents, setPublishedEvents] = useState(0);
  const [draftEvents, setDraftEvents] = useState(0);
  const [performanceScore, setPerformanceScore] = useState(0);
  const [performanceBreakdown, setPerformanceBreakdown] = useState<{ label: string; score: number; max: number }[]>([]);

  // Raw data for export
  const [allRegs, setAllRegs] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    const [regsRes, eventsRes, orgsRes, vendorsRes, surveysRes, surveyRespRes] = await Promise.all([
      supabase.from("registrations").select("created_at, status, checked_in, checked_in_at, event_id, email, phone, source, attendee_type, payment_method, full_name"),
      supabase.from("events").select("id, title, category, date, ticket_price, organizer_id, is_published, expected_attendees"),
      supabase.from("organizer_profiles").select("user_id, organization_name, subscription_plan, created_at, email, phone, city"),
      supabase.from("vendor_registrations").select("id, status", { count: "exact", head: true }),
      supabase.from("surveys").select("id", { count: "exact", head: true }),
      supabase.from("survey_responses").select("id", { count: "exact", head: true }),
    ]);

    const rawRegs = regsRes.data || [];
    const events = eventsRes.data || [];
    const orgs = orgsRes.data || [];
    const regs = deduplicateRegistrations(rawRegs);

    setAllRegs(regs);
    setAllEvents(events);
    setAllOrgs(orgs);
    setTotalVendors(vendorsRes.count ?? 0);
    setTotalSurveys(surveysRes.count ?? 0);
    setTotalSurveyResponses(surveyRespRes.count ?? 0);

    // Platform KPIs
    setTotalRegs(regs.length);
    setTotalEvents(events.length);
    setTotalOrganizers(orgs.length);
    const approved = regs.filter(r => r.status === "approved").length;
    const pending = regs.filter(r => r.status === "pending").length;
    const rejected = regs.filter(r => r.status === "rejected").length;
    const checkedIn = regs.filter(r => r.checked_in).length;
    const noShows = Math.max(approved - checkedIn, 0);
    setTotalApproved(approved);
    setTotalPending(pending);
    setTotalRejected(rejected);
    setTotalCheckedIn(checkedIn);
    setPlatformAttendanceRate(approved > 0 ? Math.round((checkedIn / approved) * 100) : 0);
    setPlatformNoShowRate(approved > 0 ? Math.round((noShows / approved) * 100) : 0);
    setPublishedEvents(events.filter(e => e.is_published).length);
    setDraftEvents(events.filter(e => !e.is_published).length);
    setAvgRegsPerEvent(events.length > 0 ? Math.round(regs.length / events.length) : 0);
    setAvgRegsPerOrganizer(orgs.length > 0 ? Math.round(regs.length / orgs.length) : 0);

    // Revenue
    let rev = 0;
    regs.filter(r => r.status === "approved").forEach(r => {
      const ev = events.find(e => e.id === r.event_id);
      if (ev) {
        const price = parseFloat(ev.ticket_price?.replace(/[^0-9.]/g, "") || "0");
        if (!isNaN(price)) rev += price;
      }
    });
    setTotalRevenue(rev);

    // Status breakdown
    setStatusData([
      { name: "Approved", value: approved },
      { name: "Pending", value: pending },
      { name: "Rejected", value: rejected },
    ]);

    // Registration timeline (30 days)
    const now = new Date();
    const daily: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      daily[d.toISOString().split("T")[0]] = 0;
    }
    regs.forEach(r => { const d = r.created_at.split("T")[0]; if (d in daily) daily[d]++; });
    setRegTimeline(Object.entries(daily).map(([date, count]) => ({ date: date.slice(5), count })));

    // Cumulative
    let cumTotal = 0;
    setCumulativeRegs(Object.entries(daily).map(([date, count]) => { cumTotal += count; return { date: date.slice(5), total: cumTotal }; }));

    // Organizer signups (30 days)
    const orgDaily: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      orgDaily[d.toISOString().split("T")[0]] = 0;
    }
    orgs.forEach(o => { const d = o.created_at.split("T")[0]; if (d in orgDaily) orgDaily[d]++; });
    setOrgSignups(Object.entries(orgDaily).map(([date, count]) => ({ date: date.slice(5), count })));

    // Payment methods
    const payments: Record<string, number> = {};
    const PAY_LABELS: Record<string, string> = { bank_transfer: "Bank Transfer", telebirr: "Telebirr", mpessa: "M-Pesa", cash: "Cash", door: "Door", free: "Free", other: "Other" };
    regs.forEach(r => { const pm = PAY_LABELS[r.payment_method] || r.payment_method || "Other"; payments[pm] = (payments[pm] || 0) + 1; });
    setPaymentMethodData(Object.entries(payments).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

    // Registration sources
    const sources: Record<string, number> = {};
    const SRC_LABELS: Record<string, string> = { platform: "Direct Link", door: "Door Entry", "qr-self": "QR Self-Register", import: "Import/Upload" };
    regs.forEach(r => { const src = SRC_LABELS[r.source] || r.source || "Unknown"; sources[src] = (sources[src] || 0) + 1; });
    setSourceData(Object.entries(sources).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

    // Attendee types
    const types: Record<string, number> = {};
    const TYPE_LABELS: Record<string, string> = { participant: "General", vendor: "Vendor", speaker: "Speaker", vip: "VIP", media: "Media", other: "Other" };
    regs.forEach(r => { const t = TYPE_LABELS[r.attendee_type] || r.attendee_type || "General"; types[t] = (types[t] || 0) + 1; });
    setAttendeeTypeData(Object.entries(types).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

    // Top events
    const eventMap = Object.fromEntries(events.map(e => [e.id, e.title]));
    const eventRegCount: Record<string, { registered: number; attended: number }> = {};
    regs.forEach(r => {
      if (!eventRegCount[r.event_id]) eventRegCount[r.event_id] = { registered: 0, attended: 0 };
      eventRegCount[r.event_id].registered++;
      if (r.checked_in) eventRegCount[r.event_id].attended++;
    });
    setTopEvents(
      Object.entries(eventRegCount)
        .sort((a, b) => b[1].registered - a[1].registered)
        .slice(0, 8)
        .map(([id, data]) => ({
          name: (eventMap[id] || "Unknown").length > 20 ? (eventMap[id] || "Unknown").slice(0, 18) + "…" : eventMap[id] || "Unknown",
          registered: data.registered,
          attended: data.attended,
        }))
    );

    // Top organizers
    const orgMap = Object.fromEntries(orgs.map(o => [o.user_id, { name: o.organization_name, plan: o.subscription_plan }]));
    const orgRegCount: Record<string, number> = {};
    const orgEventCount: Record<string, number> = {};
    events.forEach(e => { if (e.organizer_id) orgEventCount[e.organizer_id] = (orgEventCount[e.organizer_id] || 0) + 1; });
    regs.forEach(r => {
      const ev = events.find(e => e.id === r.event_id);
      if (ev?.organizer_id) orgRegCount[ev.organizer_id] = (orgRegCount[ev.organizer_id] || 0) + 1;
    });
    setTopOrganizers(
      Object.entries(orgEventCount)
        .sort((a, b) => (orgRegCount[b[0]] || 0) - (orgRegCount[a[0]] || 0))
        .slice(0, 8)
        .map(([uid, eventCount]) => ({
          name: orgMap[uid]?.name || "Unknown",
          events: eventCount,
          registrations: orgRegCount[uid] || 0,
          plan: orgMap[uid]?.plan || "free",
        }))
    );

    // Plan distribution
    const planCounts: Record<string, number> = {};
    orgs.forEach(o => { const p = o.subscription_plan || "free"; planCounts[p] = (planCounts[p] || 0) + 1; });
    setPlanDistribution(Object.entries(planCounts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })));

    // Event categories
    const catCounts: Record<string, number> = {};
    events.forEach(e => { catCounts[e.category] = (catCounts[e.category] || 0) + 1; });
    setCategoryData(Object.entries(catCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8));

    // Weekday distribution
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts: Record<string, number> = {};
    days.forEach(d => { dayCounts[d] = 0; });
    regs.forEach(r => { dayCounts[days[new Date(r.created_at).getDay()]]++; });
    setWeekdayData(days.map(d => ({ day: d, count: dayCounts[d] })));

    // Check-in timeline (hourly)
    const hourCounts: Record<string, number> = {};
    for (let h = 6; h <= 23; h++) hourCounts[`${h.toString().padStart(2, "0")}:00`] = 0;
    regs.filter(r => r.checked_in_at).forEach(r => {
      const hour = new Date(r.checked_in_at!).getHours();
      const key = `${hour.toString().padStart(2, "0")}:00`;
      if (key in hourCounts) hourCounts[key]++;
    });
    const peakArr = Object.entries(hourCounts).map(([hour, count]) => ({ hour, count }));
    setCheckinTimeline(peakArr);
    const maxEntry = peakArr.reduce((max, e) => e.count > max.count ? e : max, { hour: "", count: 0 });
    setPeakHour(maxEntry.count > 0 ? maxEntry.hour : "N/A");

    // Returning vs first-time
    const emailCounts: Record<string, number> = {};
    regs.forEach(r => { emailCounts[r.email] = (emailCounts[r.email] || 0) + 1; });
    const uniqueEmails = Object.keys(emailCounts).length;
    const returning = Object.values(emailCounts).filter(c => c > 1).length;
    setReturningPct(uniqueEmails > 0 ? Math.round((returning / uniqueEmails) * 100) : 0);
    setFirstTimePct(uniqueEmails > 0 ? 100 - Math.round((returning / uniqueEmails) * 100) : 0);

    // Platform Performance Score
    const attScore = approved > 0 ? Math.min(Math.round(((checkedIn / approved) * 100) * 0.25), 25) : 0;
    const growthScore = Math.min(Math.round((regs.length / Math.max(events.length, 1)) * 0.2), 20);
    const convScore = regs.length > 0 ? Math.min(Math.round(((approved / regs.length) * 100) * 0.2), 20) : 0;
    const orgGrowthScore = Math.min(orgs.length * 2, 15);
    const eventDiversityScore = Math.min(Object.keys(catCounts).length * 2, 10);
    const retScore = Math.min(Math.round((returning / Math.max(uniqueEmails, 1)) * 100 * 0.1), 10);
    const total = Math.round(attScore + growthScore + convScore + orgGrowthScore + eventDiversityScore + retScore);
    setPerformanceScore(Math.min(total, 100));
    setPerformanceBreakdown([
      { label: "Attendance Rate", score: attScore, max: 25 },
      { label: "Registration Volume", score: growthScore, max: 20 },
      { label: "Conversion Rate", score: convScore, max: 20 },
      { label: "Organizer Growth", score: orgGrowthScore, max: 15 },
      { label: "Event Diversity", score: eventDiversityScore, max: 10 },
      { label: "Community Retention", score: retScore, max: 10 },
    ]);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Export Excel
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary
    const summaryRows = [
      { Metric: "Total Registrations", Value: totalRegs },
      { Metric: "Total Events", Value: totalEvents },
      { Metric: "Total Organizers", Value: totalOrganizers },
      { Metric: "Published Events", Value: publishedEvents },
      { Metric: "Draft Events", Value: draftEvents },
      { Metric: "Total Approved", Value: totalApproved },
      { Metric: "Total Pending", Value: totalPending },
      { Metric: "Total Rejected", Value: totalRejected },
      { Metric: "Total Checked In", Value: totalCheckedIn },
      { Metric: "Attendance Rate", Value: `${platformAttendanceRate}%` },
      { Metric: "No-Show Rate", Value: `${platformNoShowRate}%` },
      { Metric: "Revenue (ETB)", Value: totalRevenue },
      { Metric: "Avg Regs/Event", Value: avgRegsPerEvent },
      { Metric: "Avg Regs/Organizer", Value: avgRegsPerOrganizer },
      { Metric: "Returning Attendees", Value: `${returningPct}%` },
      { Metric: "First-Time Attendees", Value: `${firstTimePct}%` },
      { Metric: "Peak Check-in Hour", Value: peakHour },
      { Metric: "Total Vendors", Value: totalVendors },
      { Metric: "Total Surveys", Value: totalSurveys },
      { Metric: "Survey Responses", Value: totalSurveyResponses },
      { Metric: "Platform Score", Value: `${performanceScore}/100` },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Platform Summary");

    // Registrations
    const regRows = allRegs.map(r => ({
      Name: r.full_name, Email: r.email, Phone: r.phone, Status: r.status,
      "Checked In": r.checked_in ? "Yes" : "No", Source: r.source,
      Type: r.attendee_type, "Payment Method": r.payment_method,
      "Registered At": r.created_at, "Checked In At": r.checked_in_at || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(regRows), "All Registrations");

    // Events
    const eventRows = allEvents.map(e => ({
      Title: e.title, Category: e.category, Date: e.date,
      "Ticket Price": e.ticket_price, Published: e.is_published ? "Yes" : "No",
      "Expected Attendees": e.expected_attendees || "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows), "All Events");

    // Organizers
    const orgRows = allOrgs.map(o => ({
      Organization: o.organization_name, Email: o.email || "—", Phone: o.phone || "—",
      Plan: o.subscription_plan, City: o.city || "—", "Joined At": o.created_at,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orgRows), "All Organizers");

    // Charts data
    if (sourceData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sourceData.map(s => ({ Source: s.name, Count: s.value }))), "Registration Sources");
    if (paymentMethodData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentMethodData.map(p => ({ Method: p.name, Count: p.value }))), "Payment Methods");
    if (topOrganizers.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topOrganizers.map(o => ({ Organization: o.name, Events: o.events, Registrations: o.registrations, Plan: o.plan }))), "Top Organizers");
    if (planDistribution.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planDistribution.map(p => ({ Plan: p.name, Count: p.value }))), "Plan Distribution");

    XLSX.writeFile(wb, `Admin_Analytics_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel report exported!");
  };

  // Export CSV
  const exportCSV = () => {
    const rows = allRegs.map(r => ({
      Name: r.full_name, Email: r.email, Phone: r.phone, Status: r.status,
      "Checked In": r.checked_in ? "Yes" : "No", Source: r.source,
      Type: r.attendee_type, "Payment Method": r.payment_method,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrations");
    XLSX.writeFile(wb, `Admin_Registrations_${new Date().toISOString().split("T")[0]}.csv`, { bookType: "csv" });
    toast.success("CSV exported!");
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 0;

    const checkPage = (needed: number) => { if (y + needed > pageH - 20) { doc.addPage(); y = margin; } };
    const drawSection = (title: string) => {
      checkPage(20);
      doc.setFillColor(245, 190, 50);
      doc.rect(margin, y, pageW - margin * 2, 8, "F");
      doc.setFontSize(11); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
      doc.text(title, margin + 3, y + 5.5);
      y += 12; doc.setTextColor(50, 50, 50); doc.setFont("helvetica", "normal");
    };
    const drawRow = (label: string, value: string, bold = false) => {
      checkPage(8); doc.setFontSize(10);
      if (bold) doc.setFont("helvetica", "bold");
      doc.text(label, margin + 2, y);
      doc.text(value, pageW - margin - 2, y, { align: "right" });
      if (bold) doc.setFont("helvetica", "normal");
      y += 6;
    };

    // Cover
    doc.setFillColor(20, 20, 20); doc.rect(0, 0, pageW, pageH, "F");
    doc.setTextColor(245, 190, 50); doc.setFontSize(28); doc.setFont("helvetica", "bold");
    doc.text("Platform Analytics", pageW / 2, 55, { align: "center" });
    doc.text("Admin Report", pageW / 2, 67, { align: "center" });
    doc.setFontSize(12); doc.setTextColor(180, 180, 180); doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, pageW / 2, 85, { align: "center" });
    doc.text(`Platform Score: ${performanceScore}/100`, pageW / 2, 97, { align: "center" });

    doc.addPage(); y = margin; doc.setTextColor(50, 50, 50);

    drawSection("1. Platform Overview");
    drawRow("Total Registrations", totalRegs.toLocaleString(), true);
    drawRow("Total Events", totalEvents.toString());
    drawRow("Published Events", publishedEvents.toString());
    drawRow("Draft Events", draftEvents.toString());
    drawRow("Total Organizers", totalOrganizers.toString());
    drawRow("Total Vendors", totalVendors.toString());
    drawRow("Total Surveys", totalSurveys.toString());
    drawRow("Survey Responses", totalSurveyResponses.toString());
    y += 4;

    drawSection("2. Registration Metrics");
    drawRow("Total Approved", totalApproved.toString(), true);
    drawRow("Total Pending", totalPending.toString());
    drawRow("Total Rejected", totalRejected.toString());
    drawRow("Total Checked In", totalCheckedIn.toString());
    drawRow("Attendance Rate", `${platformAttendanceRate}%`, true);
    drawRow("No-Show Rate", `${platformNoShowRate}%`);
    drawRow("Avg Regs/Event", avgRegsPerEvent.toString());
    drawRow("Avg Regs/Organizer", avgRegsPerOrganizer.toString());
    y += 4;

    drawSection("3. Revenue");
    drawRow("Total Revenue (ETB)", totalRevenue.toLocaleString(), true);
    y += 4;

    drawSection("4. Attendee Retention");
    drawRow("Returning Attendees", `${returningPct}%`, true);
    drawRow("First-Time Attendees", `${firstTimePct}%`);
    y += 4;

    drawSection("5. Registration Sources");
    sourceData.forEach(s => {
      const pct = totalRegs > 0 ? Math.round((s.value / totalRegs) * 100) : 0;
      drawRow(s.name, `${s.value} (${pct}%)`);
    });
    y += 4;

    drawSection("6. Payment Methods");
    paymentMethodData.forEach(p => drawRow(p.name, p.value.toString()));
    y += 4;

    drawSection("7. Ticket Types");
    attendeeTypeData.forEach(t => drawRow(t.name, t.value.toString()));
    y += 4;

    drawSection("8. Plan Distribution");
    planDistribution.forEach(p => drawRow(p.name, p.value.toString()));
    y += 4;

    drawSection("9. Top Events");
    topEvents.forEach((e, i) => drawRow(`${i + 1}. ${e.name}`, `${e.registered} reg / ${e.attended} attended`));
    y += 4;

    drawSection("10. Top Organizers");
    topOrganizers.forEach((o, i) => drawRow(`${i + 1}. ${o.name} (${o.plan})`, `${o.events} events / ${o.registrations} regs`));
    y += 4;

    drawSection("11. Check-in Insights");
    drawRow("Peak Check-in Hour", peakHour, true);
    y += 4;

    drawSection("12. Event Categories");
    categoryData.forEach(c => drawRow(c.name, c.value.toString()));
    y += 4;

    drawSection("13. Platform Performance Score");
    drawRow("Overall Score", `${performanceScore}/100`, true);
    performanceBreakdown.forEach(b => drawRow(`  ${b.label}`, `${b.score}/${b.max}`));

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i - 1} of ${totalPages - 1}`, pageW / 2, pageH - 10, { align: "center" });
      doc.text("ET Events — Admin Platform Analytics Report", margin, pageH - 10);
    }

    doc.save(`Admin_Platform_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF report exported!");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-primary";
    if (score >= 40) return "text-yellow-400";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Platform Analytics
          <InfoTooltip title="Platform Analytics" description="A complete overview of the entire platform's performance — all organizers, events, and registrations combined. Every metric is computed from real data in your database." />
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportExcel} className="border-border hover:border-primary">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="border-border hover:border-primary">
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" onClick={exportPDF} className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90">
            <Download className="mr-1.5 h-3.5 w-3.5" /> PDF Report
          </Button>
        </div>
      </div>

      {/* Platform KPIs */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          Platform Overview <InfoTooltip title="Platform Overview" description="High-level numbers across the entire platform. These are totals from all organizers and all events combined." />
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Registrations", value: totalRegs.toLocaleString(), icon: Users },
            { label: "Events", value: totalEvents, icon: Calendar },
            { label: "Organizers", value: totalOrganizers, icon: UserCheck },
            { label: "Checked In", value: totalCheckedIn.toLocaleString(), icon: Activity },
            { label: "Attendance Rate", value: `${platformAttendanceRate}%`, icon: TrendingUp },
            { label: "Revenue (ETB)", value: totalRevenue.toLocaleString(), icon: DollarSign },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <s.icon className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="font-display text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { label: "Approved", value: totalApproved },
          { label: "Pending", value: totalPending },
          { label: "Rejected", value: totalRejected },
          { label: "No-Show Rate", value: `${platformNoShowRate}%` },
          { label: "Published", value: publishedEvents },
          { label: "Drafts", value: draftEvents },
          { label: "Avg/Event", value: avgRegsPerEvent },
          { label: "Avg/Organizer", value: avgRegsPerOrganizer },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="font-display text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Registration Timeline + Cumulative Growth */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Registration Timeline (30 days) <InfoTooltip title="Registration Timeline" description="Daily registration count over the past 30 days. Spikes show when marketing efforts or event announcements drove sign-ups." />
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={regTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(43 100% 50%)" radius={[4, 4, 0, 0]} name="Registrations" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Cumulative Growth <InfoTooltip title="Cumulative Growth" description="Running total of registrations over the past 30 days. A steep upward curve shows strong platform momentum." />
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={cumulativeRegs}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="total" stroke="hsl(43 100% 50%)" fill="hsl(43 100% 50%)" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Breakdown + Organizer Signups */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Status Breakdown <InfoTooltip title="Status Breakdown" description="Proportion of all registrations by status. Tracks how many are approved, pending review, or rejected." />
          </h3>
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

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Organizer Signups (30 days) <InfoTooltip title="Organizer Signups" description="How many new organizers registered on the platform over the past 30 days." />
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={orgSignups}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(200 80% 55%)" radius={[4, 4, 0, 0]} name="Signups" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Returning vs New + No-Show + Extras */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Eye className="mx-auto h-5 w-5 text-primary mb-1" />
          <p className="font-display text-2xl font-bold text-primary">{returningPct}%</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">Returning <InfoTooltip title="Returning Attendees" description="Percentage of unique attendees who registered for more than one event across the entire platform." /></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Users className="mx-auto h-5 w-5 text-primary mb-1" />
          <p className="font-display text-2xl font-bold text-primary">{firstTimePct}%</p>
          <p className="text-xs text-muted-foreground">First-Time</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <UserX className="mx-auto h-5 w-5 text-destructive mb-1" />
          <p className="font-display text-2xl font-bold text-destructive">{platformNoShowRate}%</p>
          <p className="text-xs text-muted-foreground">No-Show Rate</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Clock className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
          <p className="font-display text-2xl font-bold text-foreground">{peakHour}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">Peak Check-in <InfoTooltip title="Peak Check-in Hour" description="The hour of the day when the most attendees checked in across all events." /></p>
        </div>
      </div>

      {/* Sources + Ticket Types */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Registration Sources <InfoTooltip title="Registration Sources" description="Where attendees came from — direct link, door entry, QR self-registration, or bulk imports. Helps evaluate which channels drive growth." />
          </h3>
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
                    <span className="text-xs text-muted-foreground">({totalRegs > 0 ? Math.round((s.value / totalRegs) * 100) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Ticket Types <InfoTooltip title="Ticket Types" description="Breakdown of registrations by attendee type — General, VIP, Speaker, Vendor, etc. across all platform events." />
          </h3>
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
          ) : <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
        </div>
      </div>

      {/* Payment Methods + Plan Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Payment Methods <InfoTooltip title="Payment Methods" description="How attendees paid across all events — Bank Transfer, Telebirr, M-Pesa, etc." />
          </h3>
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

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Subscription Plan Distribution <InfoTooltip title="Plan Distribution" description="How organizers are distributed across subscription plans — Free, Organizer, Pro, and Corporate." />
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={planDistribution} cx="50%" cy="50%" outerRadius={70} dataKey="value" labelLine={false}>
                {planDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Check-in Timeline */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          Check-in Activity by Hour <InfoTooltip title="Check-in Activity" description="Hourly distribution of all check-ins across every event. Shows when attendees typically arrive." />
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={checkinTimeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="count" stroke="hsl(142 70% 45%)" strokeWidth={2} dot={{ fill: "hsl(142 70% 45%)", r: 3 }} name="Check-ins" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Weekday + Categories */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Registrations by Weekday <InfoTooltip title="Weekday Distribution" description="Which days of the week see the most registrations platform-wide." />
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={weekdayData}>
              <PolarGrid stroke="hsl(0 0% 20%)" />
              <PolarAngleAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
              <PolarRadiusAxis tick={{ fontSize: 10, fill: "hsl(0 0% 40%)" }} />
              <Radar dataKey="count" stroke="hsl(43 100% 50%)" fill="hsl(43 100% 50%)" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Event Categories <InfoTooltip title="Event Categories" description="Distribution of events by category — shows which event types are most popular on the platform." />
          </h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="hsl(280 70% 55%)" radius={[0, 4, 4, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
        </div>
      </div>

      {/* Top Events */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          Top Events <InfoTooltip title="Top Events" description="Events with the most registrations, showing both registration and attendance counts for comparison." />
        </h3>
        {topEvents.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topEvents}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(0 0% 60%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 60%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="registered" fill="hsl(43 100% 50%)" name="Registered" radius={[4, 4, 0, 0]} />
              <Bar dataKey="attended" fill="hsl(142 70% 45%)" name="Attended" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
      </div>

      {/* Top Organizers */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          Top Organizers <InfoTooltip title="Top Organizers" description="Organizers ranked by total registrations. Shows their event count and subscription plan." />
        </h3>
        <div className="space-y-2">
          {topOrganizers.map((o, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-secondary p-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground truncate block">{o.name}</span>
                  <span className="text-[10px] text-muted-foreground">{o.plan} plan</span>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-sm font-bold text-foreground">{o.registrations.toLocaleString()} regs</p>
                <p className="text-[10px] text-muted-foreground">{o.events} events</p>
              </div>
            </div>
          ))}
          {topOrganizers.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
        </div>
      </div>

      {/* Platform extras row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Store className="mx-auto h-5 w-5 text-primary mb-1" />
          <p className="font-display text-xl font-bold text-foreground">{totalVendors}</p>
          <p className="text-xs text-muted-foreground">Total Vendors</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Shield className="mx-auto h-5 w-5 text-primary mb-1" />
          <p className="font-display text-xl font-bold text-foreground">{totalSurveys}</p>
          <p className="text-xs text-muted-foreground">Total Surveys</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <CreditCard className="mx-auto h-5 w-5 text-primary mb-1" />
          <p className="font-display text-xl font-bold text-foreground">{totalSurveyResponses}</p>
          <p className="text-xs text-muted-foreground">Survey Responses</p>
        </div>
      </div>

      {/* Platform Performance Score */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Star className="h-4 w-4" /> Platform Performance Score
          <InfoTooltip title="Platform Performance Score" description="A composite score (0–100) measuring overall platform health: Attendance Rate (25%), Registration Volume (20%), Conversion Rate (20%), Organizer Growth (15%), Event Diversity (10%), and Community Retention (10%)." />
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
    </div>
  );
};

export default AdminAnalytics;
