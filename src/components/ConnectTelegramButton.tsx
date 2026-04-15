import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MessageCircle, Check, Unlink, Bell, Megaphone } from "lucide-react";

interface Props {
  userId: string;
  role: "explorer" | "organizer";
  compact?: boolean;
}

const TELEGRAM_BOT_USERNAME = "VERSAssistantbot";

const hasTelegramConnection = (account?: { linked_at?: string | null; telegram_chat_id?: number | null } | null) =>
  Boolean(account?.telegram_chat_id || account?.linked_at);

const openTelegramBot = (token: string) => {
  const botUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = botUrl;
    return;
  }

  window.open(botUrl, "_blank", "noopener,noreferrer");
};

const ConnectTelegramButton = ({ userId, role, compact = false }: Props) => {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [updatesEnabled, setUpdatesEnabled] = useState(false);

  useEffect(() => {
    checkLink();
  }, [userId]);

  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);

  const checkLink = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("telegram_accounts")
      .select("id, linked_at, telegram_chat_id, telegram_username, telegram_reminders_enabled, telegram_updates_enabled")
      .eq("user_id", userId)
      .maybeSingle() as any;

    // Cross-check: linked_at must be set AND telegram_chat_id must exist (bot was started)
    const isConnected = hasTelegramConnection(data);
    setLinked(isConnected);
    setTelegramUsername(data?.telegram_username || null);
    setRemindersEnabled(!!data?.telegram_reminders_enabled);
    setUpdatesEnabled(!!data?.telegram_updates_enabled);
    setLoading(false);
  };

  const handleConnect = async () => {
    setGenerating(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, "").substring(0, 16);

      const { data: existing } = await supabase
        .from("telegram_accounts")
        .select("id, linked_at, telegram_chat_id, telegram_username")
        .eq("user_id", userId)
        .maybeSingle() as any;

      if (hasTelegramConnection(existing)) {
        setLinked(true);
        setTelegramUsername(existing?.telegram_username || null);
        setGenerating(false);
        toast.success("Telegram connected successfully! 🎉");
        return;
      }

      if (existing) {
        await supabase
          .from("telegram_accounts")
          .update({
            link_token: token,
            linked_at: null,
            telegram_chat_id: null,
            telegram_username: null,
            role,
            telegram_reminders_enabled: true,
            telegram_updates_enabled: true,
          } as any)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("telegram_accounts")
          .insert({
            user_id: userId,
            role,
            link_token: token,
          } as any);
      }

      openTelegramBot(token);

      toast.success("Opening Telegram to finish connection...");

      const pollInterval = setInterval(async () => {
        const { data: check } = await supabase
          .from("telegram_accounts")
          .select("linked_at, telegram_chat_id, telegram_username")
          .eq("user_id", userId)
          .maybeSingle() as any;

        if (hasTelegramConnection(check)) {
          setLinked(true);
          setTelegramUsername(check?.telegram_username || null);
          clearInterval(pollInterval);
          toast.success("Telegram connected successfully! 🎉");
          setGenerating(false);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setGenerating(false);
      }, 120000);
    } catch (err: any) {
      toast.error("Failed to generate link: " + (err.message || "Unknown error"));
      setGenerating(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await supabase
        .from("telegram_accounts")
        .delete()
        .eq("user_id", userId);

      setLinked(false);
      setRemindersEnabled(false);
      setUpdatesEnabled(false);
      toast.success("Telegram disconnected");
    } catch (err: any) {
      toast.error("Failed to disconnect: " + (err.message || "Unknown error"));
    }
    setUnlinking(false);
  };

  const togglePreference = async (field: "telegram_reminders_enabled" | "telegram_updates_enabled", value: boolean) => {
    const { error } = await supabase
      .from("telegram_accounts")
      .update({ [field]: value } as any)
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update preference");
      return;
    }

    if (field === "telegram_reminders_enabled") {
      setRemindersEnabled(value);
      toast.success(value ? "Telegram reminders enabled" : "Telegram reminders disabled");
    } else {
      setUpdatesEnabled(value);
      toast.success(value ? "Telegram updates enabled" : "Telegram updates disabled");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking Telegram...
      </div>
    );
  }

  if (linked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
            <Check className="h-4 w-4 text-green-500" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Telegram Connected</span>
              {telegramUsername && (
                <span className="text-[10px] text-muted-foreground">@{telegramUsername}</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={unlinking}
            className="text-xs text-muted-foreground hover:text-destructive h-8"
          >
            {unlinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
          </Button>
        </div>

        {!compact && (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs cursor-pointer">Get reminders via Telegram</Label>
              </div>
              <Switch
                checked={remindersEnabled}
                onCheckedChange={(val) => togglePreference("telegram_reminders_enabled", val)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs cursor-pointer">Get updates via Telegram</Label>
              </div>
              <Switch
                checked={updatesEnabled}
                onCheckedChange={(val) => togglePreference("telegram_updates_enabled", val)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleConnect}
      disabled={generating}
      className="border-[#0088cc]/30 text-[#0088cc] hover:bg-[#0088cc]/10 hover:border-[#0088cc] text-xs h-8"
    >
      {generating ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <MessageCircle className="mr-1 h-3 w-3" />
      )}
      {generating ? "Waiting for Telegram..." : "Connect Telegram"}
    </Button>
  );
};

export default ConnectTelegramButton;
