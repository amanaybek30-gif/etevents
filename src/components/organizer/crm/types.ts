export interface AttendeeProfile {
  email: string;
  phone: string;
  full_name: string;
  organization: string;
  job_title: string;
  city?: string;
  totalRegistered: number;
  totalAttended: number;
  attendanceRate: number;
  lastEvent: string;
  lastEventDate: string;
  engagementScore: number;
  tags: string[];
  notes: { id: string; note: string; created_at: string }[];
  events: { title: string; date: string; status: string; checkedIn: boolean }[];
  isDuplicate?: boolean;
}

export interface EventOption {
  id: string;
  title: string;
  date: string;
}

export interface SmartList {
  id: string;
  name: string;
  filters: {
    segment?: string;
    eventFilter?: string;
    search?: string;
    tags?: string[];
    minEvents?: number;
    minAttendanceRate?: number;
  };
  created_at: string;
}
