import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, FileText, Image as ImageIcon, Video, Upload, Loader2, X } from "lucide-react";

export interface EventMaterial {
  id: string;
  title: string;
  type: "image" | "video" | "file";
  url: string;
  description?: string;
  file_name?: string;
}

interface Props {
  materials: EventMaterial[];
  onChange: (materials: EventMaterial[]) => void;
}

const MATERIAL_CATEGORIES = [
  { value: "schedule", label: "Schedule / Agenda" },
  { value: "map", label: "Venue Map / Layout" },
  { value: "menu", label: "Menu / Catalog" },
  { value: "brochure", label: "Brochure / Flyer" },
  { value: "highlight", label: "Highlight Reel" },
  { value: "gallery", label: "Gallery / Photos" },
  { value: "other", label: "Other" },
];

const EventMaterialsEditor = ({ materials, onChange }: Props) => {
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const addMaterial = () => {
    onChange([
      ...materials,
      {
        id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: "",
        type: "image",
        url: "",
        description: "",
      },
    ]);
  };

  const updateMaterial = (idx: number, updates: Partial<EventMaterial>) => {
    onChange(materials.map((m, i) => (i === idx ? { ...m, ...updates } : m)));
  };

  const removeMaterial = (idx: number) => {
    onChange(materials.filter((_, i) => i !== idx));
  };

  const handleFileUpload = async (idx: number, file: File) => {
    const mat = materials[idx];
    setUploading(mat.id);
    try {
      const ext = file.name.split(".").pop();
      const path = `materials-${Date.now()}-${idx}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("event-posters")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from("event-posters")
        .getPublicUrl(path);
      
      // Auto-detect type
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      const type = isVideo ? "video" : isImage ? "image" : "file";

      updateMaterial(idx, {
        url: urlData.publicUrl,
        type,
        file_name: file.name,
      });
      toast.success("File uploaded!");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(null);
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === "video") return <Video className="h-4 w-4" />;
    if (type === "image") return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Schedules, Agendas & Materials
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs border-border hover:border-primary"
          onClick={addMaterial}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Material
        </Button>
      </div>

      {materials.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            No materials added yet. Add schedules, agendas, venue maps, or highlight videos.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 text-primary hover:text-primary/80"
            onClick={addMaterial}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add your first material
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((mat, idx) => (
            <div
              key={mat.id}
              className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground font-semibold mt-1">
                  #{idx + 1}
                </span>
                <div className="flex-1 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Title *</Label>
                      <Input
                        value={mat.title}
                        onChange={(e) =>
                          updateMaterial(idx, { title: e.target.value })
                        }
                        placeholder="e.g. Event Schedule, Venue Map"
                        className="border-border bg-card h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={mat.description || "other"}
                        onValueChange={(v) =>
                          updateMaterial(idx, { description: v })
                        }
                      >
                        <SelectTrigger className="border-border bg-card h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIAL_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Upload area */}
                  {mat.url ? (
                    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      {getTypeIcon(mat.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {mat.file_name || "Uploaded file"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {mat.type.charAt(0).toUpperCase() + mat.type.slice(1)}
                        </p>
                      </div>
                      {mat.type === "image" && (
                        <img
                          src={mat.url}
                          alt={mat.title}
                          className="h-12 w-12 rounded object-cover border border-border"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          updateMaterial(idx, { url: "", file_name: "" })
                        }
                        className="text-destructive hover:text-destructive/80"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-card p-4 hover:border-primary transition-colors">
                      {uploading === mat.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {uploading === mat.id
                            ? "Uploading..."
                            : "Click to upload image, video, or file"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Images, videos (up to 100MB), PDFs, documents
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                        className="hidden"
                        ref={(el) => {
                          fileInputRefs.current[mat.id] = el;
                        }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 100 * 1024 * 1024) {
                            toast.error("File must be under 100MB");
                            return;
                          }
                          handleFileUpload(idx, file);
                        }}
                      />
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeMaterial(idx)}
                  className="text-destructive hover:text-destructive/80 mt-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventMaterialsEditor;
