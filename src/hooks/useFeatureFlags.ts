import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({
    feature_organizer_profiles: true,
    feature_save_events: true,
    feature_share_events: true,
    feature_vendor_registration: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("platform_settings").select("key, value");
      if (data) {
        const map: Record<string, boolean> = { ...flags };
        data.forEach(s => {
          if (s.key.startsWith("feature_")) map[s.key] = s.value === "true";
        });
        setFlags(map);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return { flags, loading };
}
