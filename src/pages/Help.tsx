import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Mail, Phone, Send } from "lucide-react";
import { motion } from "framer-motion";

const Help = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Help Center" description="Need help with VERS? Find support contacts, FAQs, and assistance for event registration and management." path="/help" />
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-10">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold text-foreground">
              Help <span className="text-gradient-gold">Center</span>
            </h1>
            <p className="mt-4 text-muted-foreground">Need help? Reach out to our team.</p>
          </div>

          <div className="space-y-6">
            {[
              { icon: Mail, label: "Email Us", value: "contact@vionevents.com", href: "mailto:contact@vionevents.com" },
              { icon: Phone, label: "Call Us", value: "+251 944 010 908", href: "tel:+251944010908" },
              { icon: Send, label: "Telegram", value: "@vionevents", href: "https://t.me/vionevents" },
            ].map(({ icon: Icon, label, value, href }) => (
              <a key={label} href={href} className="flex items-center gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:border-primary">
                <Icon className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="font-semibold text-foreground">{value}</p>
                </div>
              </a>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-8">
            <h2 className="font-display text-xl font-bold text-foreground">Frequently Asked Questions</h2>
            <div className="mt-6 space-y-4">
              {[
                { q: "How do I register for an event?", a: "Click 'Book Now' on any event page, fill in your details, upload a payment receipt, and submit." },
                { q: "When will my registration be approved?", a: "Registrations are reviewed within 24-48 hours. You'll receive an email with your QR ticket upon approval." },
                { q: "Can I get a refund?", a: "Refund policies vary by event. Contact the event organizer or reach out to us for assistance." },
              ].map((faq) => (
                <div key={faq.q} className="border-b border-border pb-4 last:border-0">
                  <p className="font-semibold text-foreground">{faq.q}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default Help;
