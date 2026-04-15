import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Mail, FileSpreadsheet } from "lucide-react";
import type { EventOption } from "./types";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  segment: string;
  onSegmentChange: (v: string) => void;
  eventFilter: string;
  onEventFilterChange: (v: string) => void;
  tagFilter: string;
  onTagFilterChange: (v: string) => void;
  allTags: string[];
  events: EventOption[];
  filteredCount: number;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onSendInvites: () => void;
}

const CRMFilters = ({
  search, onSearchChange, segment, onSegmentChange,
  eventFilter, onEventFilterChange, tagFilter, onTagFilterChange,
  allTags, events, filteredCount,
  onExportExcel, onExportCSV, onSendInvites,
}: Props) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search by name, email, phone, organization..." className="pl-9 border-border bg-secondary" />
        </div>
        <Select value={segment} onValueChange={onSegmentChange}>
          <SelectTrigger className="w-full sm:w-[180px] border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Attendees</SelectItem>
            <SelectItem value="returning">Returning</SelectItem>
            <SelectItem value="first_time">First-Time</SelectItem>
            <SelectItem value="frequent">Frequent (3+)</SelectItem>
            <SelectItem value="vip">VIP Tagged</SelectItem>
            <SelectItem value="no_show">No-Shows</SelectItem>
            <SelectItem value="high_engagement">High Engagement (80%+)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={onEventFilterChange}>
          <SelectTrigger className="w-full sm:w-[200px] border-border bg-secondary"><SelectValue placeholder="Filter by event" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all_events">All Events</SelectItem>
            {events.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={onTagFilterChange}>
            <SelectTrigger className="w-full sm:w-[150px] border-border bg-secondary"><SelectValue placeholder="Filter by tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_tags">All Tags</SelectItem>
              {allTags.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onExportExcel} className="border-border hover:border-primary shrink-0">
          <Download className="mr-1.5 h-3.5 w-3.5" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={onExportCSV} className="border-border hover:border-primary shrink-0">
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={onSendInvites} className="border-border hover:border-primary shrink-0">
          <Mail className="mr-1.5 h-3.5 w-3.5" /> Email Segment
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filteredCount} attendee{filteredCount !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
};

export default CRMFilters;
