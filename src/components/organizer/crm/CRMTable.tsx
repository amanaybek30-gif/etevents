import { Button } from "@/components/ui/button";
import { Eye, Star } from "lucide-react";
import type { AttendeeProfile } from "./types";
import { fmt1 } from "@/lib/formatMetric";

interface Props {
  profiles: AttendeeProfile[];
  onSelect: (p: AttendeeProfile) => void;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-yellow-400";
  return "text-muted-foreground";
};

const CRMTable = ({ profiles, onSelect }: Props) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary">
          <tr>
            {["Name", "Email", "Organization", "Tags", "Registered", "Attended", "Rate", "Score", "Last Event", ""].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map(p => (
            <tr key={p.email} className="border-b border-border hover:bg-secondary/50 cursor-pointer" onClick={() => onSelect(p)}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{p.full_name}</span>
                  {p.isDuplicate && <span className="text-[8px] bg-yellow-500/10 text-yellow-400 rounded px-1 font-semibold">M</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{p.email}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{p.organization || "—"}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap max-w-[120px]">
                  {p.tags.slice(0, 2).map(t => (
                    <span key={t} className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-medium">{t}</span>
                  ))}
                  {p.tags.length > 2 && <span className="text-[9px] text-muted-foreground">+{p.tags.length - 2}</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-center">{p.totalRegistered}</td>
              <td className="px-4 py-3 text-center">{p.totalAttended}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.attendanceRate >= 80 ? "bg-green-500/10 text-green-400" : p.attendanceRate >= 50 ? "bg-amber-500/10 text-amber-400" : "bg-destructive/10 text-destructive"}`}>
                  {fmt1(p.attendanceRate)}%
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold ${getScoreColor(p.engagementScore)}`}>{fmt1(p.engagementScore)}</span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{p.lastEvent}</td>
              <td className="px-4 py-3">
                <Button size="sm" variant="ghost" className="h-7"><Eye className="h-3 w-3" /></Button>
              </td>
            </tr>
          ))}
          {profiles.length === 0 && (
            <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No attendees found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CRMTable;
