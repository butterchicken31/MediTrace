export const FREQUENCY_OPTIONS = [
  { value: 'OD', label: 'OD — once daily' },
  { value: 'BD', label: 'BD — twice daily' },
  { value: 'TDS', label: 'TDS — three times daily' },
  { value: 'QID', label: 'QID — four times daily' },
  { value: 'SOS', label: 'SOS — as needed' },
  { value: 'Other', label: 'Other / unclear' }
];

export const KIDNEY_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_provided', label: 'Not provided' }
];

export const SEVERITY_META = {
  critical: { label: 'Critical', tone: 'critical', icon: 'alert' },
  high: { label: 'High', tone: 'high', icon: 'alert' },
  moderate: { label: 'Moderate', tone: 'moderate', icon: 'alert' },
  informational: { label: 'Informational', tone: 'informational', icon: 'info' },
  needs_review: { label: 'Needs review', tone: 'needs-review', icon: 'info' }
};

export const MATCH_META = {
  exact: { label: 'Exact match', tone: 'success' },
  alias: { label: 'Alias match', tone: 'info' },
  ambiguous: { label: 'Ambiguous', tone: 'warning' },
  unmatched: { label: 'Unmatched', tone: 'danger' }
};

export function formatDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatShortDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatFrequency(value, fallback = 'Not provided') {
  const option = FREQUENCY_OPTIONS.find((item) => item.value === value);
  return option ? option.label.split(' — ')[1] : fallback;
}

export function formatIngredient(ingredient) {
  if (!ingredient) return 'Ingredient not available';
  const strength = ingredient.strength !== null && ingredient.strength !== undefined && ingredient.strength !== '' ? ` ${ingredient.strength}${ingredient.unit ? ` ${ingredient.unit}` : ''}` : '';
  return `${ingredient.name}${strength}`;
}

export function statusLabel(code) {
  if (code === 'clear') return 'No known findings';
  if (code === 'incomplete') return 'Review incomplete';
  if (code === 'potential') return 'Potential issues';
  return 'Requires attention';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
