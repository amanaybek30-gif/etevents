/**
 * Returns type-specific email content based on attendee type and tier.
 */

export interface TypeContent {
  /** Badge label shown in the email e.g. "VIP Access" */
  badge: string;
  /** Badge background color */
  badgeColor: string;
  /** Badge text color */
  badgeTextColor: string;
  /** Greeting line after "Hi {name}," */
  registrationGreeting: string;
  /** Greeting line for approval email */
  approvalGreeting: string;
  /** Extra perks / note section (HTML) */
  perksHtml: string;
  /** Subject prefix for registration */
  registrationSubjectPrefix: string;
  /** Subject prefix for approval */
  approvalSubjectPrefix: string;
  /** Closing line */
  closingLine: string;
}

export function getTypeContent(attendeeType: string, tierName: string | null): TypeContent {
  const tier = (tierName || "").toLowerCase();
  const type = (attendeeType || "participant").toLowerCase();

  // Tier-based differentiation takes priority
  if (tier.includes("vvip") || tier.includes("v.v.i.p") || tier.includes("platinum")) {
    return {
      badge: tierName || "VVIP",
      badgeColor: "#7c3aed",
      badgeTextColor: "#ffffff",
      registrationGreeting: `Thank you for choosing <strong style="color:#a78bfa;">${tierName || "VVIP"}</strong> access! Your premium experience registration is being reviewed.`,
      approvalGreeting: `Welcome to the ultimate experience! Your <strong style="color:#a78bfa;">${tierName || "VVIP"}</strong> access has been confirmed.`,
      perksHtml: `<tr><td style="padding:0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a0a2e;border:1px solid #7c3aed44;border-radius:12px;">
          <tr><td style="padding:20px;text-align:center;">
            <p style="margin:0 0 8px;font-size:14px;color:#a78bfa;font-weight:700;">👑 VVIP Privileges</p>
            <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">You'll enjoy the highest tier of access including priority entry, exclusive seating, VIP lounge access, and premium amenities.</p>
          </td></tr>
        </table>
      </td></tr>`,
      registrationSubjectPrefix: "🌟 VVIP Registration",
      approvalSubjectPrefix: "👑 VVIP Access Confirmed",
      closingLine: "Prepare for a truly exclusive experience! 👑",
    };
  }

  if (tier.includes("vip") || tier.includes("v.i.p") || tier.includes("gold")) {
    return {
      badge: tierName || "VIP",
      badgeColor: "#E6A817",
      badgeTextColor: "#0a0a0a",
      registrationGreeting: `Thank you for choosing <strong style="color:#FFD54F;">${tierName || "VIP"}</strong> access! Your registration is being reviewed by the organizer.`,
      approvalGreeting: `Your <strong style="color:#FFD54F;">${tierName || "VIP"}</strong> access has been confirmed! Get ready for an elevated experience.`,
      perksHtml: `<tr><td style="padding:0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1400;border:1px solid #E6A81744;border-radius:12px;">
          <tr><td style="padding:20px;text-align:center;">
            <p style="margin:0 0 8px;font-size:14px;color:#FFD54F;font-weight:700;">⭐ VIP Benefits</p>
            <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">Enjoy priority entry, premium seating, and exclusive VIP perks at the event.</p>
          </td></tr>
        </table>
      </td></tr>`,
      registrationSubjectPrefix: "⭐ VIP Registration",
      approvalSubjectPrefix: "⭐ VIP Access Confirmed",
      closingLine: "Get ready for a VIP experience! ⭐",
    };
  }

  // Non-tier based: attendee type
  if (type === "vendor" || type === "exhibitor") {
    return {
      badge: "Vendor / Exhibitor",
      badgeColor: "#0ea5e9",
      badgeTextColor: "#ffffff",
      registrationGreeting: `Thank you for your vendor registration! Your application is under review by the organizer.`,
      approvalGreeting: `Great news — your vendor application has been approved! You're all set to showcase at the event.`,
      perksHtml: `<tr><td style="padding:0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1929;border:1px solid #0ea5e944;border-radius:12px;">
          <tr><td style="padding:20px;text-align:center;">
            <p style="margin:0 0 8px;font-size:14px;color:#38bdf8;font-weight:700;">🏪 Vendor Information</p>
            <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">The organizer will share setup details, booth assignments, and logistics closer to the event date. Please keep this email for reference.</p>
          </td></tr>
        </table>
      </td></tr>`,
      registrationSubjectPrefix: "🏪 Vendor Registration",
      approvalSubjectPrefix: "✅ Vendor Registration Approved",
      closingLine: "We look forward to your participation! 🏪",
    };
  }

  if (type === "guest" || type === "invited" || type === "speaker" || type === "panelist") {
    const label = type === "speaker" || type === "panelist" ? "Speaker / Panelist" : "Invited Guest";
    const icon = type === "speaker" || type === "panelist" ? "🎤" : "🌟";
    return {
      badge: label,
      badgeColor: "#10b981",
      badgeTextColor: "#ffffff",
      registrationGreeting: `Thank you for confirming your attendance as an ${label.toLowerCase()}! Your details have been received.`,
      approvalGreeting: `Your ${label.toLowerCase()} registration has been confirmed. We're honored to have you!`,
      perksHtml: `<tr><td style="padding:0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#021a0f;border:1px solid #10b98144;border-radius:12px;">
          <tr><td style="padding:20px;text-align:center;">
            <p style="margin:0 0 8px;font-size:14px;color:#34d399;font-weight:700;">${icon} ${label} Access</p>
            <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">You'll receive priority entry and special accommodations as our valued ${label.toLowerCase()}.</p>
          </td></tr>
        </table>
      </td></tr>`,
      registrationSubjectPrefix: `${icon} ${label} Registration`,
      approvalSubjectPrefix: `${icon} ${label} Confirmed`,
      closingLine: `We're honored to have you! ${icon}`,
    };
  }

  // If there's a named tier but not VIP/VVIP (e.g. "Early Bird", "Standard", "Regular")
  if (tierName && tierName.trim()) {
    return {
      badge: tierName,
      badgeColor: "#E6A817",
      badgeTextColor: "#0a0a0a",
      registrationGreeting: `Thank you for registering with a <strong style="color:#FFD54F;">${tierName}</strong> ticket! Your registration is pending confirmation.`,
      approvalGreeting: `Your <strong style="color:#FFD54F;">${tierName}</strong> ticket has been confirmed! Here are your details.`,
      perksHtml: "",
      registrationSubjectPrefix: `🎟️ ${tierName} Registration`,
      approvalSubjectPrefix: `🎟️ ${tierName} Ticket Confirmed`,
      closingLine: "We look forward to seeing you there! 🎶",
    };
  }

  // Default: general participant
  return {
    badge: "General Admission",
    badgeColor: "#3f3f46",
    badgeTextColor: "#ffffff",
    registrationGreeting: `Thank you for registering! Your registration is pending organizer confirmation. You'll receive a confirmation email with your ticket once approved.`,
    approvalGreeting: `Your registration has been successfully confirmed. We're excited to have you join us!`,
    perksHtml: "",
    registrationSubjectPrefix: "Thank You for Registering",
    approvalSubjectPrefix: "Registration Confirmed! 🎉",
    closingLine: "Welcome to the experience! 🎶",
  };
}
