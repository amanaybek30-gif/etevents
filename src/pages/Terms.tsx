import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { motion } from "framer-motion";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: `By accessing or using VERS, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.`,
  },
  {
    title: "2. Use of Services",
    content: `VERS provides event registration, check-in, and management services. You may use our services for lawful purposes only. You are responsible for maintaining the confidentiality of your account credentials.`,
  },
  {
    title: "3. Organizer Responsibilities",
    content: `Event organizers are responsible for the accuracy of their event information, compliance with local laws and regulations, proper management of attendee data, and fulfilling obligations to registered attendees.`,
  },
  {
    title: "4. Attendee Responsibilities",
    content: `Attendees must provide accurate registration information, comply with event rules and policies, and treat other attendees and organizers with respect.`,
  },
  {
    title: "5. Payments & Refunds",
    content: `Payment processing and refund policies are managed by individual event organizers. VERS facilitates the registration process but is not responsible for refund disputes between organizers and attendees.`,
  },
  {
    title: "6. Intellectual Property",
    content: `All content, features, and functionality of VERS are owned by VION Events and are protected by copyright, trademark, and other intellectual property laws.`,
  },
  {
    title: "7. Limitation of Liability",
    content: `VERS is provided "as is" without warranties of any kind. VION Events shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.`,
  },
  {
    title: "8. Termination",
    content: `We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent or harmful activities.`,
  },
  {
    title: "9. Governing Law",
    content: `These terms are governed by the laws of the Federal Democratic Republic of Ethiopia.`,
  },
  {
    title: "10. Contact",
    content: `For questions about these terms, contact us at info@vionevents.com or call +251 944 010 908.`,
  },
];

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Terms of Service"
        description="Read the VERS terms of service governing your use of our event registration and management platform."
        path="/terms"
      />
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-10">
          <div className="text-center space-y-4">
            <h1 className="font-display text-4xl font-bold text-foreground">
              Terms of <span className="text-gradient-gold">Service</span>
            </h1>
            <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
          </div>

          <div className="space-y-8">
            {sections.map((s) => (
              <div key={s.title} className="space-y-2">
                <h2 className="font-display text-lg font-semibold text-foreground">{s.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default Terms;
