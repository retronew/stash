import type { MediaJob } from "#media/jobs";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Downloaded attachments (images, files). */
  MEDIA: R2Bucket;
  /** Attachment downloads; consumed by media/consumer.ts. */
  MEDIA_QUEUE: Queue<MediaJob>;
  /** Better Auth: secret for signing sessions (`wrangler secret put`). */
  BETTER_AUTH_SECRET: string;
  /** Public origin, e.g. https://stash.example.com (OAuth callbacks and webhook URLs live under it). */
  BETTER_AUTH_URL?: string;
  /** Emails allowed to sign in, comma separated. Everyone else is rejected. */
  ALLOWED_EMAILS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** Local dev only: "1" skips sign-in. Ignored unless BETTER_AUTH_URL is localhost. */
  DEV_AUTH_BYPASS?: string;
}
