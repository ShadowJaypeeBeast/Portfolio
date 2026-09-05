// ---------------------------------------------------------------------------
// Theme (dark by default, with a toggle that remembers your choice)
// ---------------------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.textContent = theme === 'dark' ? '☀' : '☾';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  });
}

function initTheme() {
  applyTheme(localStorage.getItem('theme') || 'dark');
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  });
}

function createStarfield(count = 110) {
  const field = document.getElementById('starfield');
  if (!field) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    const size = (Math.random() * 1.6 + 0.7).toFixed(2);
    const duration = (Math.random() * 3.5 + 2).toFixed(2);
    star.style.top = `${(Math.random() * 100).toFixed(2)}%`;
    star.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.animationDuration = `${duration}s`;
    // Negative delay staggers each star mid-cycle so they don't pulse in sync.
    star.style.animationDelay = `-${(Math.random() * duration).toFixed(2)}s`;
    star.style.setProperty('--peak', (Math.random() * 0.5 + 0.5).toFixed(2));
    frag.appendChild(star);
  }
  field.appendChild(frag);
}

createStarfield();

// ---------------------------------------------------------------------------
// Particle background — an alternative to the starfield: drifting dots on
// a canvas that gently move away from the cursor. Only runs when selected,
// and respects prefers-reduced-motion.
// ---------------------------------------------------------------------------
let particlesCanvas = null;
let particlesCtx = null;
let particlesArr = [];
let particlesMouse = { x: -9999, y: -9999 };
let particlesRAF = null;
let particlesReady = false;

function initParticlesOnce() {
  if (particlesReady) return;
  particlesCanvas = document.getElementById('bg-canvas');
  if (!particlesCanvas) return;
  particlesCtx = particlesCanvas.getContext('2d');

  const resize = () => {
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 70; i++) {
    particlesArr.push({
      x: Math.random() * particlesCanvas.width,
      y: Math.random() * particlesCanvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.6 + 0.8,
    });
  }

  window.addEventListener('mousemove', (e) => {
    particlesMouse.x = e.clientX;
    particlesMouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    particlesMouse.x = -9999;
    particlesMouse.y = -9999;
  });

  particlesReady = true;
}

function particlesTick() {
  if (!particlesCtx || !particlesCanvas) return;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#ffffff';

  particlesCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
  particlesArr.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > particlesCanvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > particlesCanvas.height) p.vy *= -1;

    const dx = p.x - particlesMouse.x;
    const dy = p.y - particlesMouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dist < 110) {
      const force = (110 - dist) / 110;
      p.x += (dx / dist) * force * 2;
      p.y += (dy / dist) * force * 2;
    }

    particlesCtx.beginPath();
    particlesCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    particlesCtx.fillStyle = color;
    particlesCtx.globalAlpha = 0.4;
    particlesCtx.fill();
  });
  particlesCtx.globalAlpha = 1;
  particlesRAF = requestAnimationFrame(particlesTick);
}

function setParticlesActive(active) {
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (active && !prefersReducedMotion) {
    initParticlesOnce();
    if (!particlesRAF) particlesTick();
  } else if (particlesRAF) {
    cancelAnimationFrame(particlesRAF);
    particlesRAF = null;
    if (particlesCtx && particlesCanvas) particlesCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
  }
}

// ---------------------------------------------------------------------------
// Sidebar layout's mobile open/close (no-ops harmlessly when the sidebar
// layout isn't selected, since the button stays hidden by CSS then).
// ---------------------------------------------------------------------------
function openSidebar() {
  document.getElementById('sidebar-nav')?.classList.add('is-open');
  document.getElementById('sidebar-backdrop')?.classList.add('is-open');
}
function closeSidebar() {
  document.getElementById('sidebar-nav')?.classList.remove('is-open');
  document.getElementById('sidebar-backdrop')?.classList.remove('is-open');
}
document.getElementById('sidebar-toggle')?.addEventListener('click', openSidebar);
document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebar);
// Delegated (rather than attached per-link) so it still works for custom
// section links added to the sidebar later, after this runs once at load.
document.getElementById('sidebar-nav')?.addEventListener('click', (e) => {
  if (e.target.closest('.sidebar-nav__links a')) closeSidebar();
});

initTheme();

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text) node.textContent = opts.text;
  if (opts.html) node.innerHTML = opts.html;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  }
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

// Simple single-color (currentColor) icon glyphs for the contact links list.
// Best-effort recreations of commonly recognized marks, not official brand
// assets — swap the path data here if you want something more precise.
const CONTACT_ICONS = {
  github:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.744.083-.729.083-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.807 1.305 3.492.997.108-.775.42-1.305.763-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.467-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.435.375.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.23 0H1.77C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.77 24h20.46c.978 0 1.77-.773 1.77-1.729V1.729C24 .774 23.208 0 22.23 0zM7.121 20.452H3.561V9.011h3.56v11.441zM5.341 7.443a2.062 2.062 0 110-4.124 2.062 2.062 0 010 4.124zM20.452 20.452h-3.56v-5.568c0-1.328-.024-3.037-1.85-3.037-1.853 0-2.137 1.447-2.137 2.94v5.665h-3.56V9.011h3.418v1.561h.049c.477-.9 1.637-1.85 3.37-1.85 3.602 0 4.27 2.372 4.27 5.455v6.275z"/></svg>',
  twitter:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.204-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.354.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.667-.014 4.947-.072 4.354-.2 6.782-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838a6.163 6.163 0 100 12.326 6.163 6.163 0 000-12.326zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
  youtube:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a2.994 2.994 0 00-2.112-2.12C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.386.521A2.994 2.994 0 00.502 6.186 31.65 31.65 0 000 12a31.65 31.65 0 00.502 5.814 2.994 2.994 0 002.112 2.12c1.881.521 9.386.521 9.386.521s7.505 0 9.386-.521a2.994 2.994 0 002.112-2.12A31.65 31.65 0 0024 12a31.65 31.65 0 00-.502-5.814zM9.75 15.568V8.432L15.818 12z"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 5.5A1.5 1.5 0 013.5 4h17A1.5 1.5 0 0122 5.5v13a1.5 1.5 0 01-1.5 1.5h-17A1.5 1.5 0 012 18.5v-13zm2.2.2 7.8 5.85 7.8-5.85H4.2zM20 7.35l-7.4 5.55a1 1 0 01-1.2 0L4 7.35V18h16V7.35z"/></svg>',
  website:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm6.93 6h-2.95a15.65 15.65 0 00-1.38-4.44A8.03 8.03 0 0118.93 8zM12 4.07C13 5.16 14.34 7.14 14.73 10H9.27C9.66 7.14 11 5.16 12 4.07zM4.26 14a8.14 8.14 0 010-4h3.24a17.9 17.9 0 000 4zm.81 2h2.95a15.65 15.65 0 001.38 4.44A8.03 8.03 0 015.07 16zm2.95-8H5.07a8.03 8.03 0 014.33-4.44A15.65 15.65 0 007.02 8zM9.27 14h5.46c-.39 2.86-1.73 4.84-2.73 5.93-1-1.09-2.34-3.07-2.73-5.93zm7.31 6.44A15.65 15.65 0 0018 16h2.93a8.03 8.03 0 01-4.35 4.44zM16.5 14a17.9 17.9 0 000-4h3.24a8.14 8.14 0 010 4z"/></svg>',
};

let skillBarObserver = null;
function observeSkillBars() {
  if (skillBarObserver) skillBarObserver.disconnect();
  const bars = document.querySelectorAll('.skill-bar');
  if (!bars.length) return;
  skillBarObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          skillBarObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  bars.forEach((bar) => skillBarObserver.observe(bar));
}

function renderHero(content) {
  document.getElementById('nav-name').textContent = content.name;
  document.getElementById('hero-role').textContent = content.role;
  document.getElementById('hero-name').textContent = content.name;
  document.getElementById('hero-tagline').textContent = content.tagline;
  document.getElementById('hero-status').textContent = content.status;
  document.title = `${content.name} — ${content.role}`;

  const sidebarName = document.getElementById('sidebar-name');
  const sidebarRole = document.getElementById('sidebar-role');
  if (sidebarName) sidebarName.textContent = content.name;
  if (sidebarRole) sidebarRole.textContent = content.role;
}

function renderAbout(content) {
  const section = document.getElementById('about');
  const navItem = document.getElementById('nav-item-about');
  const sidebarNavItem = document.getElementById('sidebar-nav-item-about');
  section.hidden = false;
  if (navItem) navItem.hidden = false;
  if (sidebarNavItem) sidebarNavItem.hidden = false;

  if (content.aboutVisible === false) {
    section.hidden = true;
    if (navItem) navItem.hidden = true;
    if (sidebarNavItem) sidebarNavItem.hidden = true;
    return;
  }

  const paras = document.getElementById('about-paragraphs');
  paras.innerHTML = '';
  content.about.paragraphs.forEach((p) => paras.appendChild(el('p', { text: p })));

  // Uses a background-image on a persistent element (rather than swapping
  // in an <img>) so this function can safely be re-run for live preview.
  const photoClass = `about__photo--size-${content.about.photoSize || 'medium'} about__photo--shape-${content.about.photoShape || 'rounded'}`;
  const photoEl = document.getElementById('about-photo');
  const heroPhotoEl = document.getElementById('hero-photo');
  photoEl.className = `about__photo ${photoClass}`;
  if (heroPhotoEl) heroPhotoEl.className = `hero__photo about__photo ${photoClass}`;
  const sidebarPhotoEl = document.getElementById('sidebar-photo');

  document.documentElement.setAttribute('data-photo-placement', content.about.photoPlacement || 'about');

  [photoEl, heroPhotoEl, sidebarPhotoEl].forEach((elm) => {
    if (!elm) return;
    if (content.about.photoUrl) {
      elm.style.backgroundImage = `url("${content.about.photoUrl}")`;
      elm.style.backgroundSize = 'cover';
      elm.style.backgroundPosition = 'center';
      elm.textContent = '';
      elm.setAttribute('role', 'img');
      elm.setAttribute('aria-label', content.name || 'Profile photo');
    } else {
      elm.style.backgroundImage = '';
      elm.textContent = content.about.photoLabel || '';
      elm.removeAttribute('role');
      elm.removeAttribute('aria-label');
    }
  });

  document.getElementById('about-skills').textContent = content.about.skills.join(' / ');

  document.documentElement.setAttribute('data-skills-display', content.about.skillsDisplay || 'text');
  const barsWrap = document.getElementById('about-skill-bars');
  barsWrap.innerHTML = '';
  (content.about.skillBars || []).forEach((s) => {
    const level = Math.max(0, Math.min(100, Number(s.level) || 0));
    const bar = el('div', { class: 'skill-bar' }, [
      el('div', { class: 'skill-bar__head' }, [
        el('span', { class: 'skill-bar__name', text: s.name }),
        el('span', { class: 'skill-bar__value', text: `${level}%` }),
      ]),
      el('div', { class: 'skill-bar__track' }, [el('div', { class: 'skill-bar__fill' })]),
    ]);
    bar.style.setProperty('--level', `${level}%`);
    barsWrap.appendChild(bar);
  });
  observeSkillBars();
}

function renderProjects(content) {
  const section = document.getElementById('projects');
  const navItem = document.getElementById('nav-item-projects');
  const sidebarNavItem = document.getElementById('sidebar-nav-item-projects');
  section.hidden = false;
  if (navItem) navItem.hidden = false;
  if (sidebarNavItem) sidebarNavItem.hidden = false;

  if (content.projectsVisible === false) {
    section.hidden = true;
    if (navItem) navItem.hidden = true;
    if (sidebarNavItem) sidebarNavItem.hidden = true;
    return;
  }

  const list = document.getElementById('projects-list');
  list.innerHTML = '';
  document.getElementById('projects-count').textContent = String(content.projects.length).padStart(2, '0');

  content.projects.forEach((p) => {
    const titleNode = p.link
      ? el('a', { text: p.title, attrs: { href: p.link, target: '_blank', rel: 'noopener' } })
      : el('span', { text: p.title });

    const tags = el('div', { class: 'project__tags' }, (p.tags || []).map((t) => el('span', { text: t })));

    let mediaEl = null;
    if (p.mediaUrl) {
      const inner =
        p.mediaType === 'video'
          ? el('video', { attrs: { src: p.mediaUrl, controls: '', muted: '', playsinline: '', preload: 'metadata' } })
          : el('img', { attrs: { src: p.mediaUrl, alt: p.title || '', loading: 'lazy' } });
      mediaEl = el('div', { class: 'project__media' }, [inner]);
    }

    const row = el('div', { class: 'project' }, [
      el('div', { class: 'project__year', text: p.year || '' }),
      el('div', {}, [
        el('h3', { class: 'project__title' }, [titleNode]),
        mediaEl,
        el('p', { class: 'project__desc', text: p.description }),
        tags,
      ]),
      p.link
        ? el('div', { class: 'project__link' }, [el('a', { text: 'View ↗', attrs: { href: p.link, target: '_blank', rel: 'noopener' } })])
        : el('div'),
    ]);
    list.appendChild(row);
  });
}

function renderResume(content) {
  const section = document.getElementById('resume');
  const navItem = document.getElementById('nav-item-resume');
  const sidebarNavItem = document.getElementById('sidebar-nav-item-resume');
  section.hidden = false;
  if (navItem) navItem.hidden = false;
  if (sidebarNavItem) sidebarNavItem.hidden = false;

  if (content.resumeVisible === false) {
    section.hidden = true;
    if (navItem) navItem.hidden = true;
    if (sidebarNavItem) sidebarNavItem.hidden = true;
    return;
  }

  const wrap = document.getElementById('resume-download-wrap');
  wrap.innerHTML = '';
  if (content.resume.pdfUrl && content.resume.pdfVisible !== false) {
    wrap.appendChild(el('a', { text: 'Download full résumé (PDF) ↗', attrs: { href: content.resume.pdfUrl, target: '_blank', rel: 'noopener' } }));
  }

  const timeline = document.getElementById('resume-timeline');
  timeline.innerHTML = '';
  content.resume.experience.forEach((job) => {
    const roleLine = el('p', { class: 'timeline-row__role' }, [document.createTextNode(job.role + ' ')]);
    if (job.org) roleLine.appendChild(el('span', { class: 'timeline-row__org', text: `— ${job.org}` }));

    timeline.appendChild(
      el('div', { class: 'timeline-row' }, [
        el('div', { class: 'timeline-row__period', text: job.period }),
        el('div', {}, [roleLine, el('p', { class: 'timeline-row__summary', text: job.summary })]),
      ])
    );
  });
}

function renderEducation(content) {
  const section = document.getElementById('education');
  const navItem = document.getElementById('nav-item-education');
  const sidebarNavItem = document.getElementById('sidebar-nav-item-education');
  section.hidden = false;
  if (navItem) navItem.hidden = false;
  if (sidebarNavItem) sidebarNavItem.hidden = false;

  if (content.educationVisible === false || !content.education || !content.education.length) {
    section.hidden = true;
    if (navItem) navItem.hidden = true;
    if (sidebarNavItem) sidebarNavItem.hidden = true;
    return;
  }

  const timeline = document.getElementById('education-timeline');
  timeline.innerHTML = '';
  content.education.forEach((entry) => {
    const degreeLine = el('p', { class: 'timeline-row__role' }, [document.createTextNode(entry.degree + ' ')]);
    if (entry.school) degreeLine.appendChild(el('span', { class: 'timeline-row__org', text: `— ${entry.school}` }));

    const children = [degreeLine];
    if (entry.summary) children.push(el('p', { class: 'timeline-row__summary', text: entry.summary }));

    timeline.appendChild(
      el('div', { class: 'timeline-row' }, [
        el('div', { class: 'timeline-row__period', text: entry.period || '' }),
        el('div', {}, children),
      ])
    );
  });
}

function renderTestimonials(content) {
  const section = document.getElementById('testimonials');
  const navItem = document.getElementById('nav-item-testimonials');
  const sidebarNavItem = document.getElementById('sidebar-nav-item-testimonials');
  section.hidden = false;
  if (navItem) navItem.hidden = false;
  if (sidebarNavItem) sidebarNavItem.hidden = false;

  if (content.testimonialsVisible === false || !content.testimonials || !content.testimonials.length) {
    section.hidden = true;
    if (navItem) navItem.hidden = true;
    if (sidebarNavItem) sidebarNavItem.hidden = true;
    return;
  }

  const list = document.getElementById('testimonials-list');
  list.innerHTML = '';
  content.testimonials.forEach((t) => {
    list.appendChild(
      el('div', { class: 'testimonial' }, [
        el('p', { class: 'testimonial__quote', text: t.quote }),
        el('p', {}, [
          el('span', { class: 'testimonial__name', text: t.name }),
          t.role ? document.createTextNode(' — ') : null,
          t.role ? el('span', { class: 'testimonial__role', text: t.role }) : null,
        ]),
      ])
    );
  });
}

function renderCustomSections(content) {
  // Custom sections don't have fixed spots in index.html — they're inserted
  // (and, on re-render, first removed and re-inserted) just before the
  // Contact section and its nav link, using those as stable anchors. This
  // mirrors the link into both the top nav and the sidebar nav, since only
  // one of the two is visible depending on the chosen layout.
  document.querySelectorAll('[data-custom-section]').forEach((n) => n.remove());
  document.querySelectorAll('[data-custom-nav]').forEach((n) => n.remove());

  const contactSection = document.getElementById('contact');
  const contactNavItem = document.getElementById('nav-item-contact');
  const sidebarContactNavItem = document.getElementById('sidebar-nav-item-contact');
  if (!contactSection || !contactNavItem) return;

  (content.customSections || []).forEach((sec) => {
    if (sec.visible === false) return;
    const anchorId = `custom-${sec.id}`;

    contactNavItem.before(
      el('li', { attrs: { 'data-custom-nav': '1' } }, [el('a', { text: sec.title || 'Section', attrs: { href: `#${anchorId}` } })])
    );
    if (sidebarContactNavItem) {
      sidebarContactNavItem.before(
        el('li', { attrs: { 'data-custom-nav': '1' } }, [el('a', { text: sec.title || 'Section', attrs: { href: `#${anchorId}` } })])
      );
    }

    const bodyChildren = [];

    (sec.media || []).forEach((m) => {
      if (!m.mediaUrl) return;
      const inner =
        m.mediaType === 'video'
          ? el('video', { attrs: { src: m.mediaUrl, controls: '', muted: '', playsinline: '', preload: 'metadata' } })
          : el('img', { attrs: { src: m.mediaUrl, alt: sec.title || '', loading: 'lazy' } });
      bodyChildren.push(el('div', { class: 'custom-section__media' }, [inner]));
      if (m.caption) bodyChildren.push(el('p', { class: 'custom-section__caption', text: m.caption }));
    });

    (sec.body || '')
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((p) => bodyChildren.push(el('p', { text: p })));

    (sec.items || []).forEach((it) => {
      if (!it.title && !it.description) return;
      bodyChildren.push(
        el('div', { class: 'custom-section__item' }, [
          el('p', { class: 'custom-section__item-title', text: it.title }),
          it.description ? el('p', { class: 'custom-section__item-desc', text: it.description }) : null,
        ])
      );
    });

    const sectionEl = el('section', { class: 'wrap', attrs: { id: anchorId, 'data-custom-section': '1' } }, [
      el('div', { class: 'section__head' }, [el('h2', { class: 'section__title', text: sec.title || 'Section' })]),
      el('div', { class: 'custom-section__body' }, bodyChildren),
    ]);
    contactSection.before(sectionEl);
  });
}

function renderContact(content) {
  const emailLink = document.getElementById('contact-email');
  emailLink.textContent = content.contact.email;
  emailLink.href = `mailto:${content.contact.email}`;

  const linksList = document.getElementById('contact-links');
  linksList.innerHTML = '';
  content.contact.links.forEach((l) => {
    const iconSvg = CONTACT_ICONS[l.icon];
    const linkChildren = [];
    if (iconSvg) linkChildren.push(el('span', { class: 'contact__link-icon', html: iconSvg }));
    linkChildren.push(el('span', { class: 'contact__link-text', text: l.label }));
    linksList.appendChild(
      el('li', {}, [el('a', { attrs: { href: l.url, target: '_blank', rel: 'noopener' } }, linkChildren)])
    );
  });

  document.getElementById('footer-note').textContent = content.footerNote;
  document.getElementById('footer-year').textContent = content.copyrightYear || new Date().getFullYear();
  document.getElementById('footer-copyright-holder').textContent = content.copyrightHolder || content.name || '';
}

// currentContent is read by the contact form's submit handler (attached
// once) so it always mails to the *latest* address, even after a live
// preview update changes it without a page reload.
let currentContent = null;

// Set once a live-preview message has taken over rendering, so this page's
// own (slower) initial fetch doesn't later overwrite it with stale saved
// content if both happen to resolve around the same time.
let previewActive = false;

function handleContactForm() {
  const form = document.getElementById('contact-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentContent) return;
    const name = form.elements['name'].value.trim();
    const message = form.elements['message'].value.trim();
    const replyTo = form.elements['email'].value.trim();
    const subject = encodeURIComponent(`Portfolio contact from ${name || 'your site'}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${replyTo})`);
    window.location.href = `mailto:${currentContent.contact.email}?subject=${subject}&body=${body}`;
  });
}

function renderAll(content) {
  currentContent = content;
  document.documentElement.setAttribute('data-portfolio-theme', content.theme || 'ledger');
  document.documentElement.setAttribute('data-font', content.font || 'theme');
  document.documentElement.setAttribute('data-layout', content.layout || 'topnav');
  document.documentElement.setAttribute('data-bg-effect', content.backgroundEffect || 'starfield');
  setParticlesActive((content.backgroundEffect || 'starfield') === 'particles');
  renderHero(content);
  renderAbout(content);
  renderProjects(content);
  renderTestimonials(content);
  renderResume(content);
  renderEducation(content);
  renderCustomSections(content);
  renderContact(content);
}

async function init() {
  try {
    // A statically-exported copy of this site embeds its content directly
    // (see server.js's /api/admin/export) so it needs no server at all —
    // this checks for that before falling back to the live API fetch.
    let content = window.__PORTFOLIO_CONTENT__;
    if (!content) {
      const res = await fetch('/api/content', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load content');
      content = await res.json();
    }
    if (!previewActive) renderAll(content);
    handleContactForm();
  } catch (err) {
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif;">Could not load site content. Is the server running?</p>';
    console.error(err);
  }
}

// Live preview: the admin panel embeds this page in an iframe and posts
// the in-progress (unsaved) content object here as the person edits.
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== 'portfolio-preview' || !event.data.content) return;
  previewActive = true;
  renderAll(event.data.content);
});

init();
