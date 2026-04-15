import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, CreditCard, ZoomIn } from "lucide-react";

interface PaymentReg {
  id: string; full_name: string; email: string; phone: string;
  payment_method: string; bank_name: string | null; receipt_url: string | null;
  status: string; created_at: string; event_id: string; ticket_id: string; event_slug: string;
}

interface Props {
  userId: string;
  isPaid?: boolean;
  onRequirePlan?: () => void;
}

const OrganizerPayments = ({ userId, isPaid = true, onRequirePlan }: Props) => {
  const [payments, setPayments] = useState<PaymentReg[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [filter, setFilter] = useState("pending");
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [receiptModal, setReceiptModal] = useState<{ url: string; isPdf: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from("events").select("id, title").eq("organizer_id", userId);
      if (data) setEvents(data);
    };
    fetchEvents();
  }, [userId]);

  useEffect(() => {
    fetchPayments();
  }, [events, filter, selectedEvent]);

  const fetchPayments = async () => {
    if (events.length === 0) { setPayments([]); setLoading(false); return; }
    let query = supabase.from("registrations").select("*").order("created_at", { ascending: false });
    if (selectedEvent !== "all") {
      query = query.eq("event_id", selectedEvent);
    } else {
      query = query.in("event_id", events.map(e => e.id));
    }
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    if (data) setPayments(data as PaymentReg[]);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    if (!isPaid) { onRequirePlan?.(); return; }
    const { error } = await supabase.from("registrations").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success(`Payment ${status}`);
    if (status === "approved") {
      const reg = payments.find(r => r.id === id);
      if (reg) {
        try {
          const event = events.find(e => e.id === reg.event_id);
          const tierName = (reg as any).custom_answers?.ticket_tier || null;
          await supabase.functions.invoke("send-approval-email", {
            body: { ticketId: reg.ticket_id, fullName: reg.full_name, email: reg.email, eventTitle: event?.title || "", eventSlug: reg.event_slug, attendeeType: (reg as any).attendee_type || "participant", tierName },
          });
        } catch { /* best effort */ }
      }
    }
    fetchPayments();
  };

  const viewReceipt = async (path: string) => {
    const isPdf = path.toLowerCase().endsWith(".pdf");
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Unable to load receipt. Please try again.");
      console.error("Failed to create signed URL:", error);
      return;
    }
    setReceiptModal({ url: data.signedUrl, isPdf });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full sm:w-[200px] border-border bg-secondary"><SelectValue placeholder="Event" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[150px] border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment Cards */}
      <div className="space-y-3">
        {payments.map(p => {
          const eventTitle = events.find(e => e.id === p.event_id)?.title || "Unknown Event";
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{eventTitle}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> {p.payment_method}{p.bank_name ? ` — ${p.bank_name}` : ""}</span>
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${p.status === "approved" ? "bg-green-500/10 text-green-500" : p.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-500"}`}>{p.status}</span>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-border">
                {p.receipt_url && (
                  <Button size="sm" variant="outline" onClick={() => viewReceipt(p.receipt_url!)} className="h-8 text-xs border-border">
                    <ZoomIn className="h-3 w-3 mr-1" /> View Receipt
                  </Button>
                )}
                {p.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(p.id, "approved")} className="h-8 bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" onClick={() => updateStatus(p.id, "rejected")} className="h-8 bg-destructive/10 text-destructive hover:bg-destructive/20 border-0 text-xs">
                      <XCircle className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {payments.length === 0 && <p className="py-12 text-center text-muted-foreground">{loading ? "Loading..." : "No payments found."}</p>}
      </div>

      {/* Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setReceiptModal(null)}>
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-card p-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setReceiptModal(null)} className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1 text-foreground hover:text-primary">✕</button>
            {receiptModal.isPdf ? (
              <iframe src={receiptModal.url} title="Receipt" className="h-[70vh] w-full rounded-lg" />
            ) : (
              <img src={receiptModal.url} alt="Receipt" className="w-full rounded-lg" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerPayments;
