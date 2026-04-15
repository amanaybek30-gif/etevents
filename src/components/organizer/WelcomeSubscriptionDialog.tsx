import { Button } from "@/components/ui/button";
import { PartyPopper, Crown, Zap, Building2, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: string;
}

const PLAN_INFO: Record<string, { name: string; icon: React.ElementType; color: string }> = {
  organizer: { name: "Organizer", icon: Zap, color: "text-blue-500" },
  pro: { name: "Pro Organizer", icon: Crown, color: "text-amber-500" },
  corporate: { name: "Corporate", icon: Building2, color: "text-purple-500" },
};

const WelcomeSubscriptionDialog = ({ open, onClose, plan }: Props) => {
  if (!open) return null;

  const info = PLAN_INFO[plan] || PLAN_INFO.organizer;
  const Icon = info.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-primary/30 bg-card p-8 text-center space-y-5 shadow-2xl shadow-primary/10 animate-in zoom-in-95 fade-in duration-300" onClick={e => e.stopPropagation()}>
        {/* Celebration Icon */}
        <div className="relative mx-auto w-fit">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
            <PartyPopper className="h-10 w-10 text-primary" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-400 animate-pulse" />
          <Sparkles className="absolute -bottom-1 -left-2 h-4 w-4 text-primary animate-pulse delay-300" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Congratulations! 🎉
          </h2>
          <p className="text-sm text-muted-foreground">
            Your subscription has been approved and activated.
          </p>
        </div>

        {/* Plan Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5">
          <Icon className={`h-5 w-5 ${info.color}`} />
          <span className="text-sm font-bold text-foreground">{info.name} Plan</span>
        </div>

        {/* Welcome Message */}
        <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-2 text-left">
          <p className="text-sm font-semibold text-foreground">Welcome aboard!</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You now have full access to all features included in your plan. 
            Start creating events, managing registrations, and growing your audience. 
            We're excited to support your events!
          </p>
        </div>

        <Button onClick={onClose} className="w-full bg-gradient-gold text-primary-foreground text-sm">
          Let's Get Started!
        </Button>
      </div>
    </div>
  );
};

export default WelcomeSubscriptionDialog;
