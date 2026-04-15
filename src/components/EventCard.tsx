import { Link } from "react-router-dom";
import { Calendar, MapPin, Users } from "lucide-react";
import { type SampleEvent } from "@/data/sampleEvents";
import { motion } from "framer-motion";

interface EventCardProps {
  event: SampleEvent;
  index: number;
}

const EventCard = ({ event, index }: EventCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link
        to={`/event/${event.slug}`}
        className="group block overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-gold"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            {event.category}
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-muted/80 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-muted-foreground border border-border">
            SAMPLE
          </span>
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="font-display text-xl font-bold text-foreground">{event.title}</h3>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <p className="line-clamp-2 text-sm text-muted-foreground">{event.shortDescription}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" /> {event.date}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> {event.location.split(",")[0]}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-primary" /> {event.expectedAttendees.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-semibold text-primary">{event.ticketPrice}</span>
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">View Details →</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default EventCard;
