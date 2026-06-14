# Adwuma v4

> Verified international job placement platform  
> **Stack:** React 18 · Supabase · Paystack · Cloudflare Pages · GitHub Actions

---

## Project Structure

```
adwuma-v4/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions → Cloudflare Pages
├── public/
│   └── _redirects                  # SPA routing fix for Cloudflare Pages
├── src/
│   ├── App.jsx                     # Root router — all 30+ routes wired
│   ├── context/
│   │   └── AuthContext.jsx         # Session, profile, role state
│   ├── components/
│   │   ├── shared/
│   │   │   └── RouteGuards.jsx     # ProtectedRoute, RoleRoute, PublicOnlyRoute
│   │   ├── layout/                 # Navbar, sidebars, shell layouts
│   │   └── ui/                     # Button, Input, Modal, Badge, etc.
│   ├── hooks/
│   │   └── index.js                # useNotifications, useWallet, useApplications, useFileUpload
│   ├── lib/
│   │   ├── supabase.js             # Supabase client + all query helpers
│   │   ├── paystack.js             # Payment popup + reference generation
│   │   └── currency.js             # Multi-currency formatting utilities
│   ├── pages/
│   │   ├── auth/                   # Login, Register, Forgot/Reset password
│   │   ├── seeker/                 # Dashboard, Applications, Tracker, Inbox, Profile
│   │   ├── agent/                  # Dashboard, KYC, Jobs, Applications, Wallet, Inbox
│   │   └── admin/                  # Dashboard, KYC queue, Jobs, Docs, Payments, Withdrawals, Users, Settings
│   └── types/                      # JSDoc type definitions (or .d.ts if using TS)
├── supabase/
│   ├── schema.sql                  # Full DB schema — 19 tables, RLS, triggers, indexes
│   └── functions/
│       └── verify-payment/
│           └── index.ts            # Edge Function: Paystack verification server-side
├── .env.example                    # Environment variables template
└── package.json
```

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-org/adwuma-v4.git
cd adwuma-v4
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `supabase/schema.sql`
3. Go to **Storage** → create three buckets:
   - `documents` (public)
   - `kyc` (private)
   - `avatars` (public)
4. Copy your **Project URL** and **Anon Key** from Settings → API

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:
```env
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_live_...
REACT_APP_APP_URL=https://adwuma.viarnex.com.ng
```

### 4. Deploy Supabase Edge Function

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Set secrets (never put these in .env)
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...

# Deploy function
supabase functions deploy verify-payment
```

### 5. Create first Admin account

After your first user signs up, run this in Supabase SQL Editor:

```sql
update profiles
set role = 'admin'
where id = (select id from auth.users where email = 'your-admin@email.com');
```

### 6. Run locally

```bash
npm start
```

---

## Deploy to Cloudflare Pages

### Manual (first time)

1. Push repo to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → Create a project
3. Connect GitHub repo → select `adwuma-v4`
4. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `build`
5. Add environment variables (same as `.env`)
6. Deploy

### Automatic (CI/CD)

Add these secrets to your GitHub repo (Settings → Secrets):
- `CLOUDFLARE_API_TOKEN` — from Cloudflare → API Tokens → Create Token (Pages edit permission)
- `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard URL
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_PAYSTACK_PUBLIC_KEY`

Every push to `main` auto-deploys via `.github/workflows/deploy.yml`.

---

## Multi-Currency

Adwuma v4 supports displaying fees in any currency. Paystack currently processes **NGN** and **GHS** only.

| Currency | Symbol | Paystack? |
|----------|--------|-----------|
| NGN | ₦ | ✅ |
| GHS | GH₵ | ✅ |
| USD | $ | ❌ Display only |
| GBP | £ | ❌ Display only |
| EUR | € | ❌ Display only |

When an agent sets a service fee in a non-Paystack currency (e.g. USD), the application flow shows a notice that payment will be processed in NGN at the current exchange rate. Exchange rate fetching is a planned feature (SerpAPI or open exchange rates).

---

## Money Flow Summary

```
Seeker pays (Paystack popup)
    ↓
verify-payment Edge Function
    ↓ validates with Paystack secret key
    ↓ creates payment row (status: holding)
    ↓ creates application row
    ↓ notifies agent
    ↓
Agent works → uploads docs → admin reviews docs
    ↓
Admin releases escrow
    ↓ platform keeps 10%
    ↓ agent wallet credited 90%
    ↓
Agent requests withdrawal
    ↓
Admin approves → manual bank transfer → marks processed
```

---

## User Roles & Routes

| Role | Routes |
|------|--------|
| **Public** | `/`, `/jobs`, `/jobs/:id` |
| **Seeker** | `/dashboard/*` |
| **Agent** | `/agent/*` (KYC must be approved to post jobs) |
| **Admin** | `/admin/*` |

---

## Key Design Decisions

- **No plain-text secrets in React** — Paystack secret key lives only in Supabase Edge Functions
- **RLS everywhere** — all 19 tables have Row Level Security; the anon key can't access unauthorised data
- **Optimistic UI** — React Query handles caching, background refresh, and loading states
- **Realtime** — Supabase Realtime channels for notifications and messages (no polling)
- **Lazy loading** — every page is code-split with `React.lazy` for fast initial load
- **Cloudflare Pages** — `_redirects` file ensures client-side routing works on direct URL access

---

Built by Viarnex · Adwuma v4 · 2025
 
