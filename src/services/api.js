import { buildDemoResponse } from './mockData.js';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 15000;

const FRONTEND_SEVERITIES = new Set(['critical', 'high', 'moderate', 'informational', 'needs_review']);

/**
 * Returns the configured API base URL. An empty string intentionally means that
 * the app should stay in demo mode unless the caller explicitly requests live mode.
 */
export function getApiBaseUrl() {
  const runtimeConfig = typeof globalThis !== 'undefined' ? globalThis.__MEDITRACE_CONFIG__ : undefined;
  const runtimeBaseUrl = runtimeConfig?.API_BASE_URL;
  const buildBaseUrl = import.meta.env?.VITE_API_BASE_URL;
  return String(runtimeBaseUrl || buildBaseUrl || '').trim().replace(/\/$/, '');
}

export function isLiveApiConfigured() {
  return Boolean(getApiBaseUrl());
}

/**
 * Converts the frontend form into the FastAPI POST /check contract.
 * Missing age remains null; it is never guessed or defaulted.
 */
export function serializeRequest(form) {
  const normalized = normalizeForm(form);

  return {
    text: normalized.medicines.map(medicineToText).filter(Boolean).join('\n'),
    patient: {
      age: toNumberOrNull(normalized.patient.age_years),
      weight_kg: toNumberOrNull(normalized.patient.weight_kg),
      egfr: null,
      liver_impairment: false,
      pregnant: false
    },
    confirmed_matches: {},
    use_llm: false
  };
}

/**
 * Runs either the existing labelled demo fixtures or the live FastAPI check.
 * `mode: 'live'` uses localhost:8000 even when no build/runtime URL is set.
 */
export async function checkPrescription(
  form,
  { mode = 'auto', scenarioId = 'duplicate', confirmedMatches = {}, useLlm = false } = {}
) {
  const frontendRequest = normalizeForm(form);
  const backendRequest = serializeRequest(frontendRequest);
  const liveConfigured = isLiveApiConfigured();

  if (mode === 'demo' || (!liveConfigured && mode !== 'live')) {
    await wait(350);
    if (scenarioId === 'error') {
      throw new Error('MediTrace demo service error: simulated API unavailable.');
    }
    return normalizeResponse(buildDemoResponse(scenarioId, frontendRequest), {
      mode: 'demo',
      requestEcho: frontendRequest
    });
  }

  validateLiveRequest(backendRequest);

  const request = {
    ...backendRequest,
    confirmed_matches: isPlainObject(confirmedMatches) ? confirmedMatches : {},
    use_llm: Boolean(useLlm)
  };
  const baseUrl = getApiBaseUrl() || DEFAULT_API_BASE_URL;
  const endpoint = `${baseUrl}/check`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    const { body, parseError } = await readJsonResponse(response);

    if (parseError) {
      throw new Error(`The analysis service returned invalid JSON (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(formatHttpError(response.status, body));
    }

    return normalizeResponse(body, {
      mode: 'live',
      requestEcho: frontendRequest,
      backendRequest: request
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The analysis service timed out after 15 seconds. Check that FastAPI is running and try again.');
    }
    if (error instanceof TypeError) {
      throw new Error(`Could not reach the analysis service at ${endpoint}. Check that FastAPI is running and CORS is configured.`);
    }
    throw new Error(error?.message || 'The analysis service is unavailable.');
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeForm(form) {
  const patient = form?.patient || {};
  const medicines = Array.isArray(form?.medicines) ? form.medicines : [];

  return {
    patient: {
      age_years: patient.age_years ?? patient.age ?? '',
      weight_kg: patient.weight_kg ?? patient.weight ?? '',
      kidney_condition: patient.kidney_condition || 'unknown'
    },
    medicines: medicines.map((medicine) => ({
      name: stringValue(medicine?.name),
      strength: stringValue(medicine?.strength),
      dose: stringValue(medicine?.dose),
      frequency: stringValue(medicine?.frequency),
      duration_days: toNumberOrNull(medicine?.duration_days),
      instructions: stringValue(medicine?.instructions)
    }))
  };
}

function medicineToText(medicine) {
  const parts = [medicine.name, medicine.strength, medicine.dose, medicine.frequency];
  const text = parts.filter(Boolean).join(' ');
  const duration = medicine.duration_days !== null ? `x ${medicine.duration_days}d` : '';
  const instructions = medicine.instructions;
  return [text, duration, instructions].filter(Boolean).join(' ').trim();
}

function validateLiveRequest(request) {
  if (request.patient.age === null) {
    throw new Error('Patient age is required for a live prescription check. Enter age in years or choose demo mode.');
  }
  if (!request.text.trim()) {
    throw new Error('Enter at least one medicine before checking the prescription.');
  }
}

function normalizeResponse(raw, context = {}) {
  const backendItems = Array.isArray(raw?.items) ? raw.items : [];
  const demoMedicines = Array.isArray(raw?.medicines) ? raw.medicines : [];
  const sourceMedicines = backendItems.length ? backendItems : demoMedicines;
  const requestMedicines = context.requestEcho?.medicines || [];
  const medicines = sourceMedicines.map((item, index) => normalizeMedicine(item, index, requestMedicines[index]));

  const rawAlerts = Array.isArray(raw?.alerts) ? raw.alerts : [];
  const rawFindings = Array.isArray(raw?.findings) ? raw.findings : [];
  const findings = rawAlerts.length
    ? rawAlerts.map((alert, index) => normalizeBackendAlert(alert, index, medicines, raw?.disclaimer))
    : rawFindings.map((finding, index) => normalizeFrontendFinding(finding, index));

  attachFindingIds(medicines, findings);

  const backendSummary = raw?.summary || {};
  const fallbackNeedsReview = medicines.filter((medicine) => ['ambiguous', 'unmatched'].includes(medicine.matchStatus)).length;
  const unmatchedMedicines = Number(backendSummary.unmatched ?? fallbackNeedsReview);
  const needsConfirmation = Number(backendSummary.needs_confirmation ?? medicines.filter((medicine) => medicine.matchStatus === 'ambiguous').length);
  const reviewCount = unmatchedMedicines + needsConfirmation;
  const matchedMedicines = Math.max(0, medicines.length - reviewCount);
  const alertsBySeverity = buildFrontendSeverityCounts(findings);
  const confirmedIngredientOverlaps = findings.filter((finding) => finding.category === 'duplicate_ingredient').length;

  return {
    mode: raw?.mode || context.mode || 'live',
    isDemo: Boolean(raw?.isDemo || context.mode === 'demo'),
    scenarioId: raw?.scenarioId || null,
    scenarioLabel: raw?.scenarioLabel || null,
    demoNotice: raw?.demoNotice || null,
    analyzedAt: raw?.analyzedAt || new Date().toISOString(),
    requestEcho: context.requestEcho || null,
    backendRequest: context.backendRequest || null,
    patient: raw?.patient || context.backendRequest?.patient || null,
    totals: isPlainObject(raw?.totals) ? raw.totals : {},
    notes: Array.isArray(raw?.notes) ? raw.notes.map(String) : [],
    disclaimer: raw?.disclaimer ? String(raw.disclaimer) : null,
    status: normalizeStatus(findings, reviewCount),
    medicines,
    findings,
    summary: {
      medicinesSubmitted: Number(backendSummary.medicinesSubmitted ?? medicines.length ?? requestMedicines.length),
      matchedMedicines,
      unmatchedMedicines: reviewCount,
      needsConfirmation,
      alertsBySeverity,
      confirmedIngredientOverlaps,
      backendAlertsBySeverity: {
        critical: Number(backendSummary.critical || 0),
        warning: Number(backendSummary.warning || 0),
        info: Number(backendSummary.info || 0)
      },
      backendUnmatched: Number(backendSummary.unmatched || 0)
    }
  };
}

function normalizeMedicine(item, index, enteredMedicine = {}) {
  const isBackendItem = Object.prototype.hasOwnProperty.call(item || {}, 'match');
  if (!isBackendItem) return normalizeDemoMedicine(item, index);

  const matched = Boolean(item.match);
  const matchStatus = !matched ? 'unmatched' : item.needs_confirmation ? 'ambiguous' : 'exact';
  const dose = item.dose || {};
  const originalName = enteredMedicine.name || item.raw || item.brand_query || 'Unnamed medicine';

  return {
    id: `medicine-${index + 1}`,
    originalName,
    enteredBrand: originalName,
    matchStatus,
    genericName: item.match ? String(item.match) : null,
    strength: enteredMedicine.strength || null,
    manufacturer: item.manufacturer || null,
    discontinued: typeof item.discontinued === 'boolean' ? item.discontinued : null,
    confidence: item.confidence ?? null,
    needsConfirmation: Boolean(item.needs_confirmation),
    candidates: Array.isArray(item.candidates)
      ? item.candidates.map((candidate, candidateIndex) => ({
          id: `candidate-${index + 1}-${candidateIndex + 1}`,
          name: String(candidate?.name || 'Candidate match'),
          confidence: candidate?.confidence ?? null,
          genericName: null,
          strength: enteredMedicine.strength || null,
          ingredients: []
        }))
      : [],
    ingredients: Array.isArray(item.ingredients) ? item.ingredients.map(normalizeBackendIngredient) : [],
    dosage: {
      name: enteredMedicine.name || item.brand_query || '',
      strength: enteredMedicine.strength || '',
      dose: enteredMedicine.dose || '',
      frequency: dose.frequency || enteredMedicine.frequency || '',
      frequencyLabel: null,
      duration_days: dose.duration_days ?? enteredMedicine.duration_days ?? null,
      instructions: enteredMedicine.instructions || '',
      quantity: dose.quantity ?? null,
      volume_ml: dose.volume_ml ?? null,
      estimatedDailyDoses: item.daily_doses ?? null
    },
    assumptions: Array.isArray(item.assumptions) ? item.assumptions.map(String) : [],
    findingIds: [],
    reviewNote: !matched
      ? 'This medicine could not be confidently matched by the available backend dataset.'
      : item.needs_confirmation
        ? 'The backend returned a low-confidence match. Confirm the medicine before relying on ingredient checks.'
        : null,
    sources: []
  };
}

function normalizeDemoMedicine(medicine, index) {
  return {
    id: String(medicine?.id || `medicine-${index + 1}`),
    originalName: String(medicine?.originalName || medicine?.enteredBrand || medicine?.name || 'Unnamed medicine'),
    enteredBrand: String(medicine?.enteredBrand || medicine?.originalName || medicine?.name || 'Unnamed medicine'),
    matchStatus: ['exact', 'alias', 'ambiguous', 'unmatched'].includes(medicine?.matchStatus) ? medicine.matchStatus : 'unmatched',
    genericName: medicine?.genericName ? String(medicine.genericName) : null,
    strength: medicine?.strength ? String(medicine.strength) : null,
    ingredients: Array.isArray(medicine?.ingredients) ? medicine.ingredients.map(normalizeDemoIngredient) : [],
    dosage: {
      ...(medicine?.dosage || {}),
      name: medicine?.dosage?.name ? String(medicine.dosage.name) : '',
      strength: medicine?.dosage?.strength ? String(medicine.dosage.strength) : '',
      dose: medicine?.dosage?.dose ? String(medicine.dosage.dose) : '',
      frequency: medicine?.dosage?.frequency ? String(medicine.dosage.frequency) : '',
      frequencyLabel: medicine?.dosage?.frequencyLabel ? String(medicine.dosage.frequencyLabel) : null,
      duration_days: medicine?.dosage?.duration_days ?? null,
      instructions: medicine?.dosage?.instructions ? String(medicine.dosage.instructions) : '',
      estimatedDailyDoses: medicine?.dosage?.estimatedDailyDoses ?? null
    },
    confidence: medicine?.confidence ?? null,
    candidates: Array.isArray(medicine?.candidates) ? medicine.candidates : [],
    assumptions: [],
    findingIds: Array.isArray(medicine?.findingIds) ? medicine.findingIds.map(String) : [],
    reviewNote: medicine?.reviewNote ? String(medicine.reviewNote) : null,
    sources: Array.isArray(medicine?.sources) ? medicine.sources.map(normalizeEvidence) : []
  };
}

function normalizeBackendIngredient(ingredient) {
  return {
    name: String(ingredient?.name || 'Unnamed ingredient'),
    strength: ingredient?.mg ?? null,
    unit: ingredient?.unit || (ingredient?.mg !== null && ingredient?.mg !== undefined ? 'mg' : null),
    perMl: ingredient?.per_ml ?? null,
    perDoseMg: ingredient?.per_dose_mg ?? null,
    dailyMg: ingredient?.daily_mg ?? null,
    topical: Boolean(ingredient?.topical),
    verified: null,
    illustrative: false
  };
}

function normalizeDemoIngredient(ingredient) {
  if (typeof ingredient === 'string') return { name: ingredient, strength: null, unit: null, verified: null, illustrative: false };
  return {
    name: String(ingredient?.name || 'Unnamed ingredient'),
    strength: ingredient?.strength ?? null,
    unit: ingredient?.unit ? String(ingredient.unit) : null,
    verified: typeof ingredient?.verified === 'boolean' ? ingredient.verified : null,
    illustrative: Boolean(ingredient?.illustrative)
  };
}

function normalizeBackendAlert(alert, index, medicines, disclaimer) {
  const backendSeverity = String(alert?.tier || 'info').toLowerCase();
  const severity = mapBackendSeverity(backendSeverity, alert?.type);
  const affectedMedicines = Array.isArray(alert?.items) ? alert.items.map(String) : [];
  const evidence = alert?.source
    ? [{
        name: String(alert.source),
        url: null,
        verificationDate: null,
        statement: alert?.message ? String(alert.message) : null,
        limitations: disclaimer ? String(disclaimer) : null
      }]
    : [];

  return {
    id: String(alert?.id || `finding-${index + 1}`),
    severity,
    backendSeverity,
    category: String(alert?.type || 'needs_review'),
    title: humanizeAlertType(alert?.type),
    description: String(alert?.message || 'The backend returned an alert without a message.'),
    affectedMedicineIds: medicines
      .filter((medicine) => affectedMedicines.some((affected) => namesReferToSameMedicine(affected, medicine)))
      .map((medicine) => medicine.id),
    affectedMedicines,
    ingredients: Array.isArray(alert?.ingredients) ? alert.ingredients.map(String) : [],
    action: null,
    reviewNote: alert?.source ? `Traceable backend source: ${String(alert.source)}` : 'No source identifier was supplied for this alert.',
    evidenceAvailable: evidence.length > 0,
    evidence,
    source: alert?.source ? String(alert.source) : null,
    isDemo: false,
    demoLabel: null
  };
}

function normalizeFrontendFinding(finding, index) {
  const severity = FRONTEND_SEVERITIES.has(finding?.severity) ? finding.severity : 'needs_review';
  return {
    id: String(finding?.id || `finding-${index + 1}`),
    severity,
    backendSeverity: null,
    category: String(finding?.category || 'needs_review'),
    title: String(finding?.title || 'Finding needs review'),
    description: String(finding?.description || finding?.explanation || 'The service returned a finding without a detailed explanation.'),
    affectedMedicineIds: Array.isArray(finding?.affectedMedicineIds) ? finding.affectedMedicineIds.map(String) : [],
    affectedMedicines: Array.isArray(finding?.affectedMedicines) ? finding.affectedMedicines.map(String) : [],
    ingredients: Array.isArray(finding?.ingredients) ? finding.ingredients.map(String) : [],
    action: finding?.action ? String(finding.action) : null,
    reviewNote: finding?.reviewNote ? String(finding.reviewNote) : null,
    evidenceAvailable: Boolean(finding?.evidenceAvailable || (Array.isArray(finding?.evidence) && finding.evidence.length)),
    evidence: Array.isArray(finding?.evidence) ? finding.evidence.map(normalizeEvidence) : [],
    source: null,
    isDemo: Boolean(finding?.isDemo),
    demoLabel: finding?.demoLabel ? String(finding.demoLabel) : null
  };
}

function normalizeEvidence(evidence) {
  return {
    name: evidence?.name ? String(evidence.name) : null,
    url: validUrl(evidence?.url),
    verificationDate: evidence?.verificationDate ? String(evidence.verificationDate) : null,
    statement: evidence?.statement ? String(evidence.statement) : null,
    limitations: evidence?.limitations ? String(evidence.limitations) : null
  };
}

function attachFindingIds(medicines, findings) {
  medicines.forEach((medicine) => {
    const related = findings.filter((finding) =>
      finding.affectedMedicineIds.includes(medicine.id) ||
      finding.affectedMedicines.some((affected) => namesReferToSameMedicine(affected, medicine))
    );
    medicine.findingIds = [...new Set([...medicine.findingIds, ...related.map((finding) => finding.id)])];
  });
}

function namesReferToSameMedicine(value, medicine) {
  const affected = String(value || '').trim().toLowerCase();
  const entered = String(medicine?.originalName || medicine?.enteredBrand || '').trim().toLowerCase();
  return Boolean(affected && entered && (affected === entered || affected.includes(entered) || entered.includes(affected)));
}

function normalizeStatus(findings, reviewCount) {
  if (reviewCount > 0) {
    return {
      code: 'incomplete',
      title: 'Review incomplete — confirmation is needed',
      explanation: 'Some entries could not be fully checked from the available match and patient information.'
    };
  }
  if (findings.length > 0) {
    return {
      code: 'attention',
      title: 'Findings require attention',
      explanation: 'The available documented rules returned findings that should be reviewed with a qualified healthcare professional.'
    };
  }
  return {
    code: 'clear',
    title: 'No supported findings were returned',
    explanation: 'No findings were returned by the available rules. This is not a statement that the prescription is safe.'
  };
}

function buildFrontendSeverityCounts(findings) {
  return findings.reduce((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    return counts;
  }, {});
}

function mapBackendSeverity(tier, type) {
  if (type === 'unmatched_brand' || type === 'weight_needed' || type === 'paediatric_unverified') return 'needs_review';
  if (tier === 'critical') return 'critical';
  if (tier === 'warning') return 'high';
  return 'informational';
}

function humanizeAlertType(type) {
  const label = String(type || 'needs_review').replaceAll('_', ' ');
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) return { body: null, parseError: false };
  try {
    return { body: JSON.parse(text), parseError: false };
  } catch {
    return { body: null, parseError: true };
  }
}

function formatHttpError(status, body) {
  const detail = body?.detail ?? body?.message ?? body?.error;
  if (typeof detail === 'string' && detail.trim()) return `Analysis request failed (HTTP ${status}): ${detail}`;
  if (Array.isArray(detail)) return `Analysis request failed (HTTP ${status}): ${detail.map(formatValidationDetail).join('; ')}`;
  return `Analysis request failed with HTTP ${status}.`;
}

function formatValidationDetail(detail) {
  if (typeof detail === 'string') return detail;
  if (detail?.msg) return `${detail.loc ? `${detail.loc.join('.')} — ` : ''}${detail.msg}`;
  return JSON.stringify(detail);
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringValue(value) {
  return String(value ?? '').trim();
}

function validUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
