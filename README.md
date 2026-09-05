# Portfolio with admin panel

A personal portfolio site with a password-protected `/admin` page for
editing everything — text, projects, resume, photo, contact info, design —
through forms. No code editing needed for day-to-day updates.

- `server.js` runs a small Express server.
- Your content lives in `data/content.json` (a JSON file acting as the
  database) and uploads land in `public/uploads/`.
- The public site fetches and renders that content; `/admin` is where you
  edit it.

## Setup

```
npm install
cp .env.example .env
```

Open `.env` and set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET`
(any long random string). Never commit `.env`.

**Optional — two-factor login:** run `node scripts/generate-2fa-secret.js`,
scan the printed QR code with an authenticator app (Google Authenticator,
Authy, 1Password, etc.), then put the secret it gives you into `.env` as
`ADMIN_TOTP_SECRET` and restart. Leave it blank to skip 2FA entirely.

Start it:
```
npm start
```
Site: `http://localhost:3000` — Admin: `http://localhost:3000/admin`

## Using the admin

Every section of the site (Design, Hero, About, Projects, Testimonials,
Resume, Education, Additional sections, Contact, Footer) has its own panel
with self-explanatory fields and inline hints. A few things worth knowing:

- **Save changes** writes to the live site immediately — no restart needed.
- **Live preview** (top bar) shows your actual site updating as you type,
  including unsaved edits — nothing publishes until you hit Save.
- Sections with a **"Show on site"** switch (About, Projects, Resume,
  Education, Testimonials, custom sections) can be hidden without deleting
  their content.
- **Design panel**: color theme, font, layout (top nav or sidebar), and
  background effect (starfield/particles/none) are all independent
  settings you can mix freely.
- **About → Photo**: upload an image or leave it blank for initials; set
  its size/shape, and show it in About, the Hero, both, or nowhere.
- **Résumé PDF autofill**: after uploading a PDF, a button appears that
  tries to fill in your bio/skills/work history from it. Best-effort —
  works well on simple, text-based résumés with clear section headers;
  always review before saving.
- Repeatable lists (projects, work history, links, testimonials, etc.) use
  `+ Add` and per-row ↑ ↓ ✕ controls.
- Sessions last 8 hours; use **Log out** on shared computers.

## Contact form

Opens the visitor's email client, pre-filled — no backend needed. To
receive submissions directly instead, wire up a service like
[Formspree](https://formspree.io) and swap the handler in
`public/script.js` (`handleContactForm`).

## Exporting a static copy

**"Export static site ↓"** (admin top bar) downloads a self-contained
`.zip` — plain HTML/CSS/JS with your content baked in, no server required.
Drop it on Netlify (drag onto app.netlify.com/drop), Vercel (`vercel
deploy`), GitHub Pages, or any static host. It's a snapshot of your last
**saved** version — re-export for an updated copy.

## Deploying the full app

Needs a host that runs a **persistent Node process with a writable disk**
(not static/serverless):

- **VPS / Pterodactyl**: `npm install && npm start` (use `pm2`/systemd to
  keep it running), or build the included `Dockerfile`. Both keep
  persistent storage by default, so `data/` and `public/uploads/` survive
  restarts.
- **Render / Railway / Fly.io**: connect your GitHub repo, build command
  `npm install`, start command `npm start`, set your `.env` values as
  environment variables. Use their persistent disk/volume feature, or
  saved edits can vanish on redeploy.
- **Netlify / Vercel don't fit as-is** — they're serverless/static, with
  no writable disk or long-running process, so saves and uploads won't
  persist. Use the static export above instead, or ask if you want help
  migrating to a real database + object storage to make the full admin
  version work there too.
- **GitHub** isn't itself a host — connect your repo to one of the
  platforms above.

## Files

| Path | What it's for |
|---|---|
| `server.js` | Backend — routes, auth, file uploads, static export |
| `data/content.json` | Site content (edit via `/admin`, not by hand) |
| `public/` | The public-facing site |
| `admin/` | Admin panel (login + editor) |
| `.env` | Your credentials (create yourself, never commit) |
| `Dockerfile` | Container build for VPS/Pterodactyl/Fly.io-style hosts |
| `scripts/generate-2fa-secret.js` | Run once to set up two-factor login |
