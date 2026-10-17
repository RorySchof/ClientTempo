/** Showing Notes Mailgun + deployment config */

export const MAILGUN_DOMAIN =
  process.env.MAILGUN_DOMAIN ||
  "sandbox8e4a199aa7d24247b33a1721346cab6b.mailgun.org";

export const INBOUND_EMAIL =
  process.env.INBOUND_EMAIL ||
  "showings@sandbox8e4a199aa7d24247b33a1721346cab6b.mailgun.org";

export const INBOUND_WEBHOOK_URL =
  process.env.INBOUND_WEBHOOK_URL ||
  "https://realtor-flow-eight.vercel.app/api/showing-notes/inbound-email";
