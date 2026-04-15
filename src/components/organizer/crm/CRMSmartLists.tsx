import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, List, Play } from "lucide-react";
import { toast } from "sonner";
import type { SmartList } from "./types";

interface Props {
  userId: string;
  currentFilters: { segment: string; eventFilter: string; search: string };
  onApply: (filters: SmartList["filters"]) => void;
}

const CRMSmartLists = ({ userId, currentFilters, onApply }: Props) => {
  const [lists, setLists] = useState<SmartList[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchLists(); }, [userId]);

  const fetchLists = async () => {
    const { data } = await supabase
      .from("crm_smart_lists")
      .select("*")
      .eq("organizer_id", userId)
      .order("created_at", { ascending: false });
    if (data) setLists(data.map(d => ({ ...d, filters: d.filters as SmartList["filters"] })));
  };

  const saveList = async () => {
    if (!newName.trim()) { toast.error("Enter a name for this list"); return; }
    setSaving(true);
    const { error } = await supabase.from("crm_smart_lists").insert({
      organizer_id: userId,
      name: newName.trim(),
      filters: currentFilters as any,
    });
    if (error) toast.error("Failed to save list");
    else { toast.success(`List "${newName.trim()}" saved!`); setNewName(""); fetchLists(); }
    setSaving(false);
  };

  const deleteList = async (id: string) => {
    await supabase.from("crm_smart_lists").delete().eq("id", id);
    toast.success("List deleted");
    fetchLists();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <List className="h-4 w-4 text-primary" /> Smart Lists
      </h4>

      {/* Save current filters */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Save current filters as..."
          className="h-8 text-xs border-border bg-secondary"
          onKeyDown={e => e.key === "Enter" && saveList()}
        />
        <Button size="sm" variant="outline" onClick={saveList} disabled={saving} className="h-8 border-border shrink-0">
          <Plus className="h-3 w-3 mr-1" /> Save
        </Button>
      </div>

      {/* Saved lists */}
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {lists.map(list => (
          <div key={list.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{list.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {[
                  list.filters.segment && list.filters.segment !== "all" ? `Segment: ${list.filters.segment}` : "",
                  list.filters.search ? `Search: "${list.filters.search}"` : "",
                ].filter(Boolean).join(" · ") || "All attendees"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onApply(list.filters)}>
                <Play className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteList(list.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {lists.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No saved lists yet. Apply filters and save them here.</p>}
      </div>
    </div>
  );
};

export default CRMSmartLists;
