import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin, Users } from "lucide-react";
import { motion } from "framer-motion";

interface PublishedEventCardEvent {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  date: string;
  location: string;
  ticket_price: string;
  expected_attendees?: number | null;
  image_url?: string | null;
  short_description?: string | null;
  is_postponed?: boolean | null;
}

interface PublishedEventCardProps {
  event: PublishedEventCardEvent;
  index: number;
  fallbackImage?: string;
}

const PublishedEventCard = ({ event, index, fallbackImage }: PublishedEventCardProps) => {
  const imageSrc = event.image_url || fallbackImage;
  const isPostponed = !!event.is_postponed;
  const categoryLabel = event.category?.trim() || "Other";
  const title = event.title?.trim() || "Untitled event";
  const shortDescription = event.short_description?.trim() || "Exciting event coming soon!";
  const location = event.location?.trim() || "Location to be announced";
  const date = event.date?.trim() || "Date to be announced";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link
        to={`/event/${event.slug}`}
        className="group block overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-gold"
      >
        <div className={`relative aspect-[4/3] overflow-hidden bg-secondary sm:aspect-[16/10] ${isPostponed ? "brightness-75" : ""}`}>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={title}
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${isPostponed ? "blur-[2px] brightness-50" : ""}`}
              loading="lazy"
            />
          ) : null}

          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />

          <span className="absolute left-3 top-3 hidden rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground sm:inline-flex">
            {categoryLabel}
          </span>

          {isPostponed && (
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <span className="rounded-lg bg-primary/90 px-4 py-1.5 font-display text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-gold sm:px-6 sm:py-2 sm:text-lg">
                Postponed
              </span>
            </div>
          )}

          {imageSrc ? (
            <div className="absolute bottom-3 left-3 right-3 hidden sm:block">
              <h3 className="line-clamp-2 font-display text-xl font-bold leading-tight text-foreground">
                {title}
              </h3>
            </div>
          ) : (
            <div className="absolute inset-0 hidden items-center justify-center p-4 sm:flex">
              <h3 className="line-clamp-3 text-center font-display text-xl font-bold leading-tight text-foreground">
                {title}
              </h3>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 p-2 sm:gap-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:hidden">
            <span className="max-w-full truncate rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold leading-none text-primary-foreground">
              {categoryLabel}
            </span>
          </div>

          <h3 className="line-clamp-3 font-display text-xs font-bold leading-tight text-foreground sm:hidden">
            {title}
          </h3>

          <p className="hidden line-clamp-2 text-sm text-muted-foreground sm:block">
            {shortDescription}
          </p>

          <div className="flex flex-col gap-1 text-[9px] text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-3 sm:text-xs">
            <span className="flex items-center gap-0.5 sm:gap-1">
              <Calendar className="h-2.5 w-2.5 shrink-0 text-primary sm:h-3.5 sm:w-3.5" />
              {date}
            </span>

            <span className="flex min-w-0 items-start gap-0.5 sm:gap-1">
              <MapPin className="mt-[1px] h-2.5 w-2.5 shrink-0 text-primary sm:h-3.5 sm:w-3.5" />
              <span className="line-clamp-2 sm:line-clamp-1">{location}</span>
            </span>

            {typeof event.expected_attendees === "number" && event.expected_attendees > 0 && (
              <span className="hidden items-center gap-1 sm:flex">
                <Users className="h-3.5 w-3.5 text-primary" />
                {event.expected_attendees.toLocaleString()}
              </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-border pt-1.5 sm:pt-2">
            <span className="text-[10px] font-semibold text-primary sm:text-sm">{event.ticket_price}</span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground transition-colors group-hover:text-primary sm:text-xs">
              View Details
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default PublishedEventCard;
