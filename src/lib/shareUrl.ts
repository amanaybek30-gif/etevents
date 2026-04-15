/**
 * Generates a clean share URL for the public site.
 * Bot/crawler detection is handled at the Vercel middleware level
 * to serve proper OG tags while keeping URLs clean.
 */
export const getShareUrl = (path: string): string => {
  return `https://vers.vionevents.com${path}`;
};
