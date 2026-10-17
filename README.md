# ClientTempo

ClientTempo is a SaaS toolkit for real-estate agents. The application was developed in a private repository named RealtorFlow. This tree is the application.

The marketing site is [clienttempo.com](https://www.clienttempo.com/). That site lives in a separate repository. This repository is the application.

## Workflows

The app includes five agent workflows:

1. **Client replies.** Turn one client email into a structured draft the agent reviews.
2. **Showing notes.** Generate notes from a showing.
3. **Open-house notes.** Generate notes from an open house.
4. **Listing generation.** Draft a listing from the details the agent enters.
5. **Real-estate Q&A.** Answer real-estate questions in the RealGPT chat.

Showing notes, open-house notes, and client replies also have inbound-email routes for Mailgun.

## Stack

- Next.js (App Router) and React
- TypeScript and JavaScript
- Tailwind CSS
- Clerk for sign-in
- Stripe for subscriptions, the billing portal, and token purchases
- Upstash Redis for application data, balances, and inbound-mail handling
- Groq and OpenAI for generation
- Mailgun for inbound email

## Architecture

The interface is a Next.js app. Authenticated pages use Clerk. Route handlers under `app/api` take chat requests, start Stripe Checkout, receive Stripe webhooks, and accept inbound Mailgun posts.

Generation for each workflow lives under `lib/`. Saved notes, listings, and credit balances go to Redis. Stripe webhooks update the plan and grant credits. The webhook verifies the `stripe-signature` header before it handles the event.

Each workflow reads its writing instructions at runtime from `prompts/local/`. Those files are not in Git.

## Run it locally

```bash
npm install
cp .env.example .env.local
mkdir -p prompts/local
cp prompts/examples/client-reply.txt prompts/local/client-reply.txt
cp prompts/examples/showing-notes.txt prompts/local/showing-notes.txt
cp prompts/examples/open-house-notes.txt prompts/local/open-house-notes.txt
cp prompts/examples/listing.txt prompts/local/listing.txt
cp prompts/examples/realgpt.txt prompts/local/realgpt.txt
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Fill `.env.local` with your own keys. `.env.example` lists the variable names only. Do not commit `.env.local`.

Replace each copied file in `prompts/local/` with your own writing instructions before using the workflows. The files in `prompts/examples/` are placeholders so a fresh clone can build. They are not the production prompts. If a local file is missing, that workflow uses its placeholder and the model is told to answer `Prompt not configured.`

`scripts/` contains manual checks for Stripe billing, credit safety, the usage ledger, and inbound mail. They are not wired to `npm test`. `npm run lint` runs ESLint.
