require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const archiver = require('archiver');
const { authenticator } = require('otplib');
const { parseResumeText } = require('./lib/resumeParser');

const app = express();

const PORT = process.env.PORT || 3000;
// Explicit 0.0.0.0 rather than relying on the default, since some
// container/panel hosts (Docker, Pterodactyl) need the server bound to
// all interfaces, not just localhost, to be reachable from outside.
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
// Optional — set this (see scripts/generate-2fa-secret.js) to require a
// TOTP code at login. Leave it unset and login works with just a
// username/password, same as before.
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET || '';

if (!ADMIN_PASSWORD || !SESSION_SECRET) {
  console.error(
    '\n[ERROR] Missing ADMIN_PASSWORD or SESSION_SECRET.\n' +
    'Copy .env.example to .env and fill both in before starting the server.\n'
  );
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const CONTENT_PATH = path.join(DATA_DIR, 'content.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Content read/write helpers (JSON file = the whole "database")
// ---------------------------------------------------------------------------
function readContent() {
  return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
}

function writeContent(data) {
  // Basic shape check so a malformed save can't corrupt the file the public
  // site depends on.
  const required = ['theme', 'name', 'role', 'tagline', 'status', 'about', 'projects', 'resume', 'education', 'contact', 'footerNote', 'customSections', 'testimonials'];
  for (const key of required) {
    if (!(key in data)) throw new Error(`Missing required field: ${key}`);
  }
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Needed so secure cookies work correctly behind a host's HTTPS proxy
// (Render, Railway, Fly, etc.) once NODE_ENV=production is set.
app.set('trust proxy', 1);

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  return res.redirect('/admin/login.html');
}

// ---------------------------------------------------------------------------
// Public site + public content API
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/content', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(readContent());
  } catch (err) {
    res.status(500).json({ error: 'Could not load content' });
  }
});

// ---------------------------------------------------------------------------
// Admin auth
// ---------------------------------------------------------------------------
// Constant-time string comparison so login checks don't leak timing info
// about how much of the username/password was correct.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison (against itself) so this branch takes
    // roughly the same time as a length-matched one.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const validCreds =
    typeof username === 'string' &&
    typeof password === 'string' &&
    safeEqual(username, ADMIN_USERNAME) &&
    safeEqual(password, ADMIN_PASSWORD);

  if (!validCreds) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  if (ADMIN_TOTP_SECRET) {
    // Credentials check out, but 2FA is enabled — don't grant access yet.
    req.session.pendingAdmin = true;
    req.session.isAdmin = false;
    return res.json({ ok: true, requires2FA: true });
  }

  req.session.isAdmin = true;
  res.json({ ok: true, requires2FA: false });
});

app.post('/api/admin/verify-2fa', (req, res) => {
  if (!req.session.pendingAdmin) {
    return res.status(401).json({ error: 'Log in with your username and password first' });
  }
  const { code } = req.body || {};
  let valid = false;
  try {
    valid =
      typeof code === 'string' &&
      !!ADMIN_TOTP_SECRET &&
      authenticator.check(code.replace(/\s+/g, ''), ADMIN_TOTP_SECRET);
  } catch (err) {
    valid = false;
  }

  if (!valid) {
    return res.status(401).json({ error: 'Incorrect or expired code' });
  }

  req.session.pendingAdmin = false;
  req.session.isAdmin = true;
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Admin panel page + its assets
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});
// no-store here so admin CSS/JS updates always take effect on refresh,
// with no risk of the browser serving a stale cached copy while iterating.
app.use('/admin/assets', express.static(path.join(__dirname, 'admin', 'assets'), {
  setHeaders: (res) => res.set('Cache-Control', 'no-store'),
}));

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'panel.html'));
});

// ---------------------------------------------------------------------------
// Admin content API (all require auth)
// ---------------------------------------------------------------------------
app.get('/api/admin/content', requireAuth, (req, res) => {
  try {
    res.json(readContent());
  } catch (err) {
    res.status(500).json({ error: 'Could not load content' });
  }
});

app.post('/api/admin/content', requireAuth, (req, res) => {
  try {
    writeContent(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// File uploads (photo + resume PDF + per-project image/video)
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov'];

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  // No size limit — you asked for unrestricted video uploads. Be aware this
  // means a very large file will use a lot of disk space and take a while
  // to upload; there's nothing here stopping that.
  fileFilter: (req, file, cb) => {
    const kind = req.query.kind;
    const ext = path.extname(file.originalname).toLowerCase();
    if (kind === 'resume') {
      if (ext !== '.pdf') return cb(new Error('Résumé must be a PDF file'));
    } else if (kind === 'media') {
      if (![...IMAGE_EXTS, ...VIDEO_EXTS].includes(ext)) {
        return cb(new Error('Project media must be a JPG, PNG, WEBP, MP4, WEBM, or MOV file'));
      }
    } else {
      if (!IMAGE_EXTS.includes(ext)) return cb(new Error('Photo must be a JPG, PNG, or WEBP file'));
    }
    cb(null, true);
  },
});

app.post('/api/admin/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const ext = path.extname(req.file.filename).toLowerCase();
    const mediaType = VIDEO_EXTS.includes(ext) ? 'video' : 'image';
    res.json({ url: `/uploads/${req.file.filename}`, mediaType });
  });
});

// Best-effort résumé autofill: reads a previously-uploaded PDF and pulls out
// a draft summary/skills/experience for the admin panel to review.
app.post('/api/admin/parse-resume', requireAuth, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== 'string' || !/^\/uploads\/[\w.-]+\.pdf$/i.test(url)) {
      return res.status(400).json({ error: 'Invalid file reference' });
    }
    const filePath = path.resolve(path.join(__dirname, 'public', url));
    if (!filePath.startsWith(UPLOADS_DIR) || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'File not found' });
    }
    const buffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(buffer);
    if (!parsed.text || !parsed.text.trim()) {
      return res.status(422).json({ error: 'No readable text found in that PDF — it may be a scanned image rather than real text.' });
    }
    res.json({ draft: parseResumeText(parsed.text) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not read that PDF.' });
  }
});

// ---------------------------------------------------------------------------
// Static export — bakes the currently-SAVED content directly into a copy of
// the public site (no server, no /api calls at runtime) so it can be
// dropped onto Netlify, Vercel, GitHub Pages, or any other static host.
// This always exports what's on disk, i.e. your last "Save changes" — not
// whatever's sitting unsaved in the admin form.
const EXPORT_README = `# Static export of your portfolio

This is a self-contained snapshot — plain HTML/CSS/JS, no server, no
database, no admin panel. It reflects whatever was saved at the moment you
exported it; editing it again means going back to the admin panel, making
changes, saving, and exporting a fresh copy.

## Deploying

Any static host works, since this is just files:

- **Netlify**: drag this whole folder onto app.netlify.com/drop, or connect
  a repo containing it and set the publish directory to this folder.
- **Vercel**: \`vercel deploy\` from inside this folder, or drag-and-drop
  via the dashboard the same way as Netlify.
- **GitHub Pages**: push this folder's contents to a repo (or a \`docs/\`
  folder / \`gh-pages\` branch) and enable Pages in the repo's settings.
- **Anywhere else**: any host that serves static files works — there's
  nothing here that needs Node.js or a database.

## What's included

- \`index.html\`, \`style.css\`, \`script.js\` — the site itself, with your
  content already embedded in \`index.html\`
- \`uploads/\` — your photo, résumé PDF, and any project images/videos

## The contact form

It still works the same way it does on the live site: it opens the
visitor's email client with the message pre-filled. Nothing to configure.
`;

app.get('/api/admin/export', requireAuth, (req, res) => {
  try {
    const content = readContent();

    let indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    const embed = `<script>window.__PORTFOLIO_CONTENT__ = ${JSON.stringify(content)};</script>\n`;
    if (!indexHtml.includes('<script src="script.js"></script>')) {
      throw new Error('Could not find the script tag to embed content next to — public/index.html may have changed.');
    }
    indexHtml = indexHtml.replace('<script src="script.js"></script>', `${embed}<script src="script.js"></script>`);

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename="portfolio-static-export.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).end();
    });
    archive.pipe(res);

    archive.append(indexHtml, { name: 'index.html' });
    archive.file(path.join(__dirname, 'public', 'style.css'), { name: 'style.css' });
    archive.file(path.join(__dirname, 'public', 'script.js'), { name: 'script.js' });
    archive.append(EXPORT_README, { name: 'README.md' });
    if (fs.existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, 'uploads');
    }

    archive.finalize();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
  }
});

// ---------------------------------------------------------------------------
app.listen(PORT, HOST, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
  console.log(`Admin panel at      http://localhost:${PORT}/admin`);
});
