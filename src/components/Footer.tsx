import { Link } from "react-router-dom";
import { Instagram, Linkedin, Send, Mail, Phone } from "lucide-react";
import versLogo from "@/assets/vers-logo-nobg.png";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={versLogo} alt="VERS" className="h-9 w-9 object-contain" />
              <span className="font-display text-xl font-bold text-foreground">VERS</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Seamless events, every time.
            </p>
            <div className="flex gap-4">
              <a href="https://www.instagram.com/vionevents?igsh=MTVuODR3anQ5OGV6cw%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://t.me/vionevents" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary">
                <Send className="h-5 w-5" />
              </a>
              <a href="https://www.linkedin.com/company/vion-events/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-display text-lg font-semibold text-foreground">Quick Links</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-primary">Home</Link>
              <Link to="/events" className="text-sm text-muted-foreground transition-colors hover:text-primary">Events</Link>
              <Link to="/auth?intent=organizer" className="text-sm text-muted-foreground transition-colors hover:text-primary">Create Event</Link>
              <Link to="/help" className="text-sm text-muted-foreground transition-colors hover:text-primary">Help</Link>
            </nav>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h4 className="font-display text-lg font-semibold text-foreground">Company</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/about" className="text-sm text-muted-foreground transition-colors hover:text-primary">About Us</Link>
              
              <Link to="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-primary">Privacy Policy</Link>
              <Link to="/terms" className="text-sm text-muted-foreground transition-colors hover:text-primary">Terms of Service</Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-display text-lg font-semibold text-foreground">Contact Us</h4>
            <div className="flex flex-col gap-2">
              <a href="mailto:contact@vionevents.com" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                <Mail className="h-4 w-4" /> contact@vionevents.com
              </a>
              <a href="tel:+251944010908" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                <Phone className="h-4 w-4" /> +251 944 010 908
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 <span className="text-foreground font-semibold">VERS</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
