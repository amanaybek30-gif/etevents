import { BarChart3 } from "lucide-react";
import InfoTooltip from "../InfoTooltip";
import type { AttendeeProfile } from "./types";

interface Props {
  profiles: AttendeeProfile[];
}

const CRMTopSegments = ({ profiles }: Props) => {
  if (profiles.length === 0) return null;

  const returning = profiles.filter(p => p.totalRegistered > 1).length;
  const firstTime = profiles.filter(p => p.totalRegistered === 1).length;
  const frequent = profiles.filter(p => p.totalAttended >= 3).length;
  const noShow = profiles.filter(p => p.totalRegistered > 0 && p.totalAttended === 0).length;
  const highEngagement = profiles.filter(p => p.attendanceRate >= 80).length;

  const segments = [
    { label: "First-Time", count: firstTime, color: "bg-blue-500" },
    { label: "Returning", count: returning, color: "bg-emerald-500" },
    { label: "Frequent (3+)", count: frequent, color: "bg-amber-500" },
    { label: "High Engagement (80%+)", count: highEngagement, color: "bg-primary" },
    { label: "No-Shows", count: noShow, color: "bg-destructive" },
  ].sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...segments.map(s => s.count), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" /> Top Attendee Segments <InfoTooltip title="Audience Segments" description="Automatically groups your attendees by behavior: First-Time (1 event), Returning (2+), Frequent (3+), High Engagement (80%+ attendance), and No-Shows (registered but never attended). Use these to target your communication." />
      </h4>
      <div className="space-y-3">
        {segments.map(s => (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold text-foreground">{s.count}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary">
              <div
                className={`h-2 rounded-full ${s.color} transition-all`}
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CRMTopSegments;
