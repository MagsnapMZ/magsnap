# MAGSNAP Registry Setup

Phase 1 routes:

- `/founder` - Registry Activation form
- `/registry` - public MAGSNAP REGISTRY

The pages are static GitHub Pages pages. Data storage uses Supabase when configured. Without Supabase, `/registry` shows the local seed record from `assets/founder/registry-data.js`.

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

## Registry Principle

- Registry Number comes from the physical QC/Test Card.
- Registry Number is not registration order.
- Registry Number is not purchase order.
- Registry Number is not purchase date.
- Registry identity stays permanent even if product versions change.

## Public Data

The public `/registry` page reads only from `public_registry_records`.

Visible fields:

- Registry Number
- Display Name
- Country
- Role
- Configuration
- Status

Hidden fields:

- Phone
- Email
- Address
- Tracking Number
- Private Notes
- Contact Method
- Contact Detail
- City
- Industry
- Social Media

Private fields are stored in `registry_private_details` and are not exposed by the public registry.

## Phase 1 Rules

- No login.
- No membership system.
- No points, ranking, forum, social network, or app.
- Registry Number is manually entered by the user from the physical QC/Test Card.
- Registry Number is normalized to four digits, for example `0171`.
- Duplicate Registry Numbers are rejected by the database.

## Seed Record

The first public Origin record is:

- Registry Number: `0171`
- Owner: `MZ`
- Role: `Founder`
- Country: `China`
- Configuration: `Type A / Blue Lens`
- Status: `Origin`

If MZ's physical card number changes, update both:

- `assets/founder/registry-data.js`
- the seed insert at the bottom of `supabase/founder-registry-schema.sql`
