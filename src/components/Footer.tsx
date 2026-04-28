import { Link } from "react-router-dom";
import { Instagram, Linkedin, Send, Mail, Phone } from "lucide-react";
import versLogo from "@/assets/vers-logo-nobg.png";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="grid grid-cols-2 items-start gap-x-3 gap-y-4 sm:gap-8 lg:grid-cols-4">
          {/* Brand */}
          <div className="min-w-0 space-y-1.5 sm:space-y-4">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2">
              <img src={versLogo} alt="VERS" className="h-6 w-6 object-contain sm:h-9 sm:w-9" />
              <span className="font-display text-sm font-bold text-foreground sm:text-xl">VERS</span>
            </Link>
            <p className="text-[11px] leading-snug text-muted-foreground sm:text-sm">
              Seamless events, every time.
            </p>
            <div className="flex gap-2 sm:gap-4">
              <a href="https://www.instagram.com/vionevents?igsh=MTVuODR3anQ5OGV6cw%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary">
                <Instagram className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              </a>
              <a href="https://t.me/vionevents" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary">
                <Send className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              </a>
              <a href="https://www.linkedin.com/company/vion-events/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary">
                <Linkedin className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="min-w-0 space-y-1.5 sm:space-y-4">
            <h4 className="font-display text-xs font-semibold text-foreground sm:text-lg">Quick Links</h4>
            <nav className="flex flex-col gap-1 sm:gap-2">
              <Link to="/" className="text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:text-sm">Home</Link>
              <Link to="/events" className="text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:text-sm">Events</Link>
              <Link to="/auth?intent=organizer" className="text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:text-sm">Create Event</Link>
              <Link to="/help" className="text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:text-sm">Help</Link>
            </nav>
          </div>

          {/* Company */}
          <div className="min-w-0 space-y-1.5 sm:space-y-4">
            <h4 className="font-display text-xs font-semibold text-foreground sm:text-lg">Company</h4>
            <nav className="flex flex-col gap-1 sm:gap-2">
              <Link to="/about" className="text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:text-sm">About Us</Link>
              <Link to="/privacy" className="text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:text-sm">Privacy Policy</Link>
              <Link to="/terms" className="text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:text-sm">Terms of Service</Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="min-w-0 space-y-1.5 sm:space-y-4">
            <h4 className="font-display text-xs font-semibold text-foreground sm:text-lg">Contact Us</h4>
            <div className="flex flex-col gap-1 sm:gap-2">
              <a href="mailto:contact@vionevents.com" className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:gap-2 sm:text-sm">
                <Mail className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" /> <span className="truncate">contact@vionevents.com</span>
              </a>
              <a href="tel:+251944010908" className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground transition-colors hover:text-primary sm:gap-2 sm:text-sm">
                <Phone className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" /> +251 944 010 908
              </a>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-3 text-center sm:mt-6 sm:pt-4">
          <p className="text-[11px] sm:text-sm text-muted-foreground">
            © 2026 <span className="text-foreground font-semibold">VERS</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
