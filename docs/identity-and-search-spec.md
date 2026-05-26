# Identity & Member Search Spec

## Overview

Tally needs a stable, human-readable unique identifier per user so that adding someone to a group is deterministic. The current system has `display_name` (human-readable, not unique) and `add_code` (unique, not human-readable). This spec adds a `handle` that bridges both — unique, user-chosen, naturally shareable.

---

## Identity Layers

Every registered user has three identity fields. Each serves a different job:

| Field | Unique | Human-readable | User-set | Purpose |
|---|---|---|---|---|
| `name` | No | Yes | Google / signup | Display name, shown everywhere |
| `handle` | Yes | Yes | Required at onboarding | Search, @mention, sharing |
| `add_code` | Yes | No | System-generated | Exact lookup fallback, QR, support |

**UI rendering rule:** always show `display_name ?? name` as the primary label. Handle shown secondary as `@handle`. Add code never shown in search results or group UI.

---

## Database Changes

### Add `handle` to profiles

```sql
ALTER TABLE profiles
  ADD COLUMN handle text UNIQUE;
```

Constraints (enforced at app layer before insert):
- Lowercase only
- 3–20 characters
- Alphanumeric and underscores only (`^[a-z0-9_]+$`)
- Cannot start or end with underscore

Handle is nullable in the DB — a `NULL` handle means the user has not completed onboarding. Middleware uses this to detect first-time users.

### Update `handle_new_user` trigger

Auto-generate a suggested handle from the user's Google first name so onboarding has something to pre-fill:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_handle text;
BEGIN
  -- derive base from first name, lowercased, strip non-alphanumeric
  base_handle := lower(regexp_replace(
    split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1),
    '[^a-z0-9]', '', 'g'
  ));

  INSERT INTO profiles (user_id, name, email, avatar_url, handle)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    NULL  -- handle stays NULL until onboarding is completed
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

The trigger intentionally leaves handle as NULL. The suggested handle is generated client-side in the onboarding screen from the user's name.

---

## Onboarding Flow

### Trigger condition

Middleware checks on every protected route:

```ts
if (session && profile.handle === null) {
  redirect('/onboarding')
}
```

Once handle is set, user never sees onboarding again.

### Google OAuth (new user)

Fields on screen:
- **Name** — pre-filled from Google (`full_name`), read-only
- **Handle** — auto-suggested from first name (e.g. `matthew` → `@matthew`), editable, real-time availability check

User experience: most users tap Continue immediately. Editing is optional.

### Email/password (new user)

Handle is collected as part of the signup form — not a separate screen. Fields:
- **First name** — blank, required
- **Last name** — blank, required  
- **Handle** — auto-suggested once first name is typed, editable, availability check
- **Email + password** — existing fields

By the time the user enters the app, handle is already set. Middleware never redirects email/password users to onboarding.

### Handle availability check

Client-side, debounced 300ms, fires on every keystroke after the first 3 characters:

```ts
const { data } = await supabase
  .from('profiles')
  .select('id')
  .eq('handle', handle)
  .maybeSingle()

// data === null → available
// data !== null → taken
```

Show green check when available, inline error when taken. No modal.

### Saving the handle

On Continue/Create:

```ts
await supabase
  .from('profiles')
  .update({ handle: handle.toLowerCase() })
  .eq('id', session.user.id)
```

---

## Search Behavior

### Three search modes — one input

The input value determines which mode fires:

| Input pattern | Mode | Query |
|---|---|---|
| Starts with `@` | Handle search | Strip `@`, fuzzy match `handle ILIKE '%query%'` |
| Matches `^[A-Z0-9]{8}$` | Add code lookup | Exact match `add_code = 'A8F3BC2D'` |
| Anything else | Fuzzy | Match `name ILIKE '%q%' OR handle ILIKE '%q%'` |

### Search query

```sql
-- Fuzzy mode (default)
SELECT id, name, display_name, avatar_url, handle
FROM profiles
WHERE (
  name    ILIKE '%' || :query || '%' OR
  handle  ILIKE '%' || :query || '%'
)
AND status = 'active'
AND id != :current_user_id
LIMIT 10

-- Handle mode (@ prefix)
SELECT id, name, display_name, avatar_url, handle
FROM profiles
WHERE handle ILIKE '%' || :query || '%'
AND status = 'active'
AND id != :current_user_id
LIMIT 10

-- Add code mode (exact)
SELECT id, name, display_name, avatar_url, handle
FROM profiles
WHERE add_code = upper(:query)
AND status = 'active'
AND id != :current_user_id
```

Rules:
- Never return `email` to the client
- Never return `add_code` to the client in search results
- Guests (`status = 'guest'`) excluded from global search

### Minimum query length

- Fuzzy and handle modes: 2+ characters
- Add code mode: exactly 8 characters (auto-detected, no minimum typing wait)

---

## Combobox UI

### Search result row (existing Tally user)

```
[ Avatar ]  Display name
            @handle
```

No add code. No email. No location. For MVP, no "shared groups" count (requires social graph query — deferred).

### Guest fallback row (always shown at bottom of dropdown)

```
[ + ]  Add "alice" as guest
       No Tally account needed
```

Shown whenever the input has 2+ characters, regardless of how many Tally results appeared above.

### Add code exact match (hero treatment)

When input matches the 8-char add code format and a result is found, collapse the normal list and show a single hero card:

```
[ Avatar ]  Alice Johnson
            @alice
            Add code recognized ✓
            [ Add ]
```

If no match found for the add code, show:

```
No user found for that code.
[ Add "A8F3BC2D" as guest ]  ← probably not useful, just show nothing
```

### Input detection UX

- User types `@` as first character → input switches to monospace, search icon highlights, placeholder changes to "Search by handle…"
- User types 8 uppercase alphanumeric → input border shifts to sun yellow, "Add code" badge appears inline (existing behavior from `AddMemberModal`, carry forward to `MemberCombobox`)

---

## Member Entry Types

No change to the `MemberEntry` type from `MemberCombobox.tsx`:

```ts
export type MemberEntry =
  | { type: 'user'; profile: ProfileSnippet }
  | { type: 'guest'; name: string; tempId: string }
```

`ProfileSnippet` gains `handle`:

```ts
export type ProfileSnippet = Pick<
  Profile,
  'id' | 'name' | 'display_name' | 'avatar_url' | 'handle'
  // add_code removed — no longer surfaced in search UI
>
```

---

## What Add Code Is Still Used For

- QR code generation on the Me/profile page (`tally.app/add/[add_code]`)
- The `/add/[add_code]` route for scanning
- Support and debugging
- Invite link infrastructure

Add code is **never** shown in:
- Search results
- Group member lists
- Any discovery UI

---

## Out of Scope (Deferred)

- Handle change flow (allow editing in settings, no rate limiting for MVP)
- "Shared groups" confidence signal in search results
- Handle @mentions in expense notes
- Profile pages at `tally.app/@handle`
