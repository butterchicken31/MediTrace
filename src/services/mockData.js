const syntheticSource = {
  name: 'MediTrace illustrative fixture',
  url: null,
  verificationDate: null,
  statement: 'Synthetic demonstration content created to exercise the MediTrace interface. It is not a clinical reference.',
  limitations: 'Do not use this fixture to make medication decisions.'
};

const demoScenarios = {
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate ingredient',
    shortLabel: 'Duplicate ingredient',
    description: 'Two illustrative brands resolve to the same active ingredient.',
    notice: 'Illustrative duplicate-ingredient fixture — not a clinical conclusion.',
    prescription: [
      { name: 'Nivora-P 500', strength: '500 mg', dose: '1 tablet', frequency: 'BD', duration_days: 5, instructions: '' },
      { name: 'Feverdown 650', strength: '650 mg', dose: '1 tablet', frequency: 'SOS', duration_days: 3, instructions: 'Use only as directed in the original prescription.' },
      { name: 'Gastrocalm 20', strength: '20 mg', dose: '1 capsule', frequency: 'OD', duration_days: 5, instructions: '' }
    ],
    patient: { age_years: 34, weight_kg: 68, kidney_condition: 'unknown' }
  },
  interaction: {
    id: 'interaction',
    label: 'Synthetic interaction',
    shortLabel: 'Synthetic interaction',
    description: 'A clearly marked synthetic interaction finding for presentation testing.',
    notice: 'Synthetic interaction fixture — not a verified clinical interaction.',
    prescription: [
      { name: 'Axion-B 10', strength: '10 mg', dose: '1 tablet', frequency: 'OD', duration_days: 7, instructions: '' },
      { name: 'CardioNex 25', strength: '25 mg', dose: '1 tablet', frequency: 'BD', duration_days: 7, instructions: '' }
    ],
    patient: { age_years: 52, weight_kg: 74, kidney_condition: 'not_provided' }
  },
  unknown: {
    id: 'unknown',
    label: 'Unknown medicine',
    shortLabel: 'Unknown medicine',
    description: 'One brand is not present in the illustrative dataset and needs manual review.',
    notice: 'Illustrative unknown-medicine fixture — verify every medicine with a qualified professional.',
    prescription: [
      { name: 'Zentovar XR', strength: 'unknown', dose: '1 tablet', frequency: 'OD', duration_days: 10, instructions: '' },
      { name: 'Gastrocalm 20', strength: '20 mg', dose: '1 capsule', frequency: 'OD', duration_days: 10, instructions: '' }
    ],
    patient: { age_years: 41, weight_kg: null, kidney_condition: 'unknown' }
  },
  ambiguous: {
    id: 'ambiguous',
    label: 'Ambiguous match',
    shortLabel: 'Ambiguous match',
    description: 'A close brand match has two candidates and cannot be confirmed silently.',
    notice: 'Illustrative ambiguity fixture — no candidate is treated as confirmed until selected.',
    prescription: [
      { name: 'Mediq 10', strength: '10 mg', dose: '1 tablet', frequency: 'OD', duration_days: 14, instructions: '' },
      { name: 'Clearline 40', strength: '40 mg', dose: '1 tablet', frequency: 'OD', duration_days: 14, instructions: '' }
    ],
    patient: { age_years: 29, weight_kg: 59, kidney_condition: 'no' }
  },
  clear: {
    id: 'clear',
    label: 'No known findings',
    shortLabel: 'No known findings',
    description: 'The available illustrative dataset has no findings for this sample.',
    notice: 'Illustrative no-findings fixture — no clinical safety conclusion is implied.',
    prescription: [
      { name: 'Clearline 40', strength: '40 mg', dose: '1 tablet', frequency: 'OD', duration_days: 14, instructions: 'Take as written in the original prescription.' },
      { name: 'Nourish-OR', strength: '200 ml', dose: '1 bottle', frequency: 'SOS', duration_days: 2, instructions: '' }
    ],
    patient: { age_years: 26, weight_kg: 61, kidney_condition: 'no' }
  },
  incomplete: {
    id: 'incomplete',
    label: 'Incomplete review',
    shortLabel: 'Incomplete review',
    description: 'A review item is returned because required context is unavailable.',
    notice: 'Illustrative incomplete-analysis fixture — missing context limits what can be assessed.',
    prescription: [
      { name: 'Renalix 20', strength: '20 mg', dose: '1 tablet', frequency: 'OD', duration_days: 30, instructions: '' },
      { name: 'Clearline 40', strength: '40 mg', dose: '1 tablet', frequency: 'OD', duration_days: 30, instructions: '' }
    ],
    patient: { age_years: 67, weight_kg: null, kidney_condition: 'not_provided' }
  },
  error: {
    id: 'error',
    label: 'Simulated API error',
    shortLabel: 'API error',
    description: 'A deterministic failure state for testing recovery and error messaging.',
    notice: 'Simulated service error — no analysis was completed.',
    prescription: [
      { name: 'Clearline 40', strength: '40 mg', dose: '1 tablet', frequency: 'OD', duration_days: 5, instructions: '' }
    ],
    patient: { age_years: 45, weight_kg: 70, kidney_condition: 'unknown' }
  }
};

function sourceList() {
  return [{ ...syntheticSource }];
}

function medicine({ id, originalName, matchStatus, genericName, strength, ingredients, dosage, confidence, candidates, findingIds = [], reviewNote, sources }) {
  return {
    id,
    originalName,
    enteredBrand: originalName,
    matchStatus,
    genericName: genericName || null,
    strength: strength || null,
    ingredients: ingredients || [],
    dosage,
    confidence: confidence || null,
    candidates: candidates || [],
    findingIds,
    reviewNote: reviewNote || null,
    sources: sources || sourceList()
  };
}

function illustrativeIngredient(name, strength, unit = 'mg') {
  return { name, strength, unit, verified: true, illustrative: true };
}

function finding({ id, severity, category, title, description, affectedMedicineIds, affectedMedicines, ingredients = [], evidence = [], action, reviewNote }) {
  return {
    id,
    severity,
    category,
    title,
    description,
    affectedMedicineIds,
    affectedMedicines,
    ingredients,
    evidence,
    evidenceAvailable: evidence.length > 0,
    action: action || null,
    reviewNote: reviewNote || null,
    isDemo: true,
    demoLabel: 'DEMO DATA'
  };
}

function baseResponse(scenario, payload) {
  return {
    mode: 'demo',
    isDemo: true,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    demoNotice: scenario.notice,
    analyzedAt: new Date().toISOString(),
    requestEcho: payload,
    status: {
      code: 'attention',
      title: 'Findings require attention',
      explanation: 'This prototype found items that should be reviewed with a qualified healthcare professional.'
    },
    medicines: [],
    findings: [],
    summary: {
      medicinesSubmitted: payload.medicines.length,
      matchedMedicines: 0,
      unmatchedMedicines: 0,
      alertsBySeverity: {},
      confirmedIngredientOverlaps: 0
    }
  };
}

function buildDuplicateResponse(scenario, payload) {
  const response = baseResponse(scenario, payload);
  const duplicateFinding = finding({
    id: 'finding-duplicate-01',
    severity: 'high',
    category: 'duplicate_ingredient',
    title: 'Illustrative duplicate ingredient detected',
    description: 'Nivora-P 500 and Feverdown 650 both resolve to the illustrative ingredient “Paracetamol”. Confirm the intended products and total use with a qualified professional.',
    affectedMedicineIds: ['med-duplicate-1', 'med-duplicate-2'],
    affectedMedicines: ['Nivora-P 500', 'Feverdown 650'],
    ingredients: ['Paracetamol (illustrative)'],
    evidence: [{ ...syntheticSource, statement: 'Both fixture records include Paracetamol (illustrative) as an active ingredient.' }],
    action: 'Verify the intended products and the complete daily plan before use.'
  });
  response.medicines = [
    medicine({
      id: 'med-duplicate-1', originalName: 'Nivora-P 500', matchStatus: 'exact', genericName: 'Nivora-P combination record', strength: '500 mg',
      ingredients: [illustrativeIngredient('Paracetamol (illustrative)', 500)],
      dosage: { ...payload.medicines[0], frequencyLabel: 'Twice daily', estimatedDailyDoses: 2 }, confidence: 'high', findingIds: [duplicateFinding.id]
    }),
    medicine({
      id: 'med-duplicate-2', originalName: 'Feverdown 650', matchStatus: 'exact', genericName: 'Feverdown single-ingredient record', strength: '650 mg',
      ingredients: [illustrativeIngredient('Paracetamol (illustrative)', 650)],
      dosage: { ...payload.medicines[1], frequencyLabel: 'As needed', estimatedDailyDoses: null }, confidence: 'high', findingIds: [duplicateFinding.id]
    }),
    medicine({
      id: 'med-duplicate-3', originalName: 'Gastrocalm 20', matchStatus: 'alias', genericName: 'Gastrocalm illustrative ingredient', strength: '20 mg',
      ingredients: [illustrativeIngredient('Gastrocalm ingredient (illustrative)', 20)],
      dosage: { ...payload.medicines[2], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, confidence: 'medium'
    })
  ];
  response.findings = [duplicateFinding];
  response.summary = { medicinesSubmitted: 3, matchedMedicines: 3, unmatchedMedicines: 0, alertsBySeverity: { high: 1 }, confirmedIngredientOverlaps: 1 };
  return response;
}

function buildInteractionResponse(scenario, payload) {
  const response = baseResponse(scenario, payload);
  const interactionFinding = finding({
    id: 'finding-interaction-01', severity: 'high', category: 'interaction', title: 'Synthetic interaction fixture flagged',
    description: 'This warning is intentionally synthetic so the interface can demonstrate an API-supplied interaction. It is not a verified clinical interaction.',
    affectedMedicineIds: ['med-interaction-1', 'med-interaction-2'], affectedMedicines: ['Axion-B 10', 'CardioNex 25'],
    ingredients: ['Ingredient A (synthetic)', 'Ingredient B (synthetic)'], evidence: [{ ...syntheticSource, statement: 'Synthetic interaction relationship supplied by the demo fixture.' }],
    action: 'Use the evidence panel to inspect the fixture limitations, then review the source record with a qualified professional.'
  });
  response.medicines = [
    medicine({ id: 'med-interaction-1', originalName: 'Axion-B 10', matchStatus: 'exact', genericName: 'Axion-B illustrative record', strength: '10 mg', ingredients: [illustrativeIngredient('Ingredient A (synthetic)', 10)], dosage: { ...payload.medicines[0], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, confidence: 'high', findingIds: [interactionFinding.id] }),
    medicine({ id: 'med-interaction-2', originalName: 'CardioNex 25', matchStatus: 'exact', genericName: 'CardioNex illustrative record', strength: '25 mg', ingredients: [illustrativeIngredient('Ingredient B (synthetic)', 25)], dosage: { ...payload.medicines[1], frequencyLabel: 'Twice daily', estimatedDailyDoses: 2 }, confidence: 'high', findingIds: [interactionFinding.id] })
  ];
  response.findings = [interactionFinding];
  response.summary = { medicinesSubmitted: 2, matchedMedicines: 2, unmatchedMedicines: 0, alertsBySeverity: { high: 1 }, confirmedIngredientOverlaps: 0 };
  return response;
}

function buildUnknownResponse(scenario, payload) {
  const response = baseResponse(scenario, payload);
  const reviewFinding = finding({
    id: 'finding-unknown-01', severity: 'needs_review', category: 'unknown_medicine', title: 'Medicine could not be matched',
    description: 'We could not confidently identify Zentovar XR in the illustrative dataset. No active ingredients or dose assessment are assumed for this entry.',
    affectedMedicineIds: ['med-unknown-1'], affectedMedicines: ['Zentovar XR'], evidence: [],
    action: 'Verify the brand, strength and dosage with a qualified pharmacist or healthcare professional.'
  });
  response.medicines = [
    medicine({ id: 'med-unknown-1', originalName: 'Zentovar XR', matchStatus: 'unmatched', strength: 'unknown', dosage: { ...payload.medicines[0], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, findingIds: [reviewFinding.id], reviewNote: 'No confident match was returned by the available dataset.' }),
    medicine({ id: 'med-unknown-2', originalName: 'Gastrocalm 20', matchStatus: 'exact', genericName: 'Gastrocalm illustrative ingredient', strength: '20 mg', ingredients: [illustrativeIngredient('Gastrocalm ingredient (illustrative)', 20)], dosage: { ...payload.medicines[1], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, confidence: 'high' })
  ];
  response.findings = [reviewFinding];
  response.summary = { medicinesSubmitted: 2, matchedMedicines: 1, unmatchedMedicines: 1, alertsBySeverity: { needs_review: 1 }, confirmedIngredientOverlaps: 0 };
  response.status = { code: 'incomplete', title: 'Review incomplete — medicine match needed', explanation: 'One entry could not be confidently identified, so ingredient and dosage checks are limited.' };
  return response;
}

function buildAmbiguousResponse(scenario, payload) {
  const response = baseResponse(scenario, payload);
  const reviewFinding = finding({
    id: 'finding-ambiguous-01', severity: 'needs_review', category: 'ambiguous_medicine', title: 'Confirm the medicine match before continuing',
    description: 'Mediq 10 has multiple illustrative candidate matches. No candidate is treated as confirmed until you explicitly select one.',
    affectedMedicineIds: ['med-ambiguous-1'], affectedMedicines: ['Mediq 10'], evidence: [],
    action: 'Select the candidate that matches the original prescription, or keep the entry unresolved.'
  });
  response.medicines = [
    medicine({
      id: 'med-ambiguous-1', originalName: 'Mediq 10', matchStatus: 'ambiguous', strength: '10 mg', dosage: { ...payload.medicines[0], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, findingIds: [reviewFinding.id],
      candidates: [
        { id: 'candidate-1', name: 'Mediq 10 immediate-release (illustrative)', genericName: 'Candidate A (illustrative)', strength: '10 mg', ingredients: [illustrativeIngredient('Candidate A ingredient (illustrative)', 10)] },
        { id: 'candidate-2', name: 'Mediq XR 10 extended-release (illustrative)', genericName: 'Candidate B (illustrative)', strength: '10 mg', ingredients: [illustrativeIngredient('Candidate B ingredient (illustrative)', 10)] }
      ], reviewNote: 'Choose a candidate only when it matches the original prescription.'
    }),
    medicine({ id: 'med-ambiguous-2', originalName: 'Clearline 40', matchStatus: 'exact', genericName: 'Clearline illustrative ingredient', strength: '40 mg', ingredients: [illustrativeIngredient('Clearline ingredient (illustrative)', 40)], dosage: { ...payload.medicines[1], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, confidence: 'high' })
  ];
  response.findings = [reviewFinding];
  response.summary = { medicinesSubmitted: 2, matchedMedicines: 1, unmatchedMedicines: 1, alertsBySeverity: { needs_review: 1 }, confirmedIngredientOverlaps: 0 };
  response.status = { code: 'incomplete', title: 'Review incomplete — confirm an ambiguous match', explanation: 'The available dataset returned more than one plausible match for one medicine.' };
  return response;
}

function buildClearResponse(scenario, payload) {
  const response = baseResponse(scenario, payload);
  response.status = { code: 'clear', title: 'No known issues identified in available data', explanation: 'The illustrative dataset returned no findings for these entries. This is not a statement that the prescription is safe.' };
  response.medicines = [
    medicine({ id: 'med-clear-1', originalName: 'Clearline 40', matchStatus: 'exact', genericName: 'Clearline illustrative ingredient', strength: '40 mg', ingredients: [illustrativeIngredient('Clearline ingredient (illustrative)', 40)], dosage: { ...payload.medicines[0], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, confidence: 'high' }),
    medicine({ id: 'med-clear-2', originalName: 'Nourish-OR', matchStatus: 'alias', genericName: 'Nourish-OR illustrative record', strength: '200 ml', ingredients: [illustrativeIngredient('Electrolyte blend (illustrative)', 200, 'ml')], dosage: { ...payload.medicines[1], frequencyLabel: 'As needed', estimatedDailyDoses: null }, confidence: 'medium' })
  ];
  response.findings = [];
  response.summary = { medicinesSubmitted: 2, matchedMedicines: 2, unmatchedMedicines: 0, alertsBySeverity: {}, confirmedIngredientOverlaps: 0 };
  return response;
}

function buildIncompleteResponse(scenario, payload) {
  const response = baseResponse(scenario, payload);
  const incompleteFinding = finding({
    id: 'finding-incomplete-01', severity: 'moderate', category: 'incomplete_information', title: 'Some dose review is unavailable',
    description: 'The illustrative ruleset requires kidney-condition context for this type of dosage review. No dose limit is invented when that information is missing.',
    affectedMedicineIds: ['med-incomplete-1'], affectedMedicines: ['Renalix 20'], ingredients: ['Renalix ingredient (illustrative)'], evidence: [],
    action: 'Add the known patient context or ask a qualified healthcare professional to review the prescription.'
  });
  response.medicines = [
    medicine({ id: 'med-incomplete-1', originalName: 'Renalix 20', matchStatus: 'exact', genericName: 'Renalix illustrative ingredient', strength: '20 mg', ingredients: [illustrativeIngredient('Renalix ingredient (illustrative)', 20)], dosage: { ...payload.medicines[0], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, confidence: 'high', findingIds: [incompleteFinding.id] }),
    medicine({ id: 'med-incomplete-2', originalName: 'Clearline 40', matchStatus: 'exact', genericName: 'Clearline illustrative ingredient', strength: '40 mg', ingredients: [illustrativeIngredient('Clearline ingredient (illustrative)', 40)], dosage: { ...payload.medicines[1], frequencyLabel: 'Once daily', estimatedDailyDoses: 1 }, confidence: 'high' })
  ];
  response.findings = [incompleteFinding];
  response.summary = { medicinesSubmitted: 2, matchedMedicines: 2, unmatchedMedicines: 0, alertsBySeverity: { moderate: 1 }, confirmedIngredientOverlaps: 0 };
  response.status = { code: 'incomplete', title: 'Review incomplete — information is missing', explanation: 'Some checks were intentionally withheld because the available patient context is incomplete.' };
  return response;
}

export function getDemoScenarios() {
  return Object.values(demoScenarios).map(({ id, label, shortLabel, description }) => ({ id, label, shortLabel, description }));
}

export function getDemoScenario(id) {
  return demoScenarios[id] || demoScenarios.duplicate;
}

export function buildDemoResponse(id, payload) {
  const scenario = getDemoScenario(id);
  if (scenario.id === 'duplicate') return buildDuplicateResponse(scenario, payload);
  if (scenario.id === 'interaction') return buildInteractionResponse(scenario, payload);
  if (scenario.id === 'unknown') return buildUnknownResponse(scenario, payload);
  if (scenario.id === 'ambiguous') return buildAmbiguousResponse(scenario, payload);
  if (scenario.id === 'clear') return buildClearResponse(scenario, payload);
  if (scenario.id === 'incomplete') return buildIncompleteResponse(scenario, payload);
  throw new Error('MediTrace demo service error: simulated API unavailable.');
}

export function getInitialForm() {
  return {
    patient: { age_years: '', weight_kg: '', kidney_condition: 'unknown' },
    medicines: [{ name: '', strength: '', dose: '', frequency: 'OD', duration_days: '', instructions: '' }]
  };
}
