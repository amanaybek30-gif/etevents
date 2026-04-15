import { Users, TrendingUp, UserCheck, UserX } from "lucide-react";
import InfoTooltip from "../InfoTooltip";

interface Props {
  totalUnique: number;
  avgAttendance: number;
  returningPct: number;
  firstTimePct: number;
}

const CRMStatsCards = ({ totalUnique, avgAttendance, returningPct, firstTimePct }: Props) => {
  const stats = [
    { label: "Unique Attendees", value: totalUnique.toLocaleString(), icon: Users, help: "Total distinct people who have registered across all your events, deduplicated by email and phone." },
    { label: "Avg Attendance Rate", value: `${avgAttendance}%`, icon: TrendingUp, help: "Average percentage of events each attendee actually showed up to after registering." },
    { label: "Returning Attendees", value: `${returningPct}%`, icon: UserCheck, help: "Percentage of attendees who have registered for more than one of your events — a sign you're building community." },
    { label: "First-Time Attendees", value: `${firstTimePct}%`, icon: UserX, help: "Percentage of attendees who have only attended one event so far. Convert them into returning attendees with great experiences." },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
          <s.icon className="mx-auto h-5 w-5 text-primary mb-1" />
          <p className="font-display text-xl font-bold text-foreground">{s.value}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">{s.label} <InfoTooltip title={s.label} description={s.help} /></p>
        </div>
      ))}
    </div>
  );
};

export default CRMStatsCards;
