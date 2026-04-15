import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ArrowUpCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { getPlanLabel, getPlanLimit } from "@/lib/registrationLimits";

interface PlanLimitReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: string;
  onNavigateToSubscription: () => void;
}

function getUpgradeTarget(plan: string): { label: string; key: string } | null {
  if (plan === "organizer") return { label: "Pro Organizer", key: "pro" };
  if (plan === "pro") return { label: "Corporate", key: "corporate" };
  return null;
}

const PlanLimitReachedDialog = ({
  open,
  onOpenChange,
  plan,
  onNavigateToSubscription,
}: PlanLimitReachedDialogProps) => {
  const limit = getPlanLimit(plan);
  const planLabel = getPlanLabel(plan);
  const upgradeTarget = getUpgradeTarget(plan);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border bg-card max-w-md">
        <AlertDialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <AlertDialogTitle className="text-foreground text-xl">
            Registration Limit Reached
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
            You've used all <span className="font-semibold text-foreground">{limit}</span> registrations
            included in your <span className="font-semibold text-foreground">{planLabel}</span> plan.
            {upgradeTarget
              ? ` Upgrade to ${upgradeTarget.label} for ${getPlanLimit(upgradeTarget.key) === 999999 ? "unlimited" : getPlanLimit(upgradeTarget.key)} registrations, or renew your current plan.`
              : " Renew your plan to continue registering attendees."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {upgradeTarget && (
            <AlertDialogAction
              onClick={() => {
                onOpenChange(false);
                onNavigateToSubscription();
              }}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Upgrade to {upgradeTarget.label}
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              onNavigateToSubscription();
            }}
            className={`w-full gap-2 ${upgradeTarget ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
          >
            <RefreshCw className="h-4 w-4" />
            Renew {planLabel} Plan
          </AlertDialogAction>
          <AlertDialogCancel className="w-full border-border mt-0">
            Close
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PlanLimitReachedDialog;
