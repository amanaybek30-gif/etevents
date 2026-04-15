
# VION Events Platform — Full Build Plan

## Overview
A multi-event management platform tailored for the Ethiopian market. Black, white, and gold theme throughout. Organizers can create events, attendees can register and pay, admins oversee everything.

---

## Phase 1: Foundation & Home Page

### Home Page
- Hero section with bold branding (VION Events) and "Create Your Event" CTA button
- Featured Ethiopian-themed sample events (Addis Music Fest, Ethiopian Business Summit, Timkat Cultural Festival, Addis Tech Week, etc.) displayed as visually rich cards with cover images
- Additional engaging content: promotional banners, event categories, "Why VION Events" section, testimonials
- Footer with: Admin Access link, Organizer Dashboard link, Help Center, Contact (contact@vionevents.com, +251944010908), social media icons (Instagram, Telegram, LinkedIn), "© 2026 VION Events PLC"

### Design System
- **Background:** Black | **Text:** White | **Accents/Buttons:** Gold
- Distinct typography: large bold titles vs clean body text
- Elegant, modern UI with subtle animations and gold accent details

---

## Phase 2: Event Profile Pages

Each event gets a dedicated profile page with:
- Cover image banner
- Event Date, Location, Duration, Expected Attendees
- About the Event section
- Detailed Event Description
- What to Expect
- Main Host & Partner Organizations
- Ticket Price & What's Included
- **"Book Now"** button (prominent, gold)
- Unique shareable event URL

Sample events will each have distinct content, images, and details.

---

## Phase 3: Registration & Booking Flow

### RSVP Pop-up (triggered by "Book Now")
- Blurred background overlay with "RSVP Your Spot" title
- Required fields: Full Name, Phone Number, Email
- **Payment Method** dropdown:
  - **Bank Transfer** → secondary dropdown: Commercial Bank of Ethiopia, Bank of Abyssinia, Awash Bank, Dashen Bank
  - **Telebirr**
  - **Mpessa**
- Upon selecting payment method: display account number and account name for payment
- Receipt upload field (image or PDF)
- **Submit** button (all fields mandatory)

### Post-Submission
- Unique Ticket ID generated
- Status set to "Pending"
- Automated email via Resend: "Thank You For Registering" with registration details, note about approval pending, beautifully designed email with VION Events branding and footer
- Data stored in database linked to the specific event

---

## Phase 4: Database & Backend (Lovable Cloud)

### Core Tables
- **Users** — all platform users (attendees, organizers, admins)
- **User Roles** — role-based access (admin, organizer, staff, attendee)
- **Organizers** — organizer profiles with payment details, logo
- **Events** — all event data, linked to organizer
- **Ticket Types** — VIP, Regular, Early Bird per event
- **Registrations/Attendees** — registration data per event with status (Pending/Approved/Rejected)
- **Payments** — payment method, receipt file reference, status
- **Check-ins** — check-in records with duplicate prevention
- **Custom Form Fields** — organizer-defined custom registration questions

### Storage
- Secure storage buckets for payment receipts, event images, organizer logos
- Receipts accessible only to admins and the owning organizer

### Security
- Row-Level Security on all tables
- Role-based access control via security definer functions
- QR codes encode only Ticket ID (no personal data exposed)
- Admin panel requires authenticated login

---

## Phase 5: QR Code System

- Auto-generate unique QR code per registration (encoding Ticket ID only)
- QR code sent to attendee email upon organizer approval
- QR links to a secure check-in verification endpoint (not public data)

---

## Phase 6: Admin Dashboard

### Authentication
- Secure admin login (email/password)
- Admin credentials provided to you upon setup

### Features
- **Event Management**: Create, edit, delete events; manage all uploaded events
- **Registration Dashboard**: View all registrations with dropdown filter by event (default: "All Events")
- **Registration Actions**: Approve/Reject registrations, view uploaded receipts
- **QR Scanner**: Built-in camera scanner for check-in
- **Manual Check-in**: Ticket ID text entry as fallback
- **Duplicate Prevention**: System blocks re-check-in attempts
- **Analytics**: Total registrations, approved, checked-in counts per event
- **Search & Filter**: Search by name, email, ticket ID, status
- **Export to Excel**: Download registration and check-in data per event as Excel/CSV

---

## Phase 7: Organizer Onboarding & Dashboard

### Organizer Sign-Up Flow
- Sign up / Log in with email verification
- Complete organizer profile: Name, Phone, Payment collection details (Bank/Telebirr/Mpessa), Logo upload
- Email used for communication only (not displayed publicly)

### Event Creation Wizard (Multi-Step)
1. **Basic Details**: Name, Description, Category, Image, Location, Date & Time
2. **Ticket Settings**: Free/Paid, Price, Total tickets, Sales dates, Multiple ticket types (VIP/Regular/Early Bird)
3. **Registration Form Builder**: Required fields (Name, Email) + optional fields + custom questions
4. **Payment Setup**: Platform-handled or manual receipt upload
5. **QR & Check-in Settings**: Auto QR, re-entry policy, check-in window
6. **Preview & Publish**: Preview event page, click Publish

### Post-Publish
- Unique event page generated
- Registration system activated
- Organizer dashboard activated with: ticket sales overview, check-in management, QR scanner, revenue tracking, export functionality
- Login credentials sent to organizer's email

---

## Phase 8: Email Notifications (Resend)

- **Registration confirmation** email to attendee (immediate)
- **Approval email** with QR code ticket (upon organizer/admin approval)
- **Organizer credentials** email (upon event creation)
- All emails branded with VION Events design, gold accents, social media footer

---

## Phase 9: Polish & Advanced Features

- Responsive design (mobile + desktop)
- Status badge system (Pending → Approved → Checked In)
- Event categories and filtering on home page
- Smooth animations and transitions
- Loading states and error handling throughout
- Stable, scalable database architecture for unlimited users and events
