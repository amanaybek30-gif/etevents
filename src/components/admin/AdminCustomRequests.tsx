import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Wrench, Loader2, RefreshCw, Eye, MessageSquare, Check, X,
  Clock, ChevronDown, ChevronUp, Send, Archive,
} from "lucide-react";

interface Props {
  searchQuery: string;
  adminId: string;
}

interface CustomRequest {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface ParsedRequest {
  eventName?: string;
  eventDate?: string;
  eventLocation?: string;
  expectedAttendees?: string;
  services?: string[];
  otherRequest?: string;
  staffCount?: string;
  duration?: string;
  budget?: string;
  urgency?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    organization?: string;
  };
}

const AdminCustomRequests = ({ searchQuery, adminId }: Props) => {
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("type", "custom_request")
      .order("created_at", { ascending: false });
    setRequests((data as CustomRequest[]) || []);
    setLoading(false);
  };

  const parseMessage = (msg: string): ParsedRequest | null => {
    try { return JSON.parse(msg); } catch { return null; }
  };

  const markRead = async (id: string) => {
    await supabase.from("admin_notifications").update({ is_read: true }).eq("id", id);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r));
  };

  const markUnread = async (id: string) => {
    await supabase.from("admin_notifications").update({ is_read: false }).eq("id", id);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, is_read: false } : r));
  };

  const archiveRequest = async (id: string) => {
    await supabase.from("admin_notifications").delete().eq("id", id);
    setRequests(prev => prev.filter(r => r.id !== id));
    toast.success("Request archived");
  };

  const handleReply = async (request: CustomRequest) => {
    const text = replyText[request.id];
    if (!text?.trim()) { toast.error("Write a reply first"); return; }

    const parsed = parseMessage(request.message);
    if (!parsed?.contact?.email) { toast.error("No contact email found"); return; }

    setReplyingId(request.id);
    try {
      // Log the reply
      await supabase.from("admin_logs").insert({
        admin_id: adminId,
        action: "reply_custom_request",
        target_type: "custom_request",
        target_id: request.id,
        details: `Replied to ${parsed.contact.name || "organizer"} (${parsed.contact.email}): ${text}`,
      });

      // Mark as read
      await markRead(request.id);

      toast.success(`Reply logged for ${parsed.contact.email}. Send the actual reply via your email client.`);
      setReplyText(prev => ({ ...prev, [request.id]: "" }));
    } catch {
      toast.error("Failed to log reply");
    }
    setReplyingId(null);
  };

  const filtered = requests.filter(r => {
    if (filter === "unread" && r.is_read) return false;
    if (filter === "read" && !r.is_read) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const parsed = parseMessage(r.message);
      return (
        r.title.toLowerCase().includes(q) ||
        parsed?.contact?.name?.toLowerCase().includes(q) ||
        parsed?.contact?.email?.toLowerCase().includes(q) ||
        parsed?.eventName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadCount = requests.filter(r => !r.is_read).length;

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Custom Requests</h2>
          <p className="text-sm text-muted-foreground">Manage custom service requests from organizers.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-secondary overflow-hidden">
            {(["all", "unread", "read"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {f} {f === "unread" && unreadCount > 0 && `(${unreadCount})`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests} className="border-border">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{requests.length}</p>
          <p className="text-xs text-muted-foreground">Total Requests</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{unreadCount}</p>
          <p className="text-xs text-muted-foreground">Unread</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{requests.length - unreadCount}</p>
          <p className="text-xs text-muted-foreground">Reviewed</p>
        </div>
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Wrench className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No custom requests {filter !== "all" ? `(${filter})` : "yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const parsed = parseMessage(req.message);
            const isExpanded = expandedId === req.id;
            return (
              <div key={req.id} className={`rounded-xl border bg-card overflow-hidden transition-all ${!req.is_read ? "border-primary/30 bg-primary/[0.02]" : "border-border"}`}>
                {/* Header Row */}
                <button onClick={() => { setExpandedId(isExpanded ? null : req.id); if (!req.is_read) markRead(req.id); }}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${!req.is_read ? "bg-primary/10" : "bg-secondary"}`}>
                    <Wrench className={`h-4 w-4 ${!req.is_read ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${!req.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                        {parsed?.eventName || req.title.replace("Custom Request: ", "")}
                      </p>
                      {!req.is_read && <Badge className="bg-primary/10 text-primary text-[10px] shrink-0">New</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{parsed?.contact?.name || "Unknown"}</span>
                      <span>•</span>
                      <span>{parsed?.contact?.email || ""}</span>
                      <span>•</span>
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {parsed?.urgency && (
                      <Badge variant="outline" className={`text-[10px] ${parsed.urgency.includes("3 days") ? "border-destructive text-destructive" : "border-border"}`}>
                        {parsed.urgency}
                      </Badge>
                    )}
                    {parsed?.budget && <Badge variant="outline" className="text-[10px] border-border">{parsed.budget}</Badge>}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && parsed && (
                  <div className="border-t border-border p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Event Info */}
                      <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                        <h4 className="text-xs font-semibold text-foreground">Event Information</h4>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Name: <span className="text-foreground">{parsed.eventName}</span></p>
                          <p>Date: <span className="text-foreground">{parsed.eventDate}</span></p>
                          <p>Location: <span className="text-foreground">{parsed.eventLocation || "—"}</span></p>
                          <p>Expected Attendees: <span className="text-foreground">{parsed.expectedAttendees || "—"}</span></p>
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                        <h4 className="text-xs font-semibold text-foreground">Contact Details</h4>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Name: <span className="text-foreground">{parsed.contact?.name}</span></p>
                          <p>Email: <span className="text-foreground font-mono">{parsed.contact?.email}</span></p>
                          <p>Phone: <span className="text-foreground font-mono">{parsed.contact?.phone}</span></p>
                          {parsed.contact?.organization && <p>Org: <span className="text-foreground">{parsed.contact.organization}</span></p>}
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    {parsed.services && parsed.services.length > 0 && (
                      <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                        <h4 className="text-xs font-semibold text-foreground">Requested Services</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {parsed.services.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-primary/20 text-primary bg-primary/5">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {parsed.otherRequest && (
                      <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                        <h4 className="text-xs font-semibold text-foreground">Other Request</h4>
                        <p className="text-xs text-muted-foreground">{parsed.otherRequest}</p>
                      </div>
                    )}

                    {/* Staff, Duration, Budget, Urgency */}
                    <div className="grid gap-3 sm:grid-cols-4">
                      {parsed.staffCount && (
                        <div className="rounded-lg border border-border bg-secondary/50 p-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Staff</p>
                          <p className="text-sm font-semibold text-foreground mt-1">{parsed.staffCount}</p>
                        </div>
                      )}
                      {parsed.duration && (
                        <div className="rounded-lg border border-border bg-secondary/50 p-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</p>
                          <p className="text-sm font-semibold text-foreground mt-1">{parsed.duration}</p>
                        </div>
                      )}
                      {parsed.budget && (
                        <div className="rounded-lg border border-border bg-secondary/50 p-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget</p>
                          <p className="text-sm font-semibold text-foreground mt-1">{parsed.budget}</p>
                        </div>
                      )}
                      {parsed.urgency && (
                        <div className="rounded-lg border border-border bg-secondary/50 p-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Urgency</p>
                          <p className={`text-sm font-semibold mt-1 ${parsed.urgency.includes("3 days") ? "text-destructive" : "text-foreground"}`}>{parsed.urgency}</p>
                        </div>
                      )}
                    </div>

                    {/* Reply */}
                    <div className="border-t border-border pt-3 space-y-2">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> Reply / Notes
                      </h4>
                      <Textarea
                        value={replyText[req.id] || ""}
                        onChange={e => setReplyText(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder={`Write a reply or notes for ${parsed.contact?.name || "this request"}...`}
                        className="border-border bg-secondary text-sm min-h-[60px]"
                      />
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleReply(req)} disabled={replyingId === req.id} className="bg-primary text-primary-foreground h-8 text-xs">
                            {replyingId === req.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                            Log Reply
                          </Button>
                          {parsed.contact?.email && (
                            <Button size="sm" variant="outline" asChild className="h-8 text-xs border-border">
                              <a href={`mailto:${parsed.contact.email}?subject=Re: Custom Request - ${parsed.eventName}`}>
                                <MessageSquare className="h-3 w-3 mr-1" /> Email
                              </a>
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {req.is_read ? (
                            <Button size="sm" variant="ghost" onClick={() => markUnread(req.id)} className="h-8 text-xs text-muted-foreground">
                              Mark Unread
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => markRead(req.id)} className="h-8 text-xs text-muted-foreground">
                              <Check className="h-3 w-3 mr-1" /> Mark Read
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => archiveRequest(req.id)} className="h-8 text-xs text-destructive">
                            <Archive className="h-3 w-3 mr-1" /> Archive
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCustomRequests;
