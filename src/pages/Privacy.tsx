import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { motion } from "framer-motion";

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide when registering for events, creating an organizer account, or contacting us. This may include your name, email address, phone number, and payment details. We also collect usage data such as pages visited, device information, and IP address.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `We use your information to process event registrations, send confirmation emails and reminders, facilitate check-ins, provide analytics to event organizers, improve our platform, and communicate important updates about our services.`,
  },
  {
    title: "3. Information Sharing",
    content: `We share your registration details with event organizers for the events you register for. We do not sell your personal information to third parties. We may share information with service providers who assist in operating our platform.`,
  },
  {
    title: "4. Data Security",
    content: `We implement industry-standard security measures to protect your data, including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure.`,
  },
  {
    title: "5. Your Rights",
    content: `You have the right to access, correct, or delete your personal information. You can manage your account settings or contact us to exercise these rights. You may opt out of promotional communications at any time.`,
  },
  {
    title: "6. Cookies",
    content: `We use cookies and similar technologies to improve your experience, analyze usage patterns, and deliver personalized content. You can manage cookie preferences through your browser settings.`,
  },
  {
    title: "7. Changes to This Policy",
    content: `We may update this privacy policy from time to time. We will notify you of significant changes by posting a notice on our platform or sending you an email.`,
  },
  {
    title: "8. Contact Us",
    content: `If you have questions about this privacy policy, please contact us at info@vionevents.com or call +251 944 010 908.`,
  },
];

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Privacy Policy"
        description="Read the VERS privacy policy to understand how we collect, use, and protect your personal information."
        path="/privacy"
      />
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-10">
          <div className="text-center space-y-4">
            <h1 className="font-display text-4xl font-bold text-foreground">
              Privacy <span className="text-gradient-gold">Policy</span>
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

export default Privacy;
