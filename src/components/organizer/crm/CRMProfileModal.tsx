import { useState } from "react";
import { X, Plus, Trash2, Star, Send, StickyNote, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AttendeeProfile } from "./types";
import { fmt1 } from "@/lib/formatMetric";

interface Props {
  profile: AttendeeProfile;
  userId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const PRESET_TAGS = ["VIP", "Speaker", "Sponsor", "Volunteer", "Media", "Partner"];

const CRMProfileModal = ({ profile, userId, onClose, onUpdate }: Props) => {
  const [newTag, setNewTag] = useState("");
  const [newNote, setNewNote] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-primary";
    if (score >= 40) return "text-yellow-400";
    return "text-destructive";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Highly Engaged";
    if (score >= 60) return "Active";
    if (score >= 40) return "Moderate";
    if (score >= 20) return "Low Engagement";
    return "Inactive";
  };

  const addTag = async (tag: string) => {
    const t = tag.trim();
    if (!t || profile.tags.includes(t)) return;
    setAddingTag(true);
    const { error } = await supabase.from("attendee_tags").insert({
      organizer_id: userId,
      attendee_email: profile.email,
      tag: t,
    });
    if (error) {
      if (error.code === "23505") toast.info("Tag already exists");
      else toast.error("Failed to add tag");
    } else {
      toast.success(`Tag "${t}" added`);
      onUpdate();
    }
    setNewTag("");
    setAddingTag(false);
  };

  const removeTag = async (tag: string) => {
    await supabase.from("attendee_tags")
      .delete()
      .eq("organizer_id", userId)
      .eq("attendee_email", profile.email)
      .eq("tag", tag);
    toast.success(`Tag "${tag}" removed`);
    onUpdate();
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    const { error } = await supabase.from("attendee_notes").insert({
      organizer_id: userId,
      attendee_email: profile.email,
      note: newNote.trim(),
    });
    if (error) toast.error("Failed to add note");
    else { toast.success("Note added"); onUpdate(); }
    setNewNote("");
    setAddingNote(false);
  };

  const deleteNote = async (noteId: string) => {
    await supabase.from("attendee_notes").delete().eq("id", noteId);
    toast.success("Note deleted");
    onUpdate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 space-y-5" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">{profile.full_name}</h3>
            {profile.isDuplicate && (
              <span className="text-[10px] bg-yellow-500/10 text-yellow-400 rounded-full px-2 py-0.5 font-semibold">Merged Profile</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Basic Info + Engagement Score */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">Email: <span className="text-foreground">{profile.email}</span></p>
            <p className="text-muted-foreground">Phone: <span className="text-foreground">{profile.phone}</span></p>
            {profile.organization && <p className="text-muted-foreground">Organization: <span className="text-foreground">{profile.organization}</span></p>}
            {profile.job_title && <p className="text-muted-foreground">Job Title: <span className="text-foreground">{profile.job_title}</span></p>}
            {profile.city && <p className="text-muted-foreground">City: <span className="text-foreground">{profile.city}</span></p>}
          </div>
          <div className="rounded-xl border border-border bg-secondary p-4 text-center space-y-2">
            <Star className="mx-auto h-5 w-5 text-primary" />
            <p className={`font-display text-3xl font-black ${getScoreColor(profile.engagementScore)}`}>{fmt1(profile.engagementScore)}</p>
            <p className="text-xs text-muted-foreground">Engagement Score</p>
            <p className={`text-xs font-semibold ${getScoreColor(profile.engagementScore)}`}>{getScoreLabel(profile.engagementScore)}</p>
            <Progress value={profile.engagementScore} className="h-1.5" />
          </div>
        </div>

        {/* Activity Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-secondary p-3 text-center">
            <p className="text-xl font-bold text-foreground">{profile.totalRegistered}</p>
            <p className="text-xs text-muted-foreground">Registered</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary p-3 text-center">
            <p className="text-xl font-bold text-foreground">{profile.totalAttended}</p>
            <p className="text-xs text-muted-foreground">Attended</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary p-3 text-center">
            <p className="text-xl font-bold text-primary">{fmt1(profile.attendanceRate)}%</p>
            <p className="text-xs text-muted-foreground">Rate</p>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Tags</h4>
          <div className="flex flex-wrap gap-1.5">
            {profile.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {profile.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESET_TAGS.filter(t => !profile.tags.includes(t)).map(t => (
              <button key={t} onClick={() => addTag(t)} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                + {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Custom tag..." className="h-8 text-xs border-border bg-secondary" onKeyDown={e => e.key === "Enter" && addTag(newTag)} />
            <Button size="sm" variant="outline" onClick={() => addTag(newTag)} disabled={addingTag || !newTag.trim()} className="h-8 border-border">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Event History */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Event Participation History</h4>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {profile.events.map((ev, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{ev.date}</p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ev.checkedIn ? "bg-green-500/10 text-green-400" : ev.status === "approved" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  {ev.checkedIn ? "Attended" : ev.status === "approved" ? "No-show" : ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Internal Notes</h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {profile.notes.map(n => (
              <div key={n.id} className="flex items-start justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
                <div>
                  <p className="text-sm text-foreground">{n.note}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => deleteNote(n.id)} className="text-muted-foreground hover:text-destructive shrink-0 ml-2"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {profile.notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet. Add internal notes below.</p>}
          </div>
          <div className="flex gap-2">
            <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note... e.g. 'Potential sponsor from Dashen Bank'" className="min-h-[60px] text-xs border-border bg-secondary" />
          </div>
          <Button size="sm" onClick={addNote} disabled={addingNote || !newNote.trim()} className="w-full">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Note
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CRMProfileModal;
