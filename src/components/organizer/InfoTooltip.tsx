import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  title: string;
  description: string;
  className?: string;
}

const InfoTooltip = ({ title, description, className = "" }: Props) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-full h-5 w-5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
        aria-label={`Info: ${title}`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      align="center"
      className="w-72 rounded-xl border border-border bg-card p-4 shadow-lg"
    >
      <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </PopoverContent>
  </Popover>
);

export default InfoTooltip;
