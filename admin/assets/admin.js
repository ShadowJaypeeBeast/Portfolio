let state = null; // holds the full content object while editing

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('toast--error', isError);
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2600);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
async function loadContent() {
  const res = await fetch('/api/admin/content');
  if (res.status === 401) return (window.location.href = '/admin/login.html');
  state = await res.json();
  populateForm();
}

function populateForm() {
  document.getElementById('f-theme').value = state.theme || 'ledger';
  document.getElementById('f-font').value = state.font || 'theme';
  document.getElementById('f-layout').value = state.layout || 'topnav';
  document.getElementById('f-bg-effect').value = state.backgroundEffect || 'starfield';
  document.getElementById('f-name').value = state.name || '';
  document.getElementById('f-role').value = state.role || '';
  document.getElementById('f-tagline').value = state.tagline || '';
  document.getElementById('f-status').value = state.status || '';

  document.getElementById('f-about-visible').checked = state.aboutVisible !== false;
  document.getElementById('f-about-paragraphs').value = (state.about.paragraphs || []).join('\n');
  document.getElementById('f-skills').value = (state.about.skills || []).join(', ');
  document.getElementById('f-skills-display').value = state.about.skillsDisplay || 'text';
  document.getElementById('f-photo-label').value = state.about.photoLabel || '';
  document.getElementById('f-photo-size').value = state.about.photoSize || 'medium';
  document.getElementById('f-photo-shape').value = state.about.photoShape || 'rounded';
  document.getElementById('f-photo-placement').value = state.about.photoPlacement || 'about';
  updatePhotoPreview();
  if (!state.about.skillBars) state.about.skillBars = [];
  renderRepeatingList('skill-bars-editor', 'skill-bar-row-template', state.about.skillBars, fillSkillBarRow);

  renderRepeatingList('projects-editor', 'project-row-template', state.projects, fillProjectRow);
  document.getElementById('f-projects-visible').checked = state.projectsVisible !== false;

  if (!state.testimonials) state.testimonials = [];
  document.getElementById('f-testimonials-visible').checked = state.testimonialsVisible !== false;
  renderRepeatingList('testimonials-editor', 'testimonial-row-template', state.testimonials, fillTestimonialRow);

  document.getElementById('f-resume-section-visible').checked = state.resumeVisible !== false;
  renderRepeatingList('experience-editor', 'experience-row-template', state.resume.experience, fillExperienceRow);

  document.getElementById('f-education-visible').checked = state.educationVisible !== false;
  renderRepeatingList('education-editor', 'education-row-template', state.education, fillEducationRow);

  renderRepeatingList('links-editor', 'link-row-template', state.contact.links, fillLinkRow);
  renderRepeatingList('custom-sections-editor', 'custom-section-row-template', state.customSections, fillCustomSectionRow);

  document.getElementById('f-email').value = state.contact.email || '';
  document.getElementById('f-footer').value = state.footerNote || '';
  document.getElementById('f-copyright-year').value = state.copyrightYear || '';
  document.getElementById('f-copyright-holder').value = state.copyrightHolder || '';
  updateResumePreview();
}

function updatePhotoPreview() {
  const img = document.getElementById('photo-preview');
  const empty = document.getElementById('photo-preview-empty');
  if (state.about.photoUrl) {
    img.src = state.about.photoUrl;
    img.hidden = false;
    empty.hidden = true;
  } else {
    img.hidden = true;
    empty.hidden = false;
  }
}

function updateResumePreview() {
  const label = document.getElementById('resume-pdf-name');
  label.textContent = state.resume.pdfUrl ? state.resume.pdfUrl.split('/').pop() : 'No file uploaded';
  document.getElementById('f-resume-visible').checked = state.resume.pdfVisible !== false;
  document.getElementById('parse-resume-btn').hidden = !state.resume.pdfUrl;
}

// ---------------------------------------------------------------------------
// Repeating row helpers (projects / experience / links)
// ---------------------------------------------------------------------------
function renderRepeatingList(containerId, templateId, items, fillFn) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach((item) => container.appendChild(buildRow(templateId, item, fillFn, items)));
}

// Same idea as renderRepeatingList, but takes an element directly rather
// than a global container ID — needed for lists nested inside a repeating
// row (e.g. a custom section's items), where the container isn't unique
// by ID since there can be many such rows on the page.
function renderNestedList(containerEl, templateId, items, fillFn) {
  containerEl.innerHTML = '';
  items.forEach((item) => containerEl.appendChild(buildRow(templateId, item, fillFn, items)));
}

function buildRow(templateId, item, fillFn, itemsArrayRef) {
  const template = document.getElementById(templateId);
  const node = template.content.firstElementChild.cloneNode(true);
  fillFn(node, item);

  // :scope restricts this to buttons in *this* row's own actions bar, not
  // any nested repeating list's buttons (e.g. a custom section's items) —
  // without it, a nested row's remove button would also re-trigger this
  // row's own remove/reorder logic, since querySelectorAll matches all
  // descendants regardless of nesting depth.
  node.querySelectorAll(':scope > .repeat-row__actions [data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const idx = itemsArrayRef.indexOf(item);
      if (action === 'remove') {
        itemsArrayRef.splice(idx, 1);
        node.remove();
      } else if (action === 'up' && idx > 0) {
        [itemsArrayRef[idx - 1], itemsArrayRef[idx]] = [itemsArrayRef[idx], itemsArrayRef[idx - 1]];
        node.previousElementSibling.before(node);
      } else if (action === 'down' && idx < itemsArrayRef.length - 1) {
        [itemsArrayRef[idx + 1], itemsArrayRef[idx]] = [itemsArrayRef[idx], itemsArrayRef[idx + 1]];
        node.nextElementSibling.after(node);
      }
      schedulePreviewUpdate();
    });
  });

  return node;
}

function renderProjectMediaPreview(node, item) {
  const preview = node.querySelector('[data-media-preview]');
  preview.innerHTML = '';
  if (item.mediaUrl) {
    const mediaEl = document.createElement(item.mediaType === 'video' ? 'video' : 'img');
    mediaEl.src = item.mediaUrl;
    if (item.mediaType === 'video') {
      mediaEl.muted = true;
      mediaEl.playsInline = true;
    } else {
      mediaEl.alt = '';
    }
    preview.appendChild(mediaEl);
  } else {
    const empty = document.createElement('span');
    empty.className = 'project-media-preview__empty';
    empty.textContent = 'No media';
    preview.appendChild(empty);
  }
}

function fillProjectRow(node, item) {
  node.querySelector('[data-field="title"]').value = item.title || '';
  node.querySelector('[data-field="year"]').value = item.year || '';
  node.querySelector('[data-field="description"]').value = item.description || '';
  node.querySelector('[data-field="tags"]').value = (item.tags || []).join(', ');
  node.querySelector('[data-field="link"]').value = item.link || '';

  node.addEventListener('input', () => {
    item.title = node.querySelector('[data-field="title"]').value;
    item.year = node.querySelector('[data-field="year"]').value;
    item.description = node.querySelector('[data-field="description"]').value;
    item.tags = node.querySelector('[data-field="tags"]').value.split(',').map((s) => s.trim()).filter(Boolean);
    item.link = node.querySelector('[data-field="link"]').value;
  });

  renderProjectMediaPreview(node, item);
  const mediaInput = node.querySelector('[data-media-input]');
  node.querySelector('[data-media-action="upload"]').addEventListener('click', () => mediaInput.click());
  mediaInput.addEventListener('change', async () => {
    const file = mediaInput.files[0];
    if (!file) return;
    try {
      const result = await uploadFile(file, 'media');
      item.mediaUrl = result.url;
      item.mediaType = result.mediaType;
      renderProjectMediaPreview(node, item);
      schedulePreviewUpdate();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      mediaInput.value = '';
    }
  });
  node.querySelector('[data-media-action="remove"]').addEventListener('click', () => {
    item.mediaUrl = '';
    item.mediaType = '';
    renderProjectMediaPreview(node, item);
    schedulePreviewUpdate();
  });
}

function fillExperienceRow(node, item) {
  node.querySelector('[data-field="role"]').value = item.role || '';
  node.querySelector('[data-field="org"]').value = item.org || '';
  node.querySelector('[data-field="period"]').value = item.period || '';
  node.querySelector('[data-field="summary"]').value = item.summary || '';

  node.addEventListener('input', () => {
    item.role = node.querySelector('[data-field="role"]').value;
    item.org = node.querySelector('[data-field="org"]').value;
    item.period = node.querySelector('[data-field="period"]').value;
    item.summary = node.querySelector('[data-field="summary"]').value;
  });
}

function fillEducationRow(node, item) {
  node.querySelector('[data-field="degree"]').value = item.degree || '';
  node.querySelector('[data-field="school"]').value = item.school || '';
  node.querySelector('[data-field="period"]').value = item.period || '';
  node.querySelector('[data-field="summary"]').value = item.summary || '';

  node.addEventListener('input', () => {
    item.degree = node.querySelector('[data-field="degree"]').value;
    item.school = node.querySelector('[data-field="school"]').value;
    item.period = node.querySelector('[data-field="period"]').value;
    item.summary = node.querySelector('[data-field="summary"]').value;
  });
}

function fillSkillBarRow(node, item) {
  node.querySelector('[data-field="name"]').value = item.name || '';
  node.querySelector('[data-field="level"]').value = item.level != null ? item.level : 70;

  node.addEventListener('input', () => {
    item.name = node.querySelector('[data-field="name"]').value;
    const raw = Number(node.querySelector('[data-field="level"]').value);
    item.level = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  });
}

function fillTestimonialRow(node, item) {
  node.querySelector('[data-field="quote"]').value = item.quote || '';
  node.querySelector('[data-field="name"]').value = item.name || '';
  node.querySelector('[data-field="role"]').value = item.role || '';

  node.addEventListener('input', () => {
    item.quote = node.querySelector('[data-field="quote"]').value;
    item.name = node.querySelector('[data-field="name"]').value;
    item.role = node.querySelector('[data-field="role"]').value;
  });
}

function fillLinkRow(node, item) {
  node.querySelector('[data-field="label"]').value = item.label || '';
  node.querySelector('[data-field="url"]').value = item.url || '';
  node.querySelector('[data-field="icon"]').value = item.icon || '';

  node.addEventListener('input', () => {
    item.label = node.querySelector('[data-field="label"]').value;
    item.url = node.querySelector('[data-field="url"]').value;
    item.icon = node.querySelector('[data-field="icon"]').value;
  });
  node.querySelector('[data-field="icon"]').addEventListener('change', () => {
    item.icon = node.querySelector('[data-field="icon"]').value;
  });
}

function fillCustomSectionMediaRow(node, item) {
  node.querySelector('[data-field="caption"]').value = item.caption || '';
  renderProjectMediaPreview(node, item);

  const mediaInput = node.querySelector('[data-media-input]');
  node.querySelector('[data-media-action="upload"]').addEventListener('click', () => mediaInput.click());
  mediaInput.addEventListener('change', async () => {
    const file = mediaInput.files[0];
    if (!file) return;
    try {
      const result = await uploadFile(file, 'media');
      item.mediaUrl = result.url;
      item.mediaType = result.mediaType;
      renderProjectMediaPreview(node, item);
      schedulePreviewUpdate();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      mediaInput.value = '';
    }
  });

  node.addEventListener('input', () => {
    item.caption = node.querySelector('[data-field="caption"]').value;
  });
}

function fillCustomSectionItemRow(node, item) {
  node.querySelector('[data-field="title"]').value = item.title || '';
  node.querySelector('[data-field="description"]').value = item.description || '';

  node.addEventListener('input', () => {
    item.title = node.querySelector('[data-field="title"]').value;
    item.description = node.querySelector('[data-field="description"]').value;
  });
}

function fillCustomSectionRow(node, item) {
  if (!item.items) item.items = [];
  if (!item.media) item.media = [];

  node.querySelector('[data-field="title"]').value = item.title || '';
  node.querySelector('[data-field="body"]').value = item.body || '';
  node.querySelector('[data-field="visible"]').checked = item.visible !== false;

  node.addEventListener('input', () => {
    item.title = node.querySelector('[data-field="title"]').value;
    item.body = node.querySelector('[data-field="body"]').value;
    item.visible = node.querySelector('[data-field="visible"]').checked;
  });

  // Media gallery — reorderable, any number of images/videos
  const mediaEditor = node.querySelector('[data-media-editor]');
  renderNestedList(mediaEditor, 'custom-section-media-row-template', item.media, fillCustomSectionMediaRow);
  node.querySelector('[data-list-action="add-media"]').addEventListener('click', () => {
    const newMedia = { id: uid('csm'), mediaUrl: '', mediaType: '', caption: '' };
    item.media.push(newMedia);
    mediaEditor.appendChild(buildRow('custom-section-media-row-template', newMedia, fillCustomSectionMediaRow, item.media));
    schedulePreviewUpdate();
  });

  // Nested list (skills/hobbies/timeline-style items)
  const itemsEditor = node.querySelector('[data-items-editor]');
  renderNestedList(itemsEditor, 'custom-section-item-row-template', item.items, fillCustomSectionItemRow);
  node.querySelector('[data-list-action="add-item"]').addEventListener('click', () => {
    const newItem = { id: uid('csi'), title: '', description: '' };
    item.items.push(newItem);
    itemsEditor.appendChild(buildRow('custom-section-item-row-template', newItem, fillCustomSectionItemRow, item.items));
    schedulePreviewUpdate();
  });
}

document.getElementById('add-project-btn').addEventListener('click', () => {
  const item = { id: uid('p'), title: '', year: '', description: '', tags: [], link: '', mediaUrl: '', mediaType: '' };
  state.projects.push(item);
  document.getElementById('projects-editor').appendChild(buildRow('project-row-template', item, fillProjectRow, state.projects));
  schedulePreviewUpdate();
});

document.getElementById('add-skill-bar-btn').addEventListener('click', () => {
  const item = { id: uid('sb'), name: '', level: 70 };
  state.about.skillBars.push(item);
  document.getElementById('skill-bars-editor').appendChild(buildRow('skill-bar-row-template', item, fillSkillBarRow, state.about.skillBars));
  schedulePreviewUpdate();
});

document.getElementById('add-testimonial-btn').addEventListener('click', () => {
  const item = { id: uid('t'), quote: '', name: '', role: '' };
  state.testimonials.push(item);
  document.getElementById('testimonials-editor').appendChild(buildRow('testimonial-row-template', item, fillTestimonialRow, state.testimonials));
  schedulePreviewUpdate();
});

document.getElementById('add-experience-btn').addEventListener('click', () => {
  const item = { id: uid('e'), role: '', org: '', period: '', summary: '' };
  state.resume.experience.push(item);
  document.getElementById('experience-editor').appendChild(buildRow('experience-row-template', item, fillExperienceRow, state.resume.experience));
  schedulePreviewUpdate();
});

document.getElementById('add-education-btn').addEventListener('click', () => {
  const item = { id: uid('ed'), degree: '', school: '', period: '', summary: '' };
  state.education.push(item);
  document.getElementById('education-editor').appendChild(buildRow('education-row-template', item, fillEducationRow, state.education));
  schedulePreviewUpdate();
});

document.getElementById('add-link-btn').addEventListener('click', () => {
  const item = { id: uid('l'), label: '', url: '', icon: '' };
  state.contact.links.push(item);
  document.getElementById('links-editor').appendChild(buildRow('link-row-template', item, fillLinkRow, state.contact.links));
  schedulePreviewUpdate();
});

document.getElementById('add-custom-section-btn').addEventListener('click', () => {
  const item = { id: uid('cs'), title: '', visible: true, body: '', media: [], items: [] };
  state.customSections.push(item);
  document.getElementById('custom-sections-editor').appendChild(buildRow('custom-section-row-template', item, fillCustomSectionRow, state.customSections));
  schedulePreviewUpdate();
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
async function uploadFile(file, kind) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/admin/upload?kind=${kind}`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

document.getElementById('photo-upload-btn').addEventListener('click', () => document.getElementById('photo-input').click());
document.getElementById('photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    state.about.photoUrl = (await uploadFile(file, 'photo')).url;
    updatePhotoPreview();
    showToast('Photo uploaded — remember to save changes');
    schedulePreviewUpdate();
  } catch (err) {
    showToast(err.message, true);
  }
});
document.getElementById('photo-remove-btn').addEventListener('click', () => {
  state.about.photoUrl = '';
  updatePhotoPreview();
  schedulePreviewUpdate();
});

document.getElementById('resume-upload-btn').addEventListener('click', () => document.getElementById('resume-input').click());
document.getElementById('resume-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    state.resume.pdfUrl = (await uploadFile(file, 'resume')).url;
    updateResumePreview();
    showToast('Résumé uploaded — remember to save changes');
    schedulePreviewUpdate();
  } catch (err) {
    showToast(err.message, true);
  }
});
document.getElementById('resume-remove-btn').addEventListener('click', () => {
  state.resume.pdfUrl = '';
  updateResumePreview();
  schedulePreviewUpdate();
});

document.getElementById('parse-resume-btn').addEventListener('click', async () => {
  if (!state.resume.pdfUrl) return;

  const ok = confirm(
    "This will replace your current About bio, skills, and experience entries with content read from this PDF.\n\n" +
    "Extraction is best-effort — resumes come in all kinds of formats, so double-check everything before saving. Continue?"
  );
  if (!ok) return;

  const statusEl = document.getElementById('parse-status');
  const btn = document.getElementById('parse-resume-btn');
  btn.disabled = true;
  statusEl.textContent = 'Reading PDF…';

  try {
    const res = await fetch('/api/admin/parse-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: state.resume.pdfUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not read that PDF');

    const draft = data.draft;
    const found = [];

    // Capture whatever the person has already typed elsewhere in the form
    // before we overwrite state, so we don't lose unsaved edits.
    collectFormIntoState();

    if (draft.paragraphs && draft.paragraphs.length) {
      state.about.paragraphs = draft.paragraphs;
      found.push('bio');
    }
    if (draft.skills && draft.skills.length) {
      state.about.skills = draft.skills;
      found.push('skills');
    }
    if (draft.experience && draft.experience.length) {
      state.resume.experience = draft.experience.map((e) => ({ id: uid('e'), ...e }));
      found.push('experience');
    }
    if (draft.email) {
      state.contact.email = draft.email;
      found.push('email');
    }

    populateForm();
    schedulePreviewUpdate();

    statusEl.textContent = found.length
      ? `Filled in: ${found.join(', ')}. Review the fields above, then Save changes.`
      : "Couldn't find much to extract from this PDF — you may need to fill these in by hand.";
  } catch (err) {
    statusEl.textContent = '';
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
function collectFormIntoState() {
  state.theme = document.getElementById('f-theme').value;
  state.font = document.getElementById('f-font').value;
  state.layout = document.getElementById('f-layout').value;
  state.backgroundEffect = document.getElementById('f-bg-effect').value;
  state.name = document.getElementById('f-name').value.trim();
  state.role = document.getElementById('f-role').value.trim();
  state.tagline = document.getElementById('f-tagline').value.trim();
  state.status = document.getElementById('f-status').value.trim();

  state.about.paragraphs = document.getElementById('f-about-paragraphs').value.split('\n').map((s) => s.trim()).filter(Boolean);
  state.about.skills = document.getElementById('f-skills').value.split(',').map((s) => s.trim()).filter(Boolean);
  state.about.skillsDisplay = document.getElementById('f-skills-display').value;
  state.about.photoLabel = document.getElementById('f-photo-label').value.trim();
  state.about.photoSize = document.getElementById('f-photo-size').value;
  state.about.photoShape = document.getElementById('f-photo-shape').value;
  state.about.photoPlacement = document.getElementById('f-photo-placement').value;
  state.aboutVisible = document.getElementById('f-about-visible').checked;

  state.contact.email = document.getElementById('f-email').value.trim();
  state.footerNote = document.getElementById('f-footer').value.trim();
  state.copyrightYear = document.getElementById('f-copyright-year').value.trim();
  state.copyrightHolder = document.getElementById('f-copyright-holder').value.trim();
  state.projectsVisible = document.getElementById('f-projects-visible').checked;
  state.testimonialsVisible = document.getElementById('f-testimonials-visible').checked;
  state.resumeVisible = document.getElementById('f-resume-section-visible').checked;
  state.resume.pdfVisible = document.getElementById('f-resume-visible').checked;
  state.educationVisible = document.getElementById('f-education-visible').checked;
}

async function saveContent() {
  collectFormIntoState();
  try {
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    showToast('Saved');
  } catch (err) {
    showToast(err.message, true);
  }
}

document.getElementById('save-btn').addEventListener('click', saveContent);
document.getElementById('save-btn-bottom').addEventListener('click', saveContent);

document.getElementById('export-btn').addEventListener('click', () => {
  const ok = confirm(
    "This exports your last saved version as a static site you can host anywhere " +
    "(Netlify, Vercel, GitHub Pages, etc.) — it will NOT include any changes you " +
    "haven't saved yet. Continue?"
  );
  if (!ok) return;
  window.location.href = '/api/admin/export';
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

// ---------------------------------------------------------------------------
// Live preview
// ---------------------------------------------------------------------------
// The preview panel embeds the public site in an iframe and receives the
// in-progress (unsaved) content object via postMessage, so it reflects
// edits as they happen rather than only what's been saved.
let previewDebounceTimer = null;

function schedulePreviewUpdate() {
  clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(sendPreviewUpdate, 200);
}

function sendPreviewUpdate() {
  if (!state) return;
  const iframe = document.getElementById('preview-iframe');
  const panel = document.getElementById('preview-panel');
  if (!iframe || !iframe.contentWindow || panel.hidden) return;
  collectFormIntoState();
  iframe.contentWindow.postMessage({ type: 'portfolio-preview', content: state }, window.location.origin);
}

document.getElementById('preview-toggle-checkbox').addEventListener('change', (e) => {
  document.getElementById('preview-panel').hidden = !e.target.checked;
  document.body.classList.toggle('preview-open', e.target.checked);
  if (e.target.checked) sendPreviewUpdate();
});
document.getElementById('preview-close-btn').addEventListener('click', () => {
  document.getElementById('preview-panel').hidden = true;
  document.getElementById('preview-toggle-checkbox').checked = false;
  document.body.classList.remove('preview-open');
});
document.getElementById('preview-iframe').addEventListener('load', sendPreviewUpdate);

document.querySelectorAll('.preview-viewport-toggle__btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preview-viewport-toggle__btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.getElementById('preview-panel').classList.toggle('is-mobile-preview', btn.dataset.viewport === 'mobile');
  });
});

// Delegated listeners catch ordinary typing/checkbox changes anywhere in the
// form; explicit schedulePreviewUpdate() calls elsewhere in this file cover
// the handful of programmatic changes (add/remove/reorder rows, uploads)
// that don't fire native input/change events.
const adminMain = document.getElementById('admin-main');
adminMain.addEventListener('input', schedulePreviewUpdate);
adminMain.addEventListener('change', schedulePreviewUpdate);

loadContent();
