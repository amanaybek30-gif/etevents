export const PUBLIC_APP_URL = "https://vers.vionevents.com";

const buildUrl = (pathname: string, params?: Record<string, string | undefined>) => {
  const url = new URL(pathname, PUBLIC_APP_URL);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

export const buildConfirmAttendanceUrl = (ticketId: string) =>
  buildUrl("/confirm-attendance", {
    ticket: ticketId,
    action: "confirm",
  });

export const buildEventRSVPUrl = (eventSlug: string) =>
  buildUrl("/confirm-attendance", {
    event: eventSlug,
  });

export const buildTelegramConnectUrl = (params?: {
  email?: string;
  fullName?: string;
  phone?: string;
}) =>
  buildUrl("/attendee-auth", {
    intent: "telegram",
    email: params?.email,
    fullName: params?.fullName,
    phone: params?.phone,
  });