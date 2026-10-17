import { MAILGUN_DOMAIN, INBOUND_EMAIL } from "./config.js";

function getApiKey() {
  const key = process.env.MAILGUN_API_KEY;
  if (!key) {
    throw new Error("MAILGUN_API_KEY is not set");
  }
  return key;
}

function authHeader() {
  return `Basic ${Buffer.from(`api:${getApiKey()}`).toString("base64")}`;
}

/**
 * Send an email via Mailgun (sandbox domain).
 */
export async function sendMailgunMessage({ to, subject, text, html, from }) {
  const domain = process.env.MAILGUN_DOMAIN || MAILGUN_DOMAIN;
  const fromAddress =
    from || `Open House Notes <showings@${domain}>`;

  const response = await fetch(
    `https://api.mailgun.net/v3/${domain}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        from: fromAddress,
        to,
        subject,
        text: text || "",
        ...(html ? { html } : {}),
      }).toString(),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Mailgun send failed (${response.status}): ${body}`);
  }

  return { ok: true, body };
}

export function getInboundAddress() {
  return process.env.INBOUND_EMAIL || INBOUND_EMAIL;
}

export function getMailgunDomain() {
  return process.env.MAILGUN_DOMAIN || MAILGUN_DOMAIN;
}
