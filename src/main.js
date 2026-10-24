import { checkPrescription, getApiBaseUrl, isLiveApiConfigured, serializeRequest } from './services/api.js';
import { getDemoScenario, getDemoScenarios, getInitialForm } from './services/mockData.js';
import { icon } from './utils/icons.js';
import { clone, escapeHtml, formatDateTime, formatFrequency, formatIngredient, FREQUENCY_OPTIONS, KIDNEY_OPTIONS, MATCH_META, SEVERITY_META } from './utils/format.js';

const HISTORY_KEY = 'meditrace.history.v1';
const app = document.querySelector('#app');
const toastRegion = document.querySelector('#toast-region');

const state = {
  page: 'dashboard',
  form: getInitialForm(),
  patientOpen: false,
  selectedDemoScenario: 'duplicate',
  mode: isLiveApiConfigured() ? 'live' : 'demo',
  loading: false,
  error: null,
  analysis: null,
  selectedMedicineId: null,
  selectedFindingId: null,
  activeFindingFilter: 'all',
  searchQuery: '',
  sortOrder: 'priority',
  mobileMenuOpen: false,
  validation: {},
  history: readHistory()
};

const pageMeta = {
  dashboard: { title: 'Overview', context: 'Start a review or reopen a recent result' },
  'new-review': { title: 'New review', context: 'Enter the prescription exactly as written' },
  results: { title: 'Prescription review', context: 'Inspect findings, evidence and medicine matches' },
  'patient-history': { title: 'Patient history', context: 'Future workspace — no patient records are stored' },
  history: { title: 'Review history', context: 'Local review snapshots for this browser only' },
  about: { title: 'Safety information', context: 'Prototype boundaries and API integration notes' }
};

render();

app.addEventListener('click', handleClick);
app.addEventListener('input', handleInput);
app.addEventListener('change', handleChange);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (state.selectedMedicineId || state.selectedFindingId) {
      state.selectedMedicineId = null;
      state.selectedFindingId = null;
      render();
    } else if (state.mobileMenuOpen) {
      state.mobileMenuOpen = false;
      render();
    }
  }
});

function render() {
  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar()}
      <div class="mobile-backdrop ${state.mobileMenuOpen ? 'visible' : ''}" data-action="close-mobile-menu"></div>
      <main class="main-area">
        ${renderTopbar()}
        ${state.page === 'dashboard' ? renderDashboardPage() : ''}
        ${state.page === 'new-review' ? renderNewReviewPage() : ''}
        ${state.page === 'results' ? renderResultsPage() : ''}
        ${state.page === 'patient-history' ? renderPatientHistoryPage() : ''}
        ${state.page === 'history' ? renderHistoryPage() : ''}
        ${state.page === 'about' ? renderAboutPage() : ''}
      </main>
      ${renderOverlays()}
    </div>
  `;
}

function renderSidebar() {
  const navItems = [
    { page: 'dashboard', iconName: 'grid', title: 'Overview', description: 'Start or reopen a review' },
    { page: 'new-review', iconName: 'plus', title: 'New review', description: 'Enter a prescription', action: 'new-prescription' },
    { page: 'patient-history', iconName: 'user', title: 'Patient history', description: 'Coming later' },
    { page: 'history', iconName: 'history', title: 'Review history', description: 'Local review snapshots' },
    { page: 'about', iconName: 'info', title: 'About & safety', description: 'Prototype boundaries' }
  ];
  return `
    <aside class="sidebar ${state.mobileMenuOpen ? 'open' : ''}" aria-label="Primary navigation">
      <div class="brand">
        <button class="brand-link" data-action="navigate" data-page="dashboard" type="button" aria-label="Open MediTrace overview">
          <img class="brand-symbol" src="./assets/meditrace-mark.png" alt="" width="34" height="34" />
        <div class="brand-copy">
          <div class="brand-name">MediTrace</div>
          <div class="brand-subtitle">clinical review workspace</div>
        </div>
        </button>
      </div>
      <div class="sidebar-label">Workspace</div>
      <nav class="nav-list">
        ${navItems.map((item) => `
          <button class="nav-item ${state.page === item.page ? 'active' : ''}" data-action="${item.action || 'navigate'}" data-page="${item.page}" type="button">
            ${icon(item.iconName, '', 17)}
            <span class="nav-item-copy">
              <span class="nav-item-title">${item.title}</span>
              <span class="nav-item-description">${item.description}</span>
            </span>
          </button>
        `).join('')}
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="status-card">
        <div class="status-line"><span class="status-dot"></span>${isLiveApiConfigured() ? 'Live API configured' : 'Demo mode active'}</div>
        <div class="version">Prototype v1.0</div>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const meta = pageMeta[state.page];
  const isDemo = state.analysis?.isDemo || state.mode === 'demo' || !isLiveApiConfigured();
  return `
    <header class="topbar">
      <div class="topbar-leading">
        <button class="button button-ghost button-small mobile-menu" data-action="toggle-mobile-menu" aria-label="Open navigation" type="button">${icon('menu', '', 18)}</button>
        <div class="page-title">${meta.title}</div>
        <div class="topbar-context">${meta.context}</div>
      </div>
      <div class="topbar-actions">
        ${isDemo ? `<span class="demo-chip">${icon('database', '', 12)} demo data</span>` : `<span class="live-chip">${icon('database', '', 12)} live API</span>`}
        ${!['dashboard', 'new-review'].includes(state.page) ? `<button class="button button-secondary button-small" data-action="new-prescription" type="button">${icon('plus', '', 14)} New review</button>` : ''}
      </div>
    </header>
  `;
}

function renderDashboardPage() {
  return `
    <section class="page overview-page">
      <div class="page-header">
        <div class="page-header-copy">
          <div class="overview-brand-lockup">
            <img class="brand-wordmark" src="./assets/meditrace-wordmark-dark.png" alt="MediTrace" width="220" height="60" />
            <span>Prescription safety workspace</span>
          </div>
          <div class="eyebrow">MediTrace review workspace</div>
          <h1>Start with the prescription.</h1>
          <p class="lead">Enter medicines as written, then review the supported matches, findings, evidence and uncertainty in one place.</p>
        </div>
        <div class="page-actions">
          <button class="button button-primary button-large" data-action="focus-prescription" type="button">${icon('plus', '', 16)} Start a review</button>
        </div>
      </div>

      <div class="overview-grid">
        <section class="card card-body overview-panel">
          <div class="section-heading-copy">
            <h2>Recent reviews</h2>
            <p class="section-description">Local snapshots only. MediTrace does not create patient records.</p>
          </div>
          ${state.history.length
            ? `<div class="recent-review-list">${state.history.slice(0, 3).map(renderHistoryItem).join('')}</div>`
            : `<div class="empty-state compact-empty"><div><div class="empty-state-title">No reviews yet</div><div class="empty-state-copy">Your first completed review will appear here for quick access.</div></div></div>`}
          ${state.history.length > 3 ? `<button class="button button-ghost button-small" data-action="navigate" data-page="history" type="button">View all review history ${icon('arrowRight', '', 13)}</button>` : ''}
        </section>
        <div class="stack">
          ${renderQuickGuide()}
          ${renderDemoPanel()}
        </div>
      </div>
      ${renderSafetyNote()}
    </section>
  `;
}

function renderNewReviewPage() {
  return `
    <section class="page review-page">
      <div class="page-header">
        <div class="page-header-copy">
          <div class="eyebrow">New review</div>
          <h1>Enter the prescription as written.</h1>
          <p class="lead">Start with the medicine details. Add patient context only when it is known and appropriate to share.</p>
        </div>
        <div class="page-actions">
          <button class="button button-ghost" data-action="clear-form" type="button">${icon('refresh', '', 14)} Clear form</button>
        </div>
      </div>
      ${renderPrescriptionWorkspace()}
      ${renderSafetyNote()}
    </section>
  `;
}

function renderMetricCard(label, value, caption, iconName) {
  return `
    <article class="metric-card">
      <div class="metric-label"><span>${label}</span><span class="metric-icon">${icon(iconName, '', 15)}</span></div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-caption">${caption}</div>
    </article>
  `;
}

function renderPrescriptionWorkspace() {
  return `
    <section class="card workspace-card" id="prescription-workspace">
      <div class="card-header">
        <div class="workspace-toolbar">
          <div class="section-heading-copy">
            <h2>Medicines</h2>
            <p class="section-description">Capture the brand, strength and directions exactly as written.</p>
          </div>
        </div>
        <div class="toolbar-meta"><span>${state.form.medicines.length} ${state.form.medicines.length === 1 ? 'medicine' : 'medicines'}</span></div>
      </div>
      <div class="card-body">
        ${state.error && state.page === 'new-review' ? renderErrorBanner(state.error) : ''}
        <div class="medicine-list">
          ${state.form.medicines.map((medicine, index) => renderMedicineInput(medicine, index)).join('')}
        </div>
        <div class="button-row" style="margin-top: 12px;">
          <button class="button button-secondary button-small" data-action="add-medicine" type="button">${icon('plus', '', 14)} Add medicine</button>
          <button class="button button-ghost button-small" data-action="clear-form" type="button">${icon('refresh', '', 14)} Clear form</button>
        </div>
      </div>
      <div class="card-header">
        <button class="collapsible-trigger" data-action="toggle-patient" type="button" aria-expanded="${state.patientOpen}">
          <span class="collapsible-copy">
            <span class="collapsible-title">Additional details <span class="tag info">optional</span></span>
            <span class="section-description">Age is required for live checks. Other context is optional.</span>
          </span>
          ${icon(state.patientOpen ? 'chevronUp' : 'chevronDown', '', 17)}
        </button>
      </div>
      ${state.patientOpen ? renderPatientPanel() : ''}
      <div class="card-body">
        <button class="button button-primary button-block" data-action="submit-analysis" type="button" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? `${icon('refresh', '', 15)} Analysing prescription…` : `${icon('arrowRight', '', 15)} Analyse prescription`}
        </button>
        <p class="muted tiny form-footnote" style="margin-top: 9px;">MediTrace supports review. It does not replace a doctor, pharmacist or other qualified healthcare professional.</p>
      </div>
    </section>
  `;
}

function renderMedicineInput(medicine, index) {
  const error = (field) => state.validation[`medicine-${index}-${field}`];
  const frequencyOptions = FREQUENCY_OPTIONS.map((option) => `<option value="${option.value}" ${medicine.frequency === option.value ? 'selected' : ''}>${option.label}</option>`).join('');
  return `
    <article class="medicine-row">
      <div class="medicine-row-head">
        <div class="medicine-index"><span class="index-circle">${index + 1}</span> Medicine entry</div>
        <button class="button button-ghost button-small" data-action="remove-medicine" data-index="${index}" type="button" ${state.form.medicines.length === 1 ? 'disabled' : ''} aria-label="Remove medicine ${index + 1}">${icon('trash', '', 14)} Remove</button>
      </div>
      <div class="medicine-fields">
        ${renderField({ label: 'Brand name', placeholder: 'e.g. brand as written', value: medicine.name, field: 'name', index, required: true, error: error('name') })}
        ${renderField({ label: 'Strength', placeholder: 'e.g. 500 mg', value: medicine.strength, field: 'strength', index, error: error('strength') })}
        ${renderField({ label: 'Dose', placeholder: 'e.g. 1 tablet', value: medicine.dose, field: 'dose', index, required: true, error: error('dose') })}
        <div class="field-group">
          <label class="field-label" for="frequency-${index}">Frequency <span class="optional">required</span></label>
          <select id="frequency-${index}" class="select ${error('frequency') ? 'invalid' : ''}" data-medicine-index="${index}" data-field="frequency" aria-label="Frequency for medicine ${index + 1}">
            ${frequencyOptions}
          </select>
          ${error('frequency') ? `<div class="validation-error">${escapeHtml(error('frequency'))}</div>` : ''}
        </div>
        ${renderField({ label: 'Duration', placeholder: 'days', value: medicine.duration_days, field: 'duration_days', index, type: 'number', min: 1, error: error('duration_days') })}
      </div>
      <div class="medicine-extra">
        ${renderField({ label: 'Instructions', placeholder: 'Optional directions copied from the prescription', value: medicine.instructions, field: 'instructions', index, multiline: true })}
        <div class="help-note">${icon('info', '', 15)}<span>Do not use the form to invent a dose. Capture the prescription as written and let the response explain what could not be assessed.</span></div>
      </div>
    </article>
  `;
}

function renderField({ label, placeholder, value, field, index, required = false, type = 'text', min, error, multiline = false }) {
  const inputId = `medicine-${index}-${field}`;
  const common = `id="${inputId}" class="${multiline ? 'textarea' : 'input'} ${error ? 'invalid' : ''}" data-medicine-index="${index}" data-field="${field}" placeholder="${escapeHtml(placeholder)}" ${type === 'number' ? `type="number" min="${min || 1}"` : ''} ${multiline ? '' : `type="${type}"`} value="${!multiline ? escapeHtml(value || '') : ''}" aria-label="${escapeHtml(label)} for medicine ${index + 1}"`;
  return `<div class="field-group"><label class="field-label" for="${inputId}">${label} ${required ? '<span class="optional">required</span>' : '<span class="optional">optional</span>'}</label>${multiline ? `<textarea ${common}>${escapeHtml(value || '')}</textarea>` : `<input ${common} />`}${error ? `<div class="validation-error">${escapeHtml(error)}</div>` : ''}</div>`;
}

function renderPatientPanel() {
  return `
    <div class="patient-body">
      <div class="patient-fields">
        ${renderPatientField('Age in years', 'age_years', state.form.patient.age_years, 'number', 'e.g. 45', true)}
        ${renderPatientField('Weight in kg', 'weight_kg', state.form.patient.weight_kg, 'number', 'e.g. 70')}
        <div class="field-group">
          <label class="field-label" for="kidney-condition">Kidney condition <span class="optional">optional</span></label>
          <select id="kidney-condition" class="select ${state.validation['patient-kidney_condition'] ? 'invalid' : ''}" data-patient-field="kidney_condition">
            ${KIDNEY_OPTIONS.map((option) => `<option value="${option.value}" ${state.form.patient.kidney_condition === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
          ${state.validation['patient-kidney_condition'] ? `<div class="validation-error">${escapeHtml(state.validation['patient-kidney_condition'])}</div>` : ''}
        </div>
      </div>
      <div class="help-note">${icon('user', '', 15)}<span>Age is required by the live backend. Weight and kidney context are optional; MediTrace will not infer missing patient data.</span></div>
    </div>
  `;
}

function renderPatientField(label, field, value, type, placeholder, required = false) {
  const error = state.validation[`patient-${field}`];
  const inputId = `patient-${field}`;
  return `<div class="field-group"><label class="field-label" for="${inputId}">${label} <span class="optional">${required ? 'required for live checks' : 'optional'}</span></label><input id="${inputId}" class="input ${error ? 'invalid' : ''}" data-patient-field="${field}" type="${type}" min="0" placeholder="${placeholder}" value="${escapeHtml(value || '')}" ${required ? 'aria-required="true"' : ''} />${error ? `<div class="validation-error">${escapeHtml(error)}</div>` : ''}</div>`;
}

function renderDemoPanel() {
  const scenarios = getDemoScenarios();
  const selected = getDemoScenario(state.selectedDemoScenario);
  return `
    <section class="card demo-panel card-body" aria-label="Demo controls">
      <div class="demo-panel-header">
        <div class="demo-panel-copy">
          <div class="demo-panel-title">Presentation demo controls</div>
          <div class="demo-panel-description">Team presentation fixtures are synthetic and visibly labelled. They never claim a real clinical finding.</div>
        </div>
        <span class="demo-chip">${icon('database', '', 12)} demo</span>
      </div>
      <div class="demo-scenario-list">
        ${scenarios.map((scenario) => `
          <button class="demo-scenario ${state.selectedDemoScenario === scenario.id ? 'selected' : ''}" data-action="select-demo" data-scenario="${scenario.id}" type="button">
            <span class="scenario-radio" aria-hidden="true"></span>
            <span><span class="scenario-name">${escapeHtml(scenario.label)}</span><span class="scenario-description">${escapeHtml(scenario.description)}</span></span>
          </button>
        `).join('')}
      </div>
      <div class="button-row">
        <button class="button button-secondary button-small" data-action="load-demo" type="button">${icon('download', '', 14)} Load selected</button>
        <button class="button button-primary button-small" data-action="run-demo" type="button" ${state.loading ? 'disabled' : ''}>${icon('arrowRight', '', 14)} Run demo</button>
      </div>
      <div class="muted tiny">Selected: <span class="secondary-text">${escapeHtml(selected.label)}</span></div>
    </section>
  `;
}

function renderQuickGuide() {
  return `
    <section class="card card-body">
      <div class="section-heading-copy">
        <h3>What happens next</h3>
        <p class="section-description">MediTrace keeps matches, findings and uncertainty separate.</p>
      </div>
      <div class="about-list" style="margin-top: 14px;">
        <li><strong>1.</strong> Enter medicines as written.</li>
        <li><strong>2.</strong> Review the highest-priority finding first.</li>
        <li><strong>3.</strong> Open evidence and technical details when needed.</li>
      </div>
    </section>
  `;
}

function renderSafetyNote() {
  return `<div class="safety-note">${icon('shield', '', 17)}<span><strong>Prototype boundary:</strong> These results are decision-support demonstrations, not medical advice. Alerts may be incomplete or incorrect; no alert does not mean a prescription is safe. A qualified doctor or pharmacist must make clinical decisions.</span></div>`;
}

function getDashboardMetrics() {
  const summary = state.analysis?.summary;
  if (!summary) return { medicinesReviewed: 0, overlaps: 0, alerts: 0, unmatched: 0 };
  return {
    medicinesReviewed: summary.medicinesSubmitted || 0,
    overlaps: summary.confirmedIngredientOverlaps || 0,
    alerts: Object.values(summary.alertsBySeverity || {}).reduce((total, value) => total + Number(value || 0), 0),
    unmatched: summary.unmatchedMedicines || 0
  };
}

function getFilteredFindings() {
  let findings = [...(state.analysis?.findings || [])];
  if (state.activeFindingFilter !== 'all') findings = findings.filter((finding) => finding.severity === state.activeFindingFilter);
  const query = state.searchQuery.trim().toLowerCase();
  if (query) {
    findings = findings.filter((finding) => [finding.title, finding.description, finding.category, ...(finding.affectedMedicines || []), ...(finding.ingredients || [])].join(' ').toLowerCase().includes(query));
  }
  if (state.sortOrder === 'alphabetical') findings.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sortOrder === 'priority') {
    const order = { critical: 0, high: 1, moderate: 2, needs_review: 3, informational: 4 };
    findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  }
  return findings;
}

function handleClick(event) {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;
  if (action === 'close-overlay' && control.classList.contains('overlay') && event.target.closest('[data-stop-overlay]')) return;

  if (action === 'navigate') {
    state.page = control.dataset.page || 'dashboard';
    state.mobileMenuOpen = false;
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }
  if (action === 'new-prescription') {
    startNewPrescription();
    return;
  }
  if (action === 'toggle-mobile-menu') {
    state.mobileMenuOpen = !state.mobileMenuOpen;
    render();
    return;
  }
  if (action === 'close-mobile-menu') {
    state.mobileMenuOpen = false;
    render();
    return;
  }
  if (action === 'focus-prescription') {
    state.page = 'new-review';
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => document.querySelector('#medicine-0-name')?.focus());
    return;
  }
  if (action === 'load-demo') {
    loadSelectedDemo();
    return;
  }
  if (action === 'select-demo') {
    state.selectedDemoScenario = control.dataset.scenario || 'duplicate';
    render();
    return;
  }
  if (action === 'run-demo') {
    const scenario = getDemoScenario(state.selectedDemoScenario);
    state.form = {
      patient: { ...scenario.patient, age_years: scenario.patient.age_years ?? '', weight_kg: scenario.patient.weight_kg ?? '' },
      medicines: clone(scenario.prescription)
    };
    state.validation = {};
    state.mode = 'demo';
    runAnalysis('demo');
    return;
  }
  if (action === 'submit-analysis') {
    runAnalysis(state.mode);
    return;
  }
  if (action === 'add-medicine') {
    state.form.medicines.push({ name: '', strength: '', dose: '', frequency: 'OD', duration_days: '', instructions: '' });
    state.validation = {};
    render();
    window.requestAnimationFrame(() => document.querySelector(`#medicine-${state.form.medicines.length - 1}-name`)?.focus());
    return;
  }
  if (action === 'remove-medicine') {
    const index = Number(control.dataset.index);
    if (state.form.medicines.length <= 1 || !Number.isInteger(index)) return;
    if (!window.confirm('Remove this medicine entry from the draft?')) return;
    state.form.medicines.splice(index, 1);
    state.validation = {};
    render();
    return;
  }
  if (action === 'toggle-patient') {
    state.patientOpen = !state.patientOpen;
    render();
    return;
  }
  if (action === 'clear-form') {
    clearForm();
    return;
  }
  if (action === 'back-to-editor') {
    state.page = 'new-review';
    state.error = null;
    render();
    window.requestAnimationFrame(() => document.querySelector('#prescription-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }
  if (action === 'filter-findings') {
    state.activeFindingFilter = control.dataset.filter || 'all';
    render();
    return;
  }
  if (action === 'view-finding') {
    state.selectedFindingId = control.dataset.findingId || null;
    state.selectedMedicineId = null;
    render();
    return;
  }
  if (action === 'view-medicine') {
    state.selectedMedicineId = control.dataset.medicineId || null;
    state.selectedFindingId = null;
    render();
    return;
  }
  if (action === 'close-overlay') {
    state.selectedMedicineId = null;
    state.selectedFindingId = null;
    render();
    return;
  }
  if (action === 'confirm-candidate') {
    confirmCandidate(control.dataset.medicineId, control.dataset.candidateId);
    return;
  }
  if (action === 'open-history') {
    const entry = state.history.find((item) => item.id === control.dataset.historyId);
    if (!entry) return;
    state.analysis = clone(entry.analysis);
    state.form = formFromRequestEcho(state.analysis.requestEcho);
    state.mode = state.analysis.isDemo ? 'demo' : 'live';
    state.page = 'results';
    state.error = null;
    render();
    return;
  }
  if (action === 'delete-history') {
    deleteHistory(control.dataset.historyId);
  }
}

function handleInput(event) {
  const target = event.target;
  if (target.dataset.searchFindings) {
    state.searchQuery = target.value;
    refreshFindingList();
    return;
  }
  if (target.dataset.medicineIndex !== undefined) {
    const index = Number(target.dataset.medicineIndex);
    const field = target.dataset.field;
    if (state.form.medicines[index] && field) {
      state.form.medicines[index][field] = target.value;
      delete state.validation[`medicine-${index}-${field}`];
    }
    return;
  }
  if (target.dataset.patientField) {
    state.form.patient[target.dataset.patientField] = target.value;
    delete state.validation[`patient-${target.dataset.patientField}`];
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.dataset.sortFindings !== undefined) {
    state.sortOrder = target.value;
    refreshFindingList();
    return;
  }
  handleInput(event);
}

function refreshFindingList() {
  const list = document.querySelector('#finding-list');
  if (list) list.innerHTML = renderFindingCards(getFilteredFindings());
}

function startNewPrescription() {
  const hasDraft = state.form.medicines.some((medicine) => ['name', 'strength', 'dose', 'duration_days', 'instructions'].some((field) => String(medicine[field] || '').trim())) || String(state.form.patient.age_years || '').trim() || String(state.form.patient.weight_kg || '').trim() || state.analysis;
  if (hasDraft && !window.confirm('Start a new review and clear the current draft/results?')) return;
  state.page = 'new-review';
  state.form = getInitialForm();
  state.analysis = null;
  state.error = null;
  state.validation = {};
  state.selectedMedicineId = null;
  state.selectedFindingId = null;
  state.activeFindingFilter = 'all';
  state.searchQuery = '';
  state.mode = isLiveApiConfigured() ? 'live' : 'demo';
  state.mobileMenuOpen = false;
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
  window.requestAnimationFrame(() => document.querySelector('#medicine-0-name')?.focus());
}

function loadSelectedDemo() {
  const scenario = getDemoScenario(state.selectedDemoScenario);
  state.page = 'new-review';
  state.form = {
    patient: { ...scenario.patient, age_years: scenario.patient.age_years ?? '', weight_kg: scenario.patient.weight_kg ?? '' },
    medicines: clone(scenario.prescription)
  };
  state.analysis = null;
  state.error = null;
  state.validation = {};
  state.mode = isLiveApiConfigured() ? 'live' : 'demo';
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
  showToast('Demo prescription loaded', `${scenario.label} is marked as illustrative data.`, 'success');
}

function clearForm() {
  if (!window.confirm('Clear all medicine and patient context fields?')) return;
  state.form = getInitialForm();
  state.analysis = null;
  state.error = null;
  state.validation = {};
  render();
  showToast('Draft cleared', 'The prescription workspace is ready for a new review.', 'success');
}

function validateForm(mode = state.mode) {
  const errors = {};
  state.form.medicines.forEach((medicine, index) => {
    if (!String(medicine.name || '').trim()) errors[`medicine-${index}-name`] = 'Enter the brand name as written.';
    if (!String(medicine.dose || '').trim()) errors[`medicine-${index}-dose`] = 'Enter the dose as written.';
    if (!String(medicine.frequency || '').trim()) errors[`medicine-${index}-frequency`] = 'Choose a frequency or mark it as Other.';
    if (medicine.duration_days !== '' && (!Number.isInteger(Number(medicine.duration_days)) || Number(medicine.duration_days) < 1)) errors[`medicine-${index}-duration_days`] = 'Use a whole number of days.';
  });
  if (mode === 'live' && state.form.patient.age_years === '') errors['patient-age_years'] = 'Enter an age before running a live check.';
  if (state.form.patient.age_years !== '' && (!Number.isFinite(Number(state.form.patient.age_years)) || Number(state.form.patient.age_years) <= 0 || Number(state.form.patient.age_years) > 120)) errors['patient-age_years'] = 'Enter an age between 1 and 120.';
  if (state.form.patient.weight_kg !== '' && (!Number.isFinite(Number(state.form.patient.weight_kg)) || Number(state.form.patient.weight_kg) <= 0)) errors['patient-weight_kg'] = 'Enter a positive weight or leave it blank.';
  state.validation = errors;
  return Object.keys(errors).length === 0;
}

async function runAnalysis(mode) {
  if (state.loading) return;
  if (!validateForm(mode)) {
    state.page = 'new-review';
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    showToast('Check the highlighted fields', 'Required prescription details are missing or invalid.', 'error');
    return;
  }
  const requestForm = clone(state.form);
  state.page = 'results';
  state.loading = true;
  state.error = null;
  state.analysis = null;
  state.selectedMedicineId = null;
  state.selectedFindingId = null;
  state.activeFindingFilter = 'all';
  state.searchQuery = '';
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
  try {
    const result = await checkPrescription(requestForm, { mode, scenarioId: state.selectedDemoScenario });
    state.analysis = result;
    state.form = requestForm;
    state.loading = false;
    state.error = null;
    saveAnalysisHistory(result);
    render();
    showToast('Review ready', result.isDemo ? 'Synthetic demo data is clearly labelled in the result.' : 'The live API response is ready to review.', 'success');
  } catch (error) {
    state.loading = false;
    state.error = error?.message || 'The analysis service is unavailable.';
    render();
    showToast('Review unavailable', state.error, 'error');
  }
}

function confirmCandidate(medicineId, candidateId) {
  const medicine = state.analysis?.medicines.find((item) => item.id === medicineId);
  const candidate = medicine?.candidates.find((item) => item.id === candidateId);
  if (!medicine || !candidate) return;
  medicine.matchStatus = 'exact';
  medicine.genericName = candidate.genericName;
  medicine.strength = candidate.strength;
  medicine.ingredients = clone(candidate.ingredients);
  medicine.confidence = 'user_confirmed';
  medicine.candidates = [];
  medicine.reviewNote = 'Candidate selected in the frontend. Re-run the review to obtain backend findings for this confirmed match.';
  render();
  showToast('Candidate selected', 'The original response is preserved; run the review again to recalculate findings.', 'success');
}

function formFromRequestEcho(request) {
  if (!request) return getInitialForm();
  return {
    patient: { age_years: request.patient?.age_years ?? '', weight_kg: request.patient?.weight_kg ?? '', kidney_condition: request.patient?.kidney_condition || 'unknown' },
    medicines: Array.isArray(request.medicines) && request.medicines.length ? request.medicines.map((medicine) => ({ name: medicine.name || '', strength: medicine.strength || '', dose: medicine.dose || '', frequency: medicine.frequency || 'OD', duration_days: medicine.duration_days ?? '', instructions: medicine.instructions || '' })) : getInitialForm().medicines
  };
}

function showToast(title, message, tone = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.innerHTML = `${icon(tone === 'error' ? 'alert' : 'check', '', 16)}<div class="toast-copy"><div class="toast-title">${escapeHtml(title)}</div><div class="toast-message">${escapeHtml(message)}</div></div>`;
  toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function readHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistHistory() {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch {
    // Local history is an enhancement only; the review flow remains usable if storage is unavailable.
  }
}

function saveAnalysisHistory(analysis) {
  const entry = {
    id: window.crypto?.randomUUID?.() || `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    analyzedAt: analysis.analyzedAt,
    isDemo: analysis.isDemo,
    scenarioLabel: analysis.scenarioLabel,
    status: analysis.status,
    summary: analysis.summary,
    analysis: clone(analysis)
  };
  state.history = [entry, ...state.history.filter((item) => item.scenarioLabel !== entry.scenarioLabel || item.isDemo !== entry.isDemo)].slice(0, 8);
  persistHistory();
}

function deleteHistory(id) {
  if (!id || !window.confirm('Delete this local analysis snapshot?')) return;
  state.history = state.history.filter((item) => item.id !== id);
  persistHistory();
  render();
  showToast('History item deleted', 'Only the local browser snapshot was removed.', 'success');
}

function renderHistoryPage() {
  return `
    <section class="page compact-page">
      <div class="page-header">
        <div class="page-header-copy"><div class="eyebrow">Review history</div><h1>Previous reviews, kept local.</h1><p class="lead">These snapshots are stored only in this browser. They are not patient records and are not synced to a server.</p></div>
        <div class="page-actions"><button class="button button-primary" data-action="new-prescription" type="button">${icon('plus', '', 15)} New prescription</button></div>
      </div>
      ${state.history.length ? `<div class="history-list">${state.history.map(renderHistoryItem).join('')}</div>` : `<div class="empty-state"><div><div class="empty-state-icon" style="margin-inline: auto;">${icon('history', '', 19)}</div><div class="empty-state-title">No local analyses yet</div><div class="empty-state-copy">Run a demo scenario or connect the live API to create a local review snapshot.</div></div></div>`}
    </section>
  `;
}

function renderPatientHistoryPage() {
  return `
    <section class="page compact-page">
      <div class="page-header">
        <div class="page-header-copy"><div class="eyebrow">Future workspace</div><h1>Patient history is not available yet.</h1><p class="lead">MediTrace currently stores local review snapshots only. It does not create patient profiles or medical records.</p></div>
        <div class="page-actions"><button class="button button-primary" data-action="new-prescription" type="button">${icon('plus', '', 15)} Start a review</button></div>
      </div>
      <section class="card card-body future-panel">
        <div class="empty-state-icon">${icon('user', '', 19)}</div>
        <h2>No patient records</h2>
        <p class="section-description">This clearly labelled placeholder prevents the interface from implying that patient history is already supported.</p>
      </section>
    </section>
  `;
}

function renderHistoryItem(entry) {
  const alerts = Object.values(entry.summary?.alertsBySeverity || {}).reduce((total, value) => total + Number(value || 0), 0);
  return `
    <article class="history-item">
      <div class="history-item-copy">
        <div class="history-item-title">${escapeHtml(entry.scenarioLabel || entry.status?.title || 'Prescription review')}</div>
        <div class="history-item-meta"><span>${escapeHtml(formatDateTime(entry.analyzedAt))}</span><span>•</span><span>${entry.summary?.medicinesSubmitted || 0} medicines</span><span>•</span><span>${alerts} findings</span>${entry.isDemo ? '<span class="demo-chip">demo</span>' : '<span class="live-chip">live</span>'}</div>
      </div>
      <div class="history-item-actions"><button class="button button-secondary button-small" data-action="open-history" data-history-id="${escapeHtml(entry.id)}" type="button">${icon('arrowRight', '', 13)} Open</button><button class="button button-ghost button-small" data-action="delete-history" data-history-id="${escapeHtml(entry.id)}" type="button" aria-label="Delete history item">${icon('trash', '', 13)}</button></div>
    </article>
  `;
}

function renderAboutPage() {
  return `
    <section class="page compact-page">
      <div class="page-header">
        <div class="page-header-copy"><div class="eyebrow">Safety information</div><h1>Transparent by design.</h1><p class="lead">MediTrace makes its boundaries visible: it explains returned data, preserves uncertainty and never turns an empty findings list into a safety claim.</p></div>
      </div>
      <div class="about-grid">
        <section class="card card-body about-section"><h2>What this prototype does</h2><ul class="about-list"><li>Captures typed brand names, strengths, doses, frequencies and durations.</li><li>Shows the response's active ingredients, match states, findings and supporting evidence.</li><li>Groups alerts by severity and keeps unmatched or ambiguous entries visible.</li><li>Uses synthetic demo fixtures only when demo mode is explicitly selected or no live API is configured.</li></ul></section>
        <section class="card card-body about-section"><h2>What it does not do</h2><ul class="about-list"><li>It does not diagnose, prescribe, calculate independent medical limits or declare a prescription safe.</li><li>It does not substitute for a doctor, pharmacist or other qualified healthcare professional.</li><li>It does not invent a source when evidence is missing from the API response.</li><li>It does not create login, patient records or cloud persistence.</li></ul></section>
       <section class="card card-body about-section"><h2>API boundary</h2><p class="section-description">Configure the runtime base URL in <span class="mono">window.__MEDITRACE_CONFIG__</span>. The adapter then calls the FastAPI endpoint and normalizes unknown fields in one place.</p><pre class="api-code">POST /check · { "text": "Dolo 650 1 TDS", "patient": { "age": 35, "weight_kg": null }, "confirmed_matches": {}, "use_llm": false }</pre></section>
       <section class="card card-body about-section"><h2>Current runtime</h2><div class="key-value-list"><div class="key-value"><span class="key">Mode</span><span class="value">${isLiveApiConfigured() ? 'Live API configured' : 'Demo mode — no API base URL'}</span></div><div class="key-value"><span class="key">Endpoint</span><span class="value">${escapeHtml(getApiBaseUrl() ? `${getApiBaseUrl()}/check` : 'Not configured')}</span></div><div class="key-value"><span class="key">History</span><span class="value">Local browser storage only</span></div><div class="key-value"><span class="key">Version</span><span class="value">Prototype v1.0</span></div></div></section>
      </div>
    </section>
  `;
}

function renderOverlays() {
  if (state.selectedMedicineId && state.analysis) {
    const medicine = state.analysis.medicines.find((item) => item.id === state.selectedMedicineId);
    return medicine ? `<div class="overlay drawer-overlay" data-action="close-overlay"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Medicine details" data-stop-overlay>${renderMedicineDrawer(medicine)}</aside></div>` : '';
  }
  if (state.selectedFindingId && state.analysis) {
    const finding = state.analysis.findings.find((item) => item.id === state.selectedFindingId);
    return finding ? `<div class="overlay" data-action="close-overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="Evidence details" data-stop-overlay>${renderEvidenceModal(finding)}</div></div>` : '';
  }
  return '';
}

function renderMedicineDrawer(medicine) {
  const match = MATCH_META[medicine.matchStatus] || MATCH_META.unmatched;
  const associatedFindings = state.analysis?.findings.filter((finding) => finding.affectedMedicineIds?.includes(medicine.id)) || [];
  return `
    <div class="drawer-header">
      <div class="drawer-title"><span class="eyebrow">Medicine details</span><h2>${escapeHtml(medicine.originalName)}</h2><span class="badge ${match.tone}">${escapeHtml(match.label)}</span></div>
      <button class="button button-ghost button-small" data-action="close-overlay" type="button" aria-label="Close medicine details">${icon('close', '', 17)}</button>
    </div>
    <div class="drawer-body">
      ${medicine.matchStatus === 'unmatched' ? `<div class="missing-evidence">We couldn't confidently identify this medicine from the available dataset. Please verify the name and details with a qualified pharmacist or healthcare professional.</div>` : ''}
      ${medicine.matchStatus === 'ambiguous' ? `<div class="missing-evidence">This entry has multiple candidate matches. No candidate is treated as confirmed until you explicitly select one.</div>` : ''}
      <section class="drawer-section"><div class="drawer-section-title">Identity</div><div class="key-value-list"><div class="key-value"><span class="key">Original input</span><span class="value">${escapeHtml(medicine.originalName)}</span></div><div class="key-value"><span class="key">Generic name</span><span class="value">${escapeHtml(medicine.genericName || 'Not supplied')}</span></div><div class="key-value"><span class="key">Strength</span><span class="value">${escapeHtml(medicine.strength || 'Not supplied')}</span></div><div class="key-value"><span class="key">Confidence</span><span class="value">${escapeHtml(medicine.confidence || 'Not supplied')}</span></div></div></section>
      <section class="drawer-section"><div class="drawer-section-title">Active ingredients</div>${medicine.ingredients.length ? `<div class="ingredient-list">${medicine.ingredients.map((ingredient) => `<div class="ingredient-item"><span class="ingredient-name">${escapeHtml(ingredient.name)}${ingredient.illustrative ? ' <span class="tag warning">illustrative</span>' : ''}</span><span class="ingredient-strength">${ingredient.strength ?? '—'}${ingredient.unit ? ` ${escapeHtml(ingredient.unit)}` : ''}</span></div>`).join('')}</div>` : '<div class="missing-evidence">No active ingredients were supplied for this match.</div>'}</section>
       <section class="drawer-section"><div class="drawer-section-title">Dosage as entered</div><div class="key-value-list"><div class="key-value"><span class="key">Dose</span><span class="value">${escapeHtml(medicine.dosage.dose || 'Not supplied')}</span></div><div class="key-value"><span class="key">Frequency</span><span class="value">${escapeHtml(medicine.dosage.frequencyLabel || formatFrequency(medicine.dosage.frequency))}</span></div><div class="key-value"><span class="key">Duration</span><span class="value">${medicine.dosage.duration_days ? `${escapeHtml(medicine.dosage.duration_days)} days` : 'Not supplied'}</span></div><div class="key-value"><span class="key">Instructions</span><span class="value">${escapeHtml(medicine.dosage.instructions || 'Not supplied')}</span></div></div></section>
       ${medicine.assumptions?.length || medicine.reviewNote ? `<section class="drawer-section"><div class="drawer-section-title">Assumptions & uncertainty</div>${medicine.assumptions?.length ? `<ul class="about-list">${medicine.assumptions.map((assumption) => `<li>${escapeHtml(assumption)}</li>`).join('')}</ul>` : ''}${medicine.reviewNote ? `<div class="missing-evidence">${escapeHtml(medicine.reviewNote)}</div>` : ''}</section>` : ''}
      ${medicine.candidates.length ? `<section class="drawer-section"><div class="drawer-section-title">Candidate matches</div><div class="candidate-list">${medicine.candidates.map((candidate) => `<div class="candidate-item"><div class="candidate-heading"><span class="candidate-name">${escapeHtml(candidate.name)}</span><button class="button button-secondary button-small" data-action="confirm-candidate" data-medicine-id="${escapeHtml(medicine.id)}" data-candidate-id="${escapeHtml(candidate.id)}" type="button">Select</button></div><div class="candidate-meta">${escapeHtml(candidate.genericName || 'Generic name not supplied')} · ${escapeHtml(candidate.strength || 'Strength not supplied')}</div></div>`).join('')}</div></section>` : ''}
      <section class="drawer-section"><div class="drawer-section-title">Associated findings</div>${associatedFindings.length ? `<div class="candidate-list">${associatedFindings.map((finding) => `<button class="medicine-summary-button" data-action="view-finding" data-finding-id="${escapeHtml(finding.id)}" type="button"><span><span class="medicine-summary-name">${escapeHtml(finding.title)}</span><span class="medicine-summary-status">${escapeHtml((SEVERITY_META[finding.severity] || SEVERITY_META.needs_review).label)}</span></span>${icon('chevronRight', '', 14)}</button>`).join('')}</div>` : '<div class="section-description">No findings are linked to this medicine in the response.</div>'}</section>
      <section class="drawer-section"><div class="drawer-section-title">Source information</div>${renderSourceList(medicine.sources)}</section>
    </div>
  `;
}

function renderEvidenceModal(finding) {
  return `
    <div class="modal-header"><div class="modal-header-copy"><span class="eyebrow">Evidence & sources</span><h2>${escapeHtml(finding.title)}</h2><span class="finding-type">${escapeHtml(finding.category.replaceAll('_', ' '))}</span></div><button class="button button-ghost button-small" data-action="close-overlay" type="button" aria-label="Close evidence panel">${icon('close', '', 17)}</button></div>
    <div class="modal-body">
      <div class="evidence-highlight">${escapeHtml(finding.description)}</div>
      <section class="drawer-section"><div class="drawer-section-title">Affected medicines</div><div class="finding-details">${finding.affectedMedicines?.length ? finding.affectedMedicines.map((medicine) => `<span class="finding-pill">${icon('clipboard', '', 13)} ${escapeHtml(medicine)}</span>`).join('') : '<span class="section-description">Not supplied</span>'}</div></section>
      <section class="drawer-section"><div class="drawer-section-title">Ingredients involved</div><div class="finding-details">${finding.ingredients?.length ? finding.ingredients.map((ingredient) => `<span class="finding-pill">${icon('database', '', 13)} ${escapeHtml(ingredient)}</span>`).join('') : '<span class="section-description">Not supplied</span>'}</div></section>
      <section class="drawer-section"><div class="drawer-section-title">Evidence supplied by the API</div>${finding.evidence.length ? `<div class="source-list">${renderSourceList(finding.evidence)}</div>` : '<div class="missing-evidence">No verified supporting source is available for this finding. It requires further review.</div>'}</section>
      ${finding.reviewNote ? `<div class="help-note">${icon('info', '', 15)}<span>${escapeHtml(finding.reviewNote)}</span></div>` : ''}
    </div>
    <div class="modal-footer"><button class="button button-secondary button-small" data-action="close-overlay" type="button">Close</button></div>
  `;
}

function renderSourceList(sources) {
  if (!sources?.length) return '<div class="missing-evidence">No verified supporting source is available for this item.</div>';
  return `<div class="source-list">${sources.map((source) => `<div class="source-item"><div class="source-name">${escapeHtml(source.name || 'Unnamed source')}</div>${source.statement ? `<div class="source-statement">${escapeHtml(source.statement)}</div>` : ''}${source.verificationDate ? `<div class="source-limitations">Verified: ${escapeHtml(source.verificationDate)}</div>` : ''}${source.limitations ? `<div class="source-limitations">Limitations: ${escapeHtml(source.limitations)}</div>` : ''}${source.url ? `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Open source ${icon('external', '', 12)}</a>` : '<div class="source-limitations">No external URL supplied.</div>'}</div>`).join('')}</div>`;
}

function renderErrorBanner(message) {
  return `<div class="error-banner">${icon('alert', '', 16)}<span><strong>Service message:</strong> ${escapeHtml(message)}</span></div>`;
}

function renderResultsPage() {
  if (state.loading) return renderLoadingResults();
  if (state.error && !state.analysis) return renderResultsError();
  if (!state.analysis) return renderNoAnalysis();

  const analysis = state.analysis;
  const summary = analysis.summary;
  const findings = getFilteredFindings();
  return `
    <section class="page">
      <div class="results-header">
        <div class="page-header-copy">
          <div class="eyebrow">Analysis result ${analysis.isDemo ? '· demo data' : '· live API'}</div>
          <h1>Prescription review</h1>
          <div class="results-header-meta">
            <span>${formatDateTime(analysis.analyzedAt)}</span><span>•</span>
            <span>${summary.medicinesSubmitted} ${summary.medicinesSubmitted === 1 ? 'medicine' : 'medicines'} submitted</span><span>•</span>
            <span>${summary.matchedMedicines} matched</span><span>•</span>
            <span>${summary.unmatchedMedicines} needs review</span>
          </div>
        </div>
        <div class="page-actions">
          <button class="button button-secondary" data-action="new-prescription" type="button">${icon('plus', '', 15)} New review</button>
          <button class="button button-ghost" data-action="back-to-editor" type="button">${icon('edit', '', 14)} Edit input</button>
        </div>
      </div>

      ${analysis.demoNotice ? `<div class="help-note" style="margin-bottom: 14px;">${icon('database', '', 15)}<span><strong>DEMO DATA:</strong> ${escapeHtml(analysis.demoNotice)}</span></div>` : ''}
      ${state.error ? renderErrorBanner(state.error) : ''}
      ${renderStatusPanel(analysis)}
      ${analysis.disclaimer ? `<div class="review-disclaimer">${icon('info', '', 15)}<span>${escapeHtml(analysis.disclaimer)}</span></div>` : ''}
      ${renderDuplicationSummary(analysis)}
      ${renderResultMetrics(summary)}
      ${renderSafetyNote()}

      <div class="results-layout">
        <section>
          <div class="findings-toolbar">
            <div class="filter-row" aria-label="Finding filters">
              ${renderFindingFilters(analysis.findings)}
            </div>
            <div class="finding-controls">
              <label class="search-wrap" aria-label="Search findings">
                ${icon('search', '', 14)}
                <input class="input search-input" data-search-findings="true" placeholder="Search findings" value="${escapeHtml(state.searchQuery)}" />
              </label>
              <select class="select sort-select" data-sort-findings aria-label="Sort findings">
                <option value="priority" ${state.sortOrder === 'priority' ? 'selected' : ''}>Priority</option>
                <option value="recent" ${state.sortOrder === 'recent' ? 'selected' : ''}>Newest</option>
                <option value="alphabetical" ${state.sortOrder === 'alphabetical' ? 'selected' : ''}>A–Z</option>
              </select>
            </div>
          </div>
          <div id="finding-list" class="finding-list">${renderFindingCards(findings)}</div>
        </section>
        <aside class="stack">
          ${renderMedicineSummaryCard(analysis)}
          ${renderReviewNotesCard(analysis)}
        </aside>
      </div>
    </section>
  `;
}

function renderStatusPanel(analysis) {
  const tone = analysis.status.code === 'clear' ? 'clear' : analysis.status.code === 'incomplete' ? 'incomplete' : analysis.status.code === 'potential' ? 'potential' : 'attention';
  const statusIcon = analysis.status.code === 'clear' ? 'info' : 'alert';
  return `
    <section class="status-panel tone-${tone}">
      <div class="status-icon">${icon(statusIcon, '', 21)}</div>
      <div class="status-copy">
        <div class="status-title">${escapeHtml(analysis.status.title)}</div>
        <div class="status-description">${escapeHtml(analysis.status.explanation)}</div>
      </div>
      <div class="status-side-note">The result reflects only the response data available for this review.</div>
    </section>
  `;
}

function renderResultMetrics(summary) {
  const alerts = Object.values(summary.alertsBySeverity || {}).reduce((total, value) => total + Number(value || 0), 0);
  return `
    <div class="results-metrics">
      ${renderResultMetric('Submitted', summary.medicinesSubmitted)}
      ${renderResultMetric('Matched', summary.matchedMedicines)}
      ${renderResultMetric('Needs review', summary.unmatchedMedicines)}
      ${renderResultMetric('Findings', alerts)}
      ${renderResultMetric('Overlaps', summary.confirmedIngredientOverlaps)}
    </div>
  `;
}

function renderResultMetric(label, value) {
  return `<article class="result-metric"><div class="result-metric-label">${label}</div><div class="result-metric-value">${escapeHtml(value)}</div></article>`;
}

function renderFindingFilters(findings) {
  const counts = findings.reduce((result, finding) => {
    result[finding.severity] = (result[finding.severity] || 0) + 1;
    return result;
  }, {});
  const filters = [{ key: 'all', label: 'All findings', count: findings.length }];
  Object.keys(SEVERITY_META).forEach((key) => {
    if (counts[key]) filters.push({ key, label: SEVERITY_META[key].label, count: counts[key] });
  });
  return filters.map((filter) => `
    <button class="filter-button ${state.activeFindingFilter === filter.key ? 'active' : ''}" data-action="filter-findings" data-filter="${filter.key}" type="button">
      ${escapeHtml(filter.label)} <span class="filter-count">${filter.count}</span>
    </button>
  `).join('');
}

function renderFindingCards(findings) {
  if (!findings.length) {
    return `<div class="empty-state"><div><div class="empty-state-icon" style="margin-inline: auto;">${icon(state.searchQuery ? 'search' : 'check', '', 19)}</div><div class="empty-state-title">${state.searchQuery ? 'No matching findings' : 'No findings in this view'}</div><div class="empty-state-copy">${state.searchQuery ? 'Try a different search term or clear the search field.' : 'No supported findings were returned for this filter. This is not a statement that the prescription is safe.'}</div></div></div>`;
  }
  return findings.map((finding, index) => renderFindingCard(finding, index)).join('');
}

function renderFindingCard(finding, index = 0) {
  const meta = SEVERITY_META[finding.severity] || SEVERITY_META.needs_review;
  const affectedMedicineId = finding.affectedMedicineIds?.[0];
  const nextStep = finding.action || 'Review this result with a qualified doctor or pharmacist before making any medication decision.';
  return `
    <article class="finding-card tone-${meta.tone} ${index === 0 ? 'primary-finding' : ''}">
      <div class="finding-card-head">
        <div class="finding-card-heading">
          ${index === 0 ? '<span class="finding-priority">Highest priority returned</span>' : ''}
          <span class="badge ${meta.tone}">${icon(meta.icon, '', 11)} ${escapeHtml(meta.label)}</span>
          ${renderFindingConfidence(finding)}
          <div class="finding-type">${escapeHtml(finding.category.replaceAll('_', ' '))}</div>
          <h3 class="finding-title">${escapeHtml(finding.title)}</h3>
        </div>
        ${finding.isDemo ? '<span class="demo-chip">demo</span>' : ''}
      </div>
      <p class="finding-description">${escapeHtml(finding.description)}</p>
      <p class="secondary-text tiny finding-next-step"><strong>Suggested next step:</strong> ${escapeHtml(nextStep)}</p>
      <details class="finding-technical">
        <summary>Technical details</summary>
        <div class="finding-details">
          ${finding.affectedMedicines?.length ? `<span class="finding-pill">${icon('clipboard', '', 13)} ${escapeHtml(finding.affectedMedicines.join(' · '))}</span>` : ''}
          ${finding.ingredients?.length ? `<span class="finding-pill">${icon('database', '', 13)} ${escapeHtml(finding.ingredients.join(' · '))}</span>` : ''}
          ${finding.source ? `<span class="finding-pill">${icon('info', '', 13)} Source: ${escapeHtml(finding.source)}</span>` : ''}
        </div>
        ${finding.reviewNote ? `<p class="technical-note">${escapeHtml(finding.reviewNote)}</p>` : ''}
      </details>
      <div class="finding-actions">
        <span class="evidence-state ${finding.evidenceAvailable ? 'available' : ''}">${icon(finding.evidenceAvailable ? 'check' : 'info', '', 14)} ${finding.evidenceAvailable ? 'Supporting evidence available' : 'No verified evidence attached'}</span>
        <button class="button button-secondary button-small" data-action="view-finding" data-finding-id="${escapeHtml(finding.id)}" type="button">${icon('external', '', 13)} View evidence</button>
        ${affectedMedicineId ? `<button class="button button-ghost button-small" data-action="view-medicine" data-medicine-id="${escapeHtml(affectedMedicineId)}" type="button">${icon('clipboard', '', 13)} Medicine details</button>` : ''}
      </div>
    </article>
  `;
}

function renderFindingConfidence(finding) {
  if (finding.isDemo) return '<span class="evidence-badge illustrative">Illustrative demo fixture</span>';
  if (finding.source?.startsWith('rules.') || finding.source === 'duplicate_check') return '<span class="evidence-badge rule">Rule-supported match</span>';
  if (finding.source?.startsWith('dataset.')) return '<span class="evidence-badge dataset">Dataset signal — verify</span>';
  return '<span class="evidence-badge uncertain">Needs verification</span>';
}

function renderDuplicationSummary(analysis) {
  const overlaps = analysis.findings.filter((finding) => ['duplicate_ingredient', 'class_duplication'].includes(finding.category));
  if (!overlaps.length) return '';
  return `
    <section class="duplication-summary" aria-label="Potential medication duplication">
      <div class="duplication-summary-icon">${icon('alert', '', 18)}</div>
      <div class="duplication-summary-copy">
        <div class="duplication-summary-heading"><span class="duplication-summary-title">Potential duplication or overlapping therapy</span><span class="badge warning">Human review</span></div>
        <p>${overlaps.map((finding) => escapeHtml(finding.description)).join(' ')}</p>
        <div class="duplication-summary-meta">${overlaps.map((finding) => `<span>${icon('clipboard', '', 12)} ${escapeHtml((finding.affectedMedicines || []).join(' · ') || 'Medicines not supplied')}</span>`).join('')}</div>
        <small>These are rule-supported or illustrative matches, not a clinical conclusion. Similar medicine names alone do not prove duplicate therapy. Verify the complete prescription with a doctor or pharmacist.</small>
      </div>
    </section>
  `;
}

function renderMedicineSummaryCard(analysis) {
  return `
    <section class="card card-body side-card">
      <div class="side-card-header"><div><div class="side-card-title">Medicine matches</div><div class="side-card-copy">Open an entry to inspect ingredients, dosage text and match confidence.</div></div>${icon('clipboard', '', 17)}</div>
      <div class="medicine-summary-list">
        ${analysis.medicines.map((medicine) => {
          const match = MATCH_META[medicine.matchStatus] || MATCH_META.unmatched;
          return `<button class="medicine-summary-button" data-action="view-medicine" data-medicine-id="${escapeHtml(medicine.id)}" type="button"><span><span class="medicine-summary-name">${escapeHtml(medicine.originalName)}</span><span class="medicine-summary-status">${escapeHtml(match.label)}${medicine.confidence ? ` · ${escapeHtml(medicine.confidence)} confidence` : ''}</span></span>${icon('chevronRight', '', 14)}</button>`;
        }).join('')}
      </div>
    </section>
  `;
}

function renderReviewNotesCard(analysis) {
  const notes = analysis.medicines.filter((medicine) => medicine.reviewNote).map((medicine) => `<li><strong>${escapeHtml(medicine.originalName)}:</strong> ${escapeHtml(medicine.reviewNote)}</li>`);
  const hasUnmatched = analysis.summary.unmatchedMedicines > 0;
  return `
    <section class="card card-body side-card">
      <div class="side-card-header"><div><div class="side-card-title">Review notes</div><div class="side-card-copy">Uncertainty is preserved instead of silently resolved.</div></div>${icon('info', '', 17)}</div>
      ${notes.length || hasUnmatched ? `<ul class="about-list">${notes.join('')}${hasUnmatched && !notes.length ? '<li>One or more entries still need manual confirmation.</li>' : ''}</ul>` : '<div class="empty-state" style="min-height: 120px;"><div><div class="empty-state-title">No extra notes</div><div class="empty-state-copy">The response did not attach additional review notes.</div></div></div>'}
    </section>
  `;
}

function renderLoadingResults() {
  return `
    <section class="page compact-page">
      <div class="page-header">
        <div class="page-header-copy"><div class="eyebrow">Analysis in progress</div><h1>Reading the prescription.</h1><p class="lead">MediTrace is matching brand names, expanding ingredients and preparing a review. Nothing is being silently inferred.</p></div>
      </div>
      <div class="card card-body">
        <div class="loading-stack">
          <div class="skeleton loading-line medium"></div>
          <div class="skeleton loading-line"></div>
          <div class="skeleton loading-line short"></div>
          <div style="height: 12px;"></div>
          <div class="skeleton" style="height: 120px;"></div>
          <div class="skeleton" style="height: 96px;"></div>
        </div>
      </div>
    </section>
  `;
}

function renderResultsError() {
  return `
    <section class="page compact-page">
      <div class="page-header">
        <div class="page-header-copy"><div class="eyebrow">Review unavailable</div><h1>The analysis did not complete.</h1><p class="lead">No partial clinical conclusion is shown when the service fails. You can retry or use a clearly labelled demo scenario.</p></div>
        <div class="page-actions"><button class="button button-secondary" data-action="back-to-editor" type="button">${icon('edit', '', 14)} Back to editor</button><button class="button button-primary" data-action="run-demo" type="button">${icon('spark', '', 14)} Run demo scenario</button></div>
      </div>
      ${renderErrorBanner(state.error || 'The analysis service is unavailable.')}
    </section>
  `;
}

function renderNoAnalysis() {
  return `
    <section class="page compact-page">
      <div class="empty-state"><div><div class="empty-state-icon" style="margin-inline: auto;">${icon('clipboard', '', 19)}</div><div class="empty-state-title">No analysis loaded</div><div class="empty-state-copy">Start a new prescription review to see matched medicines, findings and evidence.</div><button class="button button-primary button-small" data-action="new-prescription" type="button" style="margin-top: 14px;">${icon('plus', '', 14)} Start review</button></div></div>
    </section>
  `;
}
