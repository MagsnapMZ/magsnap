# MAGSNAP Founder Registry Setup

Phase 1 routes:

- `/founder` - Founder Activation form
- `/registry` - public Founder Registry

The pages are static GitHub Pages pages. Data storage uses Supabase.

## Supabase Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/founder-registry-schema.sql`.
4. Copy the project URL and anon public key.
5. Edit `assets/founder/supabase-config.js`:

```js
window.MAGSNAP_SUPABASE = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_ANON_PUBLIC_KEY"
};
```

## Public Data

The public `/registry` page reads only from `public_founder_registry`.

Visible fields:

- Founder Number
- Name/Nickname
- Country
- Sport/Activity Tags

Private fields are stored in `founder_private_contacts` and are not exposed by the public registry.

## Phase 1 Rules

- No login.
- No QR token.
- No membership system.
- No points, ranking, forum, social network, or app.
- Founder Number is manually entered by the user from the physical Founder Card.
- Founder Number must be `0001` to `1000`.
- Duplicate Founder Numbers are rejected by the database.
