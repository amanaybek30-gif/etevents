import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Bell, Megaphone, Loader2 } from "lucide-react";

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

const TelegramPostRegPrompt = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [updatesEnabled, setUpdatesEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const hasClicked = useRef(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsGuest(true);
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from("telegram_accounts")
        .select("linked_at, telegram_chat_id, telegram_reminders_enabled, telegram_updates_enabled")
        .eq("user_id", user.id)
        .maybeSingle() as any;

      if (hasTelegramConnection(data)) {
        setConnected(true);
        setRemindersEnabled(!!data.telegram_reminders_enabled);
        setUpdatesEnabled(!!data.telegram_updates_enabled);
      }
      setLoading(false);
    };
    check();
  }, []);

  if (loading) return null;

  // Already connected with both preferences on — nothing to show
  if (connected && remindersEnabled && updatesEnabled) return null;

  const handleGuestConnect = () => {
    if (hasClicked.current) return;
    hasClicked.current = true;
    // Store intent so after signup we auto-connect
    localStorage.setItem("telegram_connect_intent", "true");
    toast.info("Create an account first to connect Telegram.");
    navigate("/attendee-auth?intent=telegram");
  };

  const handleConnect = async () => {
    if (hasClicked.current || generating) return;
    hasClicked.current = true;
    setGenerating(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, "").substring(0, 16);
      const { data: existing } = await supabase
        .from("telegram_accounts")
        .select("id, telegram_chat_id")
        .eq("user_id", userId!)
        .maybeSingle() as any;

      if (existing?.telegram_chat_id) {
        setConnected(true);
        setGenerating(false);
        toast.success("Telegram connected successfully! 🎉");
        return;
      }

      if (existing) {
        await supabase.from("telegram_accounts").update({
          link_token: token,
          linked_at: null,
          telegram_chat_id: null,
          telegram_username: null,
          telegram_reminders_enabled: true,
          telegram_updates_enabled: true,
        } as any).eq("user_id", userId!);
      } else {
        await supabase.from("telegram_accounts").insert({
          user_id: userId!,
          role: "explorer",
          link_token: token,
          telegram_reminders_enabled: true,
          telegram_updates_enabled: true,
        } as any);
      }

      toast.success("Redirecting to Telegram — press Start to connect!");
      openTelegramBot(token);
    } catch {
      setGenerating(false);
      hasClicked.current = false;
    }
  };

  const togglePref = async (field: string, value: boolean) => {
    await supabase.from("telegram_accounts").update({ [field]: value } as any).eq("user_id", userId!);
    if (field === "telegram_reminders_enabled") setRemindersEnabled(value);
    else setUpdatesEnabled(value);
    toast.success(value ? "Enabled" : "Disabled");
  };

  // Guest user — redirect to signup
  if (isGuest) {
    return (
      <div className="rounded-lg border border-[#0088cc]/20 bg-[#0088cc]/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#0088cc]" />
          <p className="text-sm font-medium text-foreground">Get reminders and updates on Telegram</p>
        </div>
        <Button
          size="sm"
          onClick={handleGuestConnect}
          disabled={hasClicked.current}
          className="bg-[#0088cc] text-white hover:bg-[#0077b3] text-xs"
        >
          <MessageCircle className="mr-1 h-3 w-3" />
          Connect Telegram
        </Button>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="rounded-lg border border-[#0088cc]/20 bg-[#0088cc]/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#0088cc]" />
          <p className="text-sm font-medium text-foreground">Get reminders and updates on Telegram</p>
        </div>
        <Button
          size="sm"
          onClick={handleConnect}
          disabled={generating || hasClicked.current}
          className="bg-[#0088cc] text-white hover:bg-[#0077b3] text-xs"
        >
          {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <MessageCircle className="mr-1 h-3 w-3" />}
          {generating ? "Waiting..." : "Connect Telegram"}
        </Button>
      </div>
    );
  }

  // Connected but preferences off
  return (
    <div className="rounded-lg border border-[#0088cc]/20 bg-[#0088cc]/5 p-4 space-y-3">
      <p className="text-xs font-medium text-foreground">Enable Telegram notifications:</p>
      {!remindersEnabled && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Event Reminders</Label>
          </div>
          <Switch checked={remindersEnabled} onCheckedChange={(v) => togglePref("telegram_reminders_enabled", v)} />
        </div>
      )}
      {!updatesEnabled && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Event Updates</Label>
          </div>
          <Switch checked={updatesEnabled} onCheckedChange={(v) => togglePref("telegram_updates_enabled", v)} />
        </div>
      )}
    </div>
  );
};

export default TelegramPostRegPrompt;
