import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

interface Log {
  id: string; action: string; target_type: string | null;
  target_id: string | null; details: string | null; created_at: string;
}

interface Props { searchQuery: string; }

const AdminLogs = ({ searchQuery }: Props) => {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    const { data } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setLogs(data);
  };

  const q = searchQuery.toLowerCase();
  const filtered = logs.filter(l => !q || l.action.toLowerCase().includes(q) || l.details?.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" /> Activity Logs
      </h1>

      <div className="space-y-2">
        {filtered.map(l => (
          <div key={l.id} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{l.action}</p>
              {l.details && <p className="text-xs text-muted-foreground mt-0.5">{l.details}</p>}
              {l.target_type && <p className="text-xs text-muted-foreground">Target: {l.target_type} {l.target_id ? `(${l.target_id.slice(0, 8)}...)` : ""}</p>}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No logs yet. Actions will appear here as you manage the platform.</p>}
      </div>
    </div>
  );
};

export default AdminLogs;
