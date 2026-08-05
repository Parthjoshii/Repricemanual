const byId = (id) => document.getElementById(id);

// Escapes text before it's interpolated into an innerHTML template string. Needed anywhere raw
// user input (or a DOM node's .textContent read back out) flows into HTML built via string
// concatenation — .textContent itself is safe to *set*, but re-reading it and splicing the
// result into a new HTML string loses that protection, so it has to be escaped again here.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Rounding rules by currency. Decimal places follow ISO 4217 minor units, except INR/IDR/TWD
// which keep this app's existing fare-rounding convention (whole-unit fares are how these are
// conventionally issued in air ticketing, even though ISO 4217 itself specifies 2 decimals).
const roundingRules = {
  // 0 decimals (ISO 4217 zero-decimal currencies, plus INR/IDR/TWD's fare-issuance convention)
  'INR': { type: 'ceiling', decimals: 0 },      // Round up, no decimals (fare-issuance convention)
  'JPY': { type: 'nearest', decimals: 0 },      // Japanese Yen - no decimals
  'KRW': { type: 'nearest', decimals: 0 },      // Korean Won - no decimals
  'TWD': { type: 'nearest', decimals: 0 },      // Taiwan Dollar - no decimals (fare-issuance convention)
  'XAF': { type: 'nearest', decimals: 0 },      // Central African CFA Franc - no decimals
  'XOF': { type: 'nearest', decimals: 0 },      // West African CFA Franc - no decimals
  'XPF': { type: 'nearest', decimals: 0 },      // CFP Franc - no decimals
  'CLP': { type: 'nearest', decimals: 0 },      // Chilean Peso - no decimals
  'ISK': { type: 'nearest', decimals: 0 },      // Icelandic Króna - no decimals
  'VND': { type: 'nearest', decimals: 0 },      // Vietnamese Dong - no decimals
  'IDR': { type: 'standard', decimals: 0 },     // Indonesian Rupiah - no decimals (fare-issuance convention)
  'IRR': { type: 'standard', decimals: 0 },     // Iranian Rial - no decimals (fares run into the hundreds of thousands/millions, so whole-unit issuance is standard)

  // 3 decimals (ISO 4217 three-decimal currencies — mostly Gulf/North African dinars & rials)
  'BHD': { type: 'standard', decimals: 3 },     // Bahraini Dinar - 3 decimals
  'JOD': { type: 'standard', decimals: 3 },     // Jordanian Dinar - 3 decimals
  'KWD': { type: 'standard', decimals: 3 },     // Kuwaiti Dinar - 3 decimals
  'OMR': { type: 'standard', decimals: 3 },     // Omani Rial - 3 decimals
  'TND': { type: 'standard', decimals: 3 },     // Tunisian Dinar - 3 decimals

  // 2 decimals (ISO 4217 standard — the default for everything else in the currency dropdown)
  'USD': { type: 'standard', decimals: 2 },     // US Dollar - 2 decimals
  'EUR': { type: 'standard', decimals: 2 },     // Euro - 2 decimals
  'GBP': { type: 'standard', decimals: 2 },     // British Pound - 2 decimals
  'AUD': { type: 'standard', decimals: 2 },     // Australian Dollar - 2 decimals
  'CAD': { type: 'standard', decimals: 2 },     // Canadian Dollar - 2 decimals
  'CHF': { type: 'standard', decimals: 2 },     // Swiss Franc - 2 decimals
  'CNY': { type: 'standard', decimals: 2 },     // Chinese Yuan - 2 decimals
  'SEK': { type: 'standard', decimals: 2 },     // Swedish Krona - 2 decimals
  'NZD': { type: 'standard', decimals: 2 },     // New Zealand Dollar - 2 decimals
  'MXN': { type: 'standard', decimals: 2 },     // Mexican Peso - 2 decimals
  'SGD': { type: 'standard', decimals: 2 },     // Singapore Dollar - 2 decimals
  'HKD': { type: 'standard', decimals: 2 },     // Hong Kong Dollar - 2 decimals
  'NOK': { type: 'standard', decimals: 2 },     // Norwegian Krone - 2 decimals
  'TRY': { type: 'standard', decimals: 2 },     // Turkish Lira - 2 decimals
  'RUB': { type: 'standard', decimals: 2 },     // Russian Ruble - 2 decimals
  'BRL': { type: 'standard', decimals: 2 },     // Brazilian Real - 2 decimals
  'ZAR': { type: 'standard', decimals: 2 },     // South African Rand - 2 decimals
  'AED': { type: 'standard', decimals: 2 },     // UAE Dirham - 2 decimals
  'SAR': { type: 'standard', decimals: 2 },     // Saudi Riyal - 2 decimals
  'THB': { type: 'standard', decimals: 2 },     // Thai Baht - 2 decimals
  'MYR': { type: 'standard', decimals: 2 },     // Malaysian Ringgit - 2 decimals
  'PHP': { type: 'standard', decimals: 2 },     // Philippine Peso - 2 decimals
  'PKR': { type: 'standard', decimals: 2 },     // Pakistani Rupee - 2 decimals
  'BDT': { type: 'standard', decimals: 2 },     // Bangladeshi Taka - 2 decimals
  'LKR': { type: 'standard', decimals: 2 },     // Sri Lankan Rupee - 2 decimals
  'AOA': { type: 'standard', decimals: 2 },     // Angolan Kwanza - 2 decimals
  'ARS': { type: 'standard', decimals: 2 },     // Argentine Peso - 2 decimals
  'BND': { type: 'standard', decimals: 2 },     // Brunei Dollar - 2 decimals
  'COP': { type: 'standard', decimals: 2 },     // Colombian Peso - 2 decimals
  'CZK': { type: 'standard', decimals: 2 },     // Czech Koruna - 2 decimals
  'DKK': { type: 'standard', decimals: 2 },     // Danish Krone - 2 decimals
  'DZD': { type: 'standard', decimals: 2 },     // Algerian Dinar - 2 decimals
  'EGP': { type: 'standard', decimals: 2 },     // Egyptian Pound - 2 decimals
  'ETB': { type: 'standard', decimals: 2 },     // Ethiopian Birr - 2 decimals
  'FJD': { type: 'standard', decimals: 2 },     // Fiji Dollar - 2 decimals
  'GHS': { type: 'standard', decimals: 2 },     // Ghana Cedi - 2 decimals
  'HUF': { type: 'standard', decimals: 2 },     // Hungarian Forint - 2 decimals
  'HRK': { type: 'standard', decimals: 2 },     // Croatian Kuna - 2 decimals
  'ILS': { type: 'standard', decimals: 2 },     // Israeli Shekel - 2 decimals
  'KES': { type: 'standard', decimals: 2 },     // Kenyan Shilling - 2 decimals
  'KZT': { type: 'standard', decimals: 2 },     // Kazakhstani Tenge - 2 decimals
  'MAD': { type: 'standard', decimals: 2 },     // Moroccan Dirham - 2 decimals
  'MUR': { type: 'standard', decimals: 2 },     // Mauritius Rupee - 2 decimals
  'NGN': { type: 'standard', decimals: 2 },     // Nigerian Naira - 2 decimals
  'NPR': { type: 'standard', decimals: 2 },     // Nepalese Rupee - 2 decimals
  'PLN': { type: 'standard', decimals: 2 },     // Polish Zloty - 2 decimals
  'QAR': { type: 'standard', decimals: 2 },     // Qatari Rial - 2 decimals
  'SCR': { type: 'standard', decimals: 2 },     // Seychelles Rupee - 2 decimals
  'UAH': { type: 'standard', decimals: 2 },     // Ukrainian Hryvnia - 2 decimals
  'ZMW': { type: 'standard', decimals: 2 },     // Zambian Kwacha - 2 decimals
};

const K3_RATES = {
  economy: 0.05,
  premium: 0.18,
  business: 0.18,
  first: 0.18,
};

const els = {
  errorDisplay: byId('errorDisplay'),
  currency: byId('currency'),
  oldTax: byId('oldTax'),
  newTax: byId('newTax'),
  taxResult: byId('taxResult'),
  cabin: byId('cabin'),
  oldFare: byId('oldFare'),
  newFare: byId('newFare'),
  fareDiff: byId('fareDiff'),
  k3Tax: byId('k3Tax'),
  changeFee: byId('changeFee'),
  applyK3OnFareDiff: byId('applyK3OnFareDiff'),
  applyK3OnChangeFee: byId('applyK3OnChangeFee'),
  applyK3OnYQ: byId('applyK3OnYQ'),
  inrMessage: byId('inrMessage'),
  addTaxes: byId('addTaxes'),
  refundTaxes: byId('refundTaxes'),
  taxAdj: byId('taxAdj'),
  perPax: byId('perPax'),
  pax: byId('pax'),
  subTotal: byId('subTotal'),
  summary: byId('summary'),
  helpIcon: byId('helpIcon'),
  themeToggle: byId('themeToggle'),
  taxCalcButton: byId('taxCalcButton'),
  taxClearButton: byId('taxClearButton'),
  taxToggleBtn: byId('taxToggleBtn'),
  taxCollapsible: byId('taxCollapsible'),
  fareCalcButton: byId('fareCalcButton'),
  fareClearButton: byId('fareClearButton'),
  copySummaryButton: byId('copySummaryButton'),
  gdsString: byId('gdsString'),
  copyGdsButton: byId('copyGdsButton'),
  summariseButton: byId('summariseButton'),
  summaryContent: byId('summaryContent'),
  // Parser elements
  fareCalcString: byId('fareCalcString'),
  parseButton: byId('parseButton'),
  parserClearButton: byId('parserClearButton'),
  parserResults: byId('parserResults'),
  fareComponents: byId('fareComponents'),
  qSurchargesSection: byId('qSurchargesSection'),
  qSurcharges: byId('qSurcharges'),
  calculatedNuc: byId('calculatedNuc'),
  statedNuc: byId('statedNuc'),
  nucValidation: byId('nucValidation'),
  roe: byId('roe'),
  baseFare: byId('baseFare'),
  parserToggleBtn: byId('parserToggleBtn'),
  parserCollapsible: byId('parserCollapsible'),
  ptcTabs: document.querySelector('.ptc-tabs'),
  ptcAddTabButton: byId('ptcAddTabButton'),
  ptcPromptModal: byId('ptcPromptModal'),
  ptcPromptMessage: byId('ptcPromptMessage'),
  ptcPromptInput: byId('ptcPromptInput'),
  ptcPromptOkBtn: byId('ptcPromptOkBtn'),
  ptcPromptCancelBtn: byId('ptcPromptCancelBtn'),
  autoCalcFromAdult: byId('autoCalcFromAdult'),
  autoCalcFromAdultRow: byId('autoCalcFromAdultRow'),
  autoCalcHint: byId('autoCalcHint'),
};

// In-app replacement for window.prompt()/confirm() — some embedded browser previews (e.g.
// VS Code's Simple Browser) silently block native dialogs with no visible error, which made
// the custom-tab "+" button appear completely broken. This modal has no such dependency.
// requireInput: true shows a text field and resolves with the trimmed string (or null if
// cancelled); false hides the field and resolves true/false (a plain OK/Cancel confirmation).
function showPtcPrompt({ message, defaultValue = '', requireInput = true }) {
  return new Promise((resolve) => {
    els.ptcPromptMessage.textContent = message;
    els.ptcPromptInput.style.display = requireInput ? 'block' : 'none';
    els.ptcPromptInput.value = defaultValue;
    els.ptcPromptModal.classList.add('show');
    if (requireInput) {
      els.ptcPromptInput.focus();
      els.ptcPromptInput.select();
    } else {
      els.ptcPromptOkBtn.focus();
    }

    function cleanup(result) {
      els.ptcPromptModal.classList.remove('show');
      els.ptcPromptOkBtn.removeEventListener('click', onOk);
      els.ptcPromptCancelBtn.removeEventListener('click', onCancel);
      els.ptcPromptModal.removeEventListener('keydown', onKeydown);
      resolve(result);
    }
    function onOk() {
      cleanup(requireInput ? els.ptcPromptInput.value.trim() : true);
    }
    function onCancel() {
      cleanup(requireInput ? null : false);
    }
    function onKeydown(e) {
      // stopPropagation so this doesn't also reach the document-level keydown handler, which
      // would otherwise treat a bare Enter as "calculate fare" (it doesn't know this modal exists).
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onOk(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
    }
    els.ptcPromptOkBtn.addEventListener('click', onOk);
    els.ptcPromptCancelBtn.addEventListener('click', onCancel);
    // Attached to the modal (not just the input) so Enter/Escape work regardless of which
    // control currently has focus (input in name/rename mode, OK button in confirm-only mode).
    els.ptcPromptModal.addEventListener('keydown', onKeydown);
  });
}

// The first BUILT_IN_PTC_COUNT codes are the fixed built-in tabs; anything beyond that is a
// user-added custom tab (see addCustomTab/renameCustomTab/removeCustomTab), capped at
// MAX_CUSTOM_PTC_TABS.
const PTC_CODES = ['ADT', 'CNN', 'INF', 'INF_CNN', 'CNN_ADT'];
const BUILT_IN_PTC_COUNT = 5;
const MAX_CUSTOM_PTC_TABS = 2;
// Declared here (not near the summary-table code that mainly reads it) so it's available to
// loadStateFromStorage()/syncAutoCalcUI(), both of which can run before the script has finished
// its top-to-bottom pass — a `const` further down the file would still be in its temporal dead
// zone at that point and throw a ReferenceError.
const PTC_LABELS = { ADT: 'Adult', CNN: 'Child', INF: 'Infant', INF_CNN: 'Infant/Child', CNN_ADT: 'Child/Adult' };

// CNN/INF Fare Calculation Strings can be auto-derived from the validated ADT string by scaling
// fare/surcharge amounts by these percentages and forcing this pax-type suffix onto fare basis codes.
const PTC_AUTO_CALC_PERCENT = { CNN: 0.75, INF: 0.10 };
const PTC_FARE_BASIS_SUFFIX = { CNN: 'CH', INF: 'IN' };

// Hybrid age-transition tabs: a passenger who ages up mid-journey (e.g. an infant turning 2
// between outbound and return) prices the outbound leg at one PTC's rate and the inbound leg at
// another's. Ratios/suffixes are keyed by leg rather than a single flat value like the map above.
const PTC_HYBRID_RATIOS = {
  INF_CNN: { outbound: 0.10, inbound: 0.75 },
  CNN_ADT: { outbound: 0.75, inbound: 1.00 },
};
// '' suffix = strip any existing CH/IN suffix (Adult fare basis codes carry none).
const PTC_HYBRID_SUFFIX = {
  INF_CNN: { outbound: 'IN', inbound: 'CH' },
  CNN_ADT: { outbound: 'CH', inbound: '' },
};

function isAutoCalcEligible(ptc) {
  return ptc in PTC_AUTO_CALC_PERCENT || ptc in PTC_HYBRID_RATIOS;
}

// Every field whose value should be saved/restored when switching passenger-type tabs.
// 'value' fields are plain inputs/selects/textareas; 'checked' are checkboxes; 'html' fields
// are readonly display elements whose content is only ever set by render functions (not typed
// by the user) so they're restored via innerHTML rather than recomputed.
const PTC_SNAPSHOT_FIELDS = [
  { id: 'currency', kind: 'value' },
  { id: 'cabin', kind: 'value' },
  { id: 'oldFare', kind: 'value' },
  { id: 'newFare', kind: 'value' },
  { id: 'fareDiff', kind: 'value' },
  { id: 'k3Tax', kind: 'value' },
  { id: 'changeFee', kind: 'value' },
  { id: 'applyK3OnFareDiff', kind: 'checked' },
  { id: 'applyK3OnChangeFee', kind: 'checked' },
  { id: 'applyK3OnYQ', kind: 'checked' },
  { id: 'inrMessage', kind: 'html' },
  { id: 'oldTax', kind: 'value' },
  { id: 'newTax', kind: 'value' },
  { id: 'taxResult', kind: 'html' },
  { id: 'addTaxes', kind: 'value' },
  { id: 'refundTaxes', kind: 'value' },
  { id: 'taxAdj', kind: 'value' },
  { id: 'perPax', kind: 'value' },
  { id: 'pax', kind: 'value' },
  { id: 'subTotal', kind: 'value' },
  { id: 'fareCalcString', kind: 'value' },
  { id: 'autoCalcFromAdult', kind: 'checked' },
];

// JS-level state.* fields that calculateFare()/calculateTaxes()/parseFareCalcString() read and
// write as "the current working set" — swapped alongside the DOM fields above on tab switch.
const PTC_STATE_KEYS = [
  'lastTaxResult', 'lastFareK3Total', 'lastFareCurrency', 'lastK3AddTaxes',
  'lastSummaryData', 'lastConvertedFareCalcString',
];

function defaultPtcSnapshot() {
  const fields = {};
  PTC_SNAPSHOT_FIELDS.forEach(({ id, kind }) => {
    if (kind === 'checked') fields[id] = false;
    else fields[id] = '';
  });
  fields.pax = '1';
  const stateValues = {};
  PTC_STATE_KEYS.forEach(key => { stateValues[key] = key === 'lastFareK3Total' ? 0 : (key === 'lastK3AddTaxes' ? '' : null); });
  return { fields, stateValues, parserVisible: false, qSurchargesVisible: false };
}

function snapshotPtc() {
  const fields = {};
  PTC_SNAPSHOT_FIELDS.forEach(({ id, kind }) => {
    const el = els[id];
    if (!el) return;
    if (kind === 'checked') fields[id] = el.checked;
    else if (kind === 'html') fields[id] = el.innerHTML;
    else fields[id] = el.value;
  });
  const stateValues = {};
  PTC_STATE_KEYS.forEach(key => { stateValues[key] = state[key]; });
  return {
    fields,
    stateValues,
    parserVisible: els.parserResults.style.display === 'block',
    qSurchargesVisible: els.qSurchargesSection.style.display === 'block',
    fareComponentsHtml: els.fareComponents.innerHTML,
    qSurchargesHtml: els.qSurcharges.innerHTML,
    calculatedNucHtml: els.calculatedNuc.innerHTML,
    statedNucText: els.statedNuc.textContent,
    nucValidationHtml: els.nucValidation.innerHTML,
    roeText: els.roe.textContent,
    baseFareText: els.baseFare.textContent,
  };
}

function restorePtc(snapshot) {
  PTC_SNAPSHOT_FIELDS.forEach(({ id, kind }) => {
    const el = els[id];
    if (!el) return;
    const value = snapshot.fields[id] ?? (kind === 'checked' ? false : '');
    if (kind === 'checked') el.checked = value;
    else if (kind === 'html') el.innerHTML = value;
    else el.value = value;
  });
  PTC_STATE_KEYS.forEach(key => { state[key] = snapshot.stateValues[key] ?? null; });

  els.parserResults.style.display = snapshot.parserVisible ? 'block' : 'none';
  els.qSurchargesSection.style.display = snapshot.qSurchargesVisible ? 'block' : 'none';
  els.fareComponents.innerHTML = snapshot.fareComponentsHtml || '';
  els.qSurcharges.innerHTML = snapshot.qSurchargesHtml || '';
  els.calculatedNuc.innerHTML = snapshot.calculatedNucHtml || '';
  els.statedNuc.textContent = snapshot.statedNucText || '';
  els.nucValidation.innerHTML = snapshot.nucValidationHtml || '';
  els.roe.textContent = snapshot.roeText || '';
  els.baseFare.textContent = snapshot.baseFareText || '';
}

function hasPtcData(ptc) {
  return !!state.ptcData[ptc].summaryData;
}

function getActivePtcCodes() {
  return PTC_CODES.filter(hasPtcData);
}

function ptcTabButton(code) {
  return els.ptcTabs.querySelector(`.ptc-tab[data-ptc="${code}"]`);
}

function updatePtcTabUI() {
  PTC_CODES.forEach(ptc => {
    const btn = ptcTabButton(ptc);
    if (!btn) return;
    const isActive = ptc === state.activePtc;
    btn.setAttribute('aria-selected', String(isActive));
    btn.classList.toggle('has-data', hasPtcData(ptc));
  });
  const customCount = PTC_CODES.length - BUILT_IN_PTC_COUNT;
  els.ptcAddTabButton.hidden = customCount >= MAX_CUSTOM_PTC_TABS;
  syncAutoCalcUI();
  saveStateToStorage();
}

const PERSIST_KEY = 'fareTaxCalc.state.v1';

// Auto-saves the whole session (every PTC tab's inputs/results, custom tabs, which tab is
// active) so an accidental refresh or closed tab doesn't silently discard mid-task work — the
// only thing persisted before this was the light/dark theme. Called from updatePtcTabUI() (which
// already runs after every state-changing action — tab switch, calculate, clear, add/remove
// custom tab) plus a few spots that change data without going through it (tax-only recalculation,
// converting a Fare Calculation String, renaming a custom tab).
function saveStateToStorage() {
  try {
    // Capture the active tab's live DOM values too — formSnapshot for the active tab is normally
    // only refreshed when switching *away* from it, so without this its most recent edits
    // wouldn't be in state.ptcData yet at save time.
    state.ptcData[state.activePtc].formSnapshot = snapshotPtc();
    const payload = {
      activePtc: state.activePtc,
      ptcCodes: PTC_CODES,
      ptcLabels: PTC_LABELS,
      ptcData: state.ptcData,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  } catch (e) {
    // Best-effort: storage disabled (private browsing), quota exceeded, etc. — the app still
    // works without persistence, it just won't survive a refresh.
  }
}

// Restores a previously auto-saved session on page load, including re-creating any custom tabs'
// DOM buttons (built-in ADT/CNN/INF/INF_CNN/CNN_ADT already exist in the HTML). Safe to call with
// nothing saved yet (first-ever visit) — leaves everything at its default state in that case.
function loadStateFromStorage() {
  let saved;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    saved = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!saved || !Array.isArray(saved.ptcCodes) || !saved.ptcData) return;

  // PTC_CODES/PTC_LABELS are declared const — mutate in place rather than reassigning, since
  // other modules already hold a reference to these exact objects.
  PTC_CODES.length = 0;
  saved.ptcCodes.forEach(code => PTC_CODES.push(code));
  Object.keys(PTC_LABELS).forEach(key => delete PTC_LABELS[key]);
  Object.assign(PTC_LABELS, saved.ptcLabels || {});
  state.ptcData = saved.ptcData;

  // Re-create DOM buttons for any saved custom tabs (built-ins are already in index.html).
  PTC_CODES.slice(BUILT_IN_PTC_COUNT).forEach(code => {
    if (ptcTabButton(code)) return;
    const btn = buildCustomTabButton(code, PTC_LABELS[code] || code);
    els.ptcAddTabButton.insertAdjacentElement('beforebegin', btn);
  });

  state.activePtc = PTC_CODES.includes(saved.activePtc) ? saved.activePtc : 'ADT';
  restorePtc(state.ptcData[state.activePtc]?.formSnapshot || defaultPtcSnapshot());
}

// The "Auto-calculate from Adult" toggle applies to CNN/INF (single ratio) and INF_CNN/CNN_ADT
// (hybrid, two ratios): shows/hides its row, keeps the Fare Calculation String field/Convert
// button locked while active, and shows a small split-percentage hint for the hybrid tabs only.
function syncAutoCalcUI() {
  const eligible = isAutoCalcEligible(state.activePtc);
  els.autoCalcFromAdultRow.style.display = eligible ? '' : 'none';
  const locked = eligible && els.autoCalcFromAdult.checked;
  els.fareCalcString.readOnly = locked;
  els.parseButton.disabled = locked;

  const hybrid = PTC_HYBRID_RATIOS[state.activePtc];
  if (hybrid) {
    const [outCode, inCode] = state.activePtc.split('_');
    els.autoCalcHint.textContent = `Outbound ${(hybrid.outbound * 100).toFixed(0)}% (${PTC_LABELS[outCode] || outCode}) · Inbound ${(hybrid.inbound * 100).toFixed(0)}% (${PTC_LABELS[inCode] || inCode})`;
    els.autoCalcHint.style.display = '';
  } else {
    els.autoCalcHint.style.display = 'none';
  }
}

function switchPtcTab(newPtc) {
  if (!PTC_CODES.includes(newPtc) || newPtc === state.activePtc) return;
  state.ptcData[state.activePtc].formSnapshot = snapshotPtc();
  state.activePtc = newPtc;
  restorePtc(state.ptcData[newPtc].formSnapshot || defaultPtcSnapshot());
  updatePtcTabUI();
  if (isAutoCalcEligible(newPtc) && els.autoCalcFromAdult.checked) {
    applyAutoCalc(newPtc, { silent: true });
  }
}

// Turns a user-typed tab name into a short, unique, alphanumeric internal key — used only as
// the state.ptcData/PTC_CODES key and data-ptc attribute; the typed label is stored separately
// in PTC_LABELS and is the only thing shown to the user (see renameCustomTab).
function generatePtcCode(label) {
  const base = (label.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'TAB');
  let code = base;
  let n = 2;
  while (PTC_CODES.includes(code)) {
    code = `${base}${n}`;
    n += 1;
  }
  return code;
}

function isDuplicatePtcLabel(label, excludingCode = null) {
  const normalized = label.trim().toLowerCase();
  return PTC_CODES.some(code => {
    if (code === excludingCode) return false;
    const existingLabel = PTC_LABELS[code] || code;
    return existingLabel.toLowerCase() === normalized;
  });
}

function buildCustomTabButton(code, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ptc-tab custom';
  btn.dataset.ptc = code;
  btn.setAttribute('role', 'tab');
  btn.setAttribute('aria-selected', 'false');

  const labelSpan = document.createElement('span');
  labelSpan.className = 'ptc-tab-label';
  labelSpan.textContent = label;
  btn.appendChild(labelSpan);

  const renameIcon = document.createElement('span');
  renameIcon.className = 'ptc-tab-action';
  renameIcon.textContent = '✎';
  renameIcon.title = 'Rename tab';
  renameIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    renameCustomTab(code);
  });
  btn.appendChild(renameIcon);

  const removeIcon = document.createElement('span');
  removeIcon.className = 'ptc-tab-action';
  removeIcon.textContent = '×';
  removeIcon.title = 'Remove tab';
  removeIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    removeCustomTab(code);
  });
  btn.appendChild(removeIcon);

  const dot = document.createElement('span');
  dot.className = 'ptc-tab-dot';
  dot.setAttribute('aria-hidden', 'true');
  btn.appendChild(dot);

  return btn;
}

async function addCustomTab() {
  if (PTC_CODES.length - BUILT_IN_PTC_COUNT >= MAX_CUSTOM_PTC_TABS) return;
  const label = await showPtcPrompt({ message: 'Name this tab:' });
  if (!label) return;
  if (isDuplicatePtcLabel(label)) {
    showError(`A tab named "${label}" already exists.`);
    return;
  }

  const code = generatePtcCode(label);
  PTC_CODES.push(code);
  state.ptcData[code] = { formSnapshot: null, summaryData: null };
  PTC_LABELS[code] = label;

  const btn = buildCustomTabButton(code, label);
  els.ptcAddTabButton.insertAdjacentElement('beforebegin', btn);

  switchPtcTab(code);
}

async function renameCustomTab(code) {
  const currentLabel = PTC_LABELS[code] || code;
  const label = await showPtcPrompt({ message: 'Rename tab:', defaultValue: currentLabel });
  if (!label || label === currentLabel) return;
  if (isDuplicatePtcLabel(label, code)) {
    showError(`A tab named "${label}" already exists.`);
    return;
  }
  PTC_LABELS[code] = label;
  const btn = ptcTabButton(code);
  if (btn) btn.querySelector('.ptc-tab-label').textContent = label;
  saveStateToStorage();
}

async function removeCustomTab(code) {
  const confirmed = await showPtcPrompt({
    message: `Remove the "${PTC_LABELS[code] || code}" tab? Its data will be lost.`,
    requireInput: false,
  });
  if (!confirmed) return;
  if (state.activePtc === code) {
    switchPtcTab('ADT');
  }
  const index = PTC_CODES.indexOf(code);
  if (index !== -1) PTC_CODES.splice(index, 1);
  delete state.ptcData[code];
  delete PTC_LABELS[code];
  const btn = ptcTabButton(code);
  if (btn) btn.remove();
  updatePtcTabUI();
}

const state = {
  lastTaxResult: null,
  lastFareK3Total: 0,
  lastFareCurrency: null,
  lastK3AddTaxes: '',
  lastSummaryData: null,
  lastConvertedFareCalcString: null,
  // Last NUC-validated ADT Fare Calculation String, used as the source for CNN/INF auto-calculation.
  // Not part of PTC_STATE_KEYS: it's ADT-specific data that CNN/INF tabs read, not their own per-tab state.
  adtParsedFareCalc: null,
  taxCalculationCache: new Map(),
  fareCalculationCache: new Map(),
  isCalculatingTax: false,
  isCalculatingFare: false,
  // Fare calculation string state
  lastFareCalcString: null,
  // Passenger-type-code tabs: which tab is active, and the saved input/output snapshot +
  // last computed summary for each PTC (used by switchPtcTab() and the Summary aggregation).
  activePtc: 'ADT',
  ptcData: {
    ADT: { formSnapshot: null, summaryData: null },
    CNN: { formSnapshot: null, summaryData: null },
    INF: { formSnapshot: null, summaryData: null },
    INF_CNN: { formSnapshot: null, summaryData: null },
    CNN_ADT: { formSnapshot: null, summaryData: null },
  },
  updateFareK3(currency, total, addTaxesStr) {
    this.lastFareCurrency = currency;
    this.lastFareK3Total = total;
    this.lastK3AddTaxes = addTaxesStr;
  },
  clearTaxCache() {
    this.taxCalculationCache.clear();
  },
  clearFareCache() {
    this.fareCalculationCache.clear();
  },
};

function showError(message, isSuccess = false) {
  const modal = document.getElementById('errorModal');
  const messageEl = document.getElementById('modalMessage');
  const modalBox = modal.querySelector('.modal-box');
  const closeButton = modal.querySelector('.modal-close-btn');
  
  messageEl.textContent = message;
  modal.classList.add('show');
  closeButton?.focus();
  
  if (isSuccess) {
    modalBox.classList.remove('error');
    modalBox.classList.add('success');
  } else {
    modalBox.classList.remove('success');
    modalBox.classList.add('error');
  }
}

function closeErrorModal() {
  document.getElementById('errorModal').classList.remove('show');
}

function openHelpModal() {
  document.getElementById('helpModal').classList.add('show');
  document.querySelector('#helpModal .modal-close-btn').focus();
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.remove('show');
}

// Utility function: Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Utility function: Memoization
function memoize(func) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = func.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

els.taxCalcButton.addEventListener('click', calculateTaxes);
els.taxClearButton.addEventListener('click', clearTaxes);
els.fareCalcButton.addEventListener('click', calculateFare);
els.fareClearButton.addEventListener('click', clearFare);
els.copySummaryButton.addEventListener('click', copySummaryTable);
els.copyGdsButton.addEventListener('click', copyGdsString);
els.taxToggleBtn.addEventListener('click', toggleTaxSection);
els.parserToggleBtn.addEventListener('click', toggleParserSection);
els.summariseButton.addEventListener('click', handleSummarise);
els.ptcAddTabButton.addEventListener('click', addCustomTab);
// Delegated so dynamically-added custom tab buttons work with no per-button wiring.
els.ptcTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.ptc-tab[data-ptc]');
  if (btn) switchPtcTab(btn.dataset.ptc);
});

// Live calculation triggers (debounced for calculation, immediate for validation)
const debouncedCalculateTaxes = debounce(tryCalculateTaxes, 300);
const debouncedCalculateFare = debounce(tryCalculateFare, 300);

function validateTaxInputs() {
  const oldText = els.oldTax.value;
  const newText = els.newTax.value;
  
  // Check for K3 in tax inputs (K3 should only be calculated via Fare Calculator)
  const k3Pattern = /K3/i;
  if (k3Pattern.test(oldText) || k3Pattern.test(newText)) {
    showError('K3 tax should not be entered manually in the Tax Adjustment Calculator. K3 is calculated automatically based on Fare Difference and Change Fee in the Fare Calculator.');
    return false;
  }
  
  return true;
}

['oldTax', 'newTax'].forEach(id => {
  els[id].addEventListener('input', () => {
    validateTaxInputs();
    debouncedCalculateTaxes();
  });
  els[id].addEventListener('blur', () => {
    const formatted = formatTaxInput(els[id].value);
    if (formatted !== els[id].value) {
      els[id].value = formatted;
    }
  });
});
['currency', 'cabin', 'oldFare', 'newFare', 'changeFee', 'applyK3OnFareDiff', 'applyK3OnChangeFee', 'pax'].forEach(id => {
  els[id].addEventListener('input', debouncedCalculateFare);
});
// Add change event listener for select elements (currency, cabin)
els.currency.addEventListener('change', debouncedCalculateFare);
els.cabin.addEventListener('change', () => {
  debouncedCalculateFare();
  // Also trigger tax calculation if K3 on YQ checkbox is checked
  if (els.applyK3OnYQ.checked && els.oldTax.value && els.newTax.value) {
    state.clearTaxCache();
    debouncedCalculateTaxes();
  }
});
// Add change event listener for checkboxes (input event doesn't fire reliably for checkboxes)
els.applyK3OnFareDiff.addEventListener('change', () => {
  state.clearFareCache();
  debouncedCalculateFare();
  // Also trigger tax calculation if tax values exist to update Add Taxes with combined K3
  if (els.oldTax.value && els.newTax.value) {
    state.clearTaxCache();
    debouncedCalculateTaxes();
  }
});
els.applyK3OnChangeFee.addEventListener('change', () => {
  state.clearFareCache();
  debouncedCalculateFare();
  // Also trigger tax calculation if tax values exist to update Add Taxes with combined K3
  if (els.oldTax.value && els.newTax.value) {
    state.clearTaxCache();
    debouncedCalculateTaxes();
  }
});
els.applyK3OnYQ.addEventListener('change', () => {
  state.clearTaxCache();
  debouncedCalculateTaxes();
});

// Parser event listeners
els.parseButton.addEventListener('click', parseFareCalcString);
els.parserClearButton.addEventListener('click', clearParser);
els.fareCalcString.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    parseFareCalcString();
  }
});
els.fareCalcString.addEventListener('input', () => {
  // Editing the Adult string without reconverting invalidates it as an auto-calc source.
  if (state.activePtc === 'ADT') {
    state.adtParsedFareCalc = null;
  }
});
els.autoCalcFromAdult.addEventListener('change', () => {
  if (!isAutoCalcEligible(state.activePtc)) return;
  if (els.autoCalcFromAdult.checked) {
    applyAutoCalc(state.activePtc);
  } else {
    syncAutoCalcUI();
  }
});

// Parser functions
function parseFareCalcString() {
  const rawInput = els.fareCalcString.value.trim();

  if (!rawInput) {
    showError('Please enter a fare calculation string.');
    els.parserResults.style.display = 'none';
    return;
  }

  // Fare calculation strings are conventionally all-uppercase (GDS/ticketing systems always
  // print them that way), so a lowercase-typed string isn't really "malformed" input — it's just
  // not yet in the form every regex below expects. Normalizing once here (mirrors the existing
  // uppercase-on-blur behavior for tax entries in formatTaxInput()) means the parser itself never
  // needs to special-case letter case, and what's displayed always matches what was parsed.
  const input = rawInput.toUpperCase();
  if (input !== els.fareCalcString.value) {
    els.fareCalcString.value = input;
  }

  const parsed = parseFareCalcStringInternal(input);

  // Validation
  if (parsed.fareComponents.length === 0) {
    showError('No fare amounts found in the string. Format: number followed by fare basis (e.g., 102.21TLEEPIN1/NDC2)');
    els.parserResults.style.display = 'none';
    return;
  }

  if (parsed.nuc === null) {
    showError('NUC not found in the string. Format: NUC followed by number (e.g., NUC506.77)');
    els.parserResults.style.display = 'none';
    state.lastConvertedFareCalcString = null;
    return;
  }

  if (parsed.roe === null) {
    showError('ROE not found in the string. Format: ROE followed by number (e.g., ROE90.3344456)');
    els.parserResults.style.display = 'none';
    return;
  }

  // Calculate NUC
  const fareSum = parsed.fareComponents.reduce((sum, comp) => sum + comp.amount, 0);
  const qSum = parsed.qSurcharges.reduce((sum, amount) => sum + amount, 0);
  const calculatedNuc = fareSum + qSum;

  // Display fare components. On the hybrid tabs, label each with the outbound/inbound leg it
  // was matched to (same boundary rule applyAutoCalc()/deriveHybridFareCalcString() use) so the
  // split the tool chose is visible and checkable at a glance, not hidden.
  const hybridRatios = PTC_HYBRID_RATIOS[state.activePtc];
  if (hybridRatios) {
    const { boundaryIndex } = findHybridBoundary(input);
    els.fareComponents.innerHTML = parsed.fareComponents
      .map(comp => {
        const phase = boundaryIndex === null || comp.index < boundaryIndex ? 'Outbound' : 'Inbound';
        const basis = comp.fareBasis + (comp.suffix || '') + (comp.designator || '');
        return `<li><b>${phase}:</b> ${comp.amount.toFixed(2)} <span style="color: var(--text-secondary);">(${basis})</span></li>`;
      })
      .join('');
  } else {
    els.fareComponents.innerHTML = parsed.fareComponents
      .map(comp => `<li>${comp.amount.toFixed(2)}</li>`)
      .join('');
  }

  // Display Q surcharges
  if (parsed.qSurcharges.length > 0) {
    els.qSurchargesSection.style.display = 'block';
    els.qSurcharges.innerHTML = parsed.qSurcharges
      .map(amount => `<li>${amount.toFixed(2)}</li>`)
      .join('');
  } else {
    els.qSurchargesSection.style.display = 'none';
  }

  // Display calculated NUC with breakdown
  const breakdown = parsed.fareComponents.map(comp => comp.amount.toFixed(2)).join(' + ');
  if (parsed.qSurcharges.length > 0) {
    const qBreakdown = parsed.qSurcharges.map(a => a.toFixed(2)).join(' + ');
    els.calculatedNuc.innerHTML = `${calculatedNuc.toFixed(2)} <span style="font-size: 0.85rem; color: var(--text-secondary);">(${breakdown} + ${qBreakdown})</span>`;
  } else {
    els.calculatedNuc.innerHTML = `${calculatedNuc.toFixed(2)} <span style="font-size: 0.85rem; color: var(--text-secondary);">(${breakdown})</span>`;
  }

  // Display stated NUC
  els.statedNuc.textContent = parsed.nuc.toFixed(2);

  // NUC validation
  const nucDiff = Math.abs(calculatedNuc - parsed.nuc);
  if (nucDiff < 0.01) {
    els.nucValidation.innerHTML = '<span class="success">✓ NUC Validation: PASS</span>';
    // Validation passed: keep the fare calculation string exactly as entered
    state.lastConvertedFareCalcString = input;
  } else {
    // Generate corrected fare string
    const correctedString = input.replace(/NUC\d+(?:\.\d+)?/, `NUC${calculatedNuc.toFixed(2)}`);
    els.nucValidation.innerHTML = `<span class="error">✗ NUC Validation: FAIL<br><br>Corrected Fare String:<br><span style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: var(--text-primary);">${escapeHtml(correctedString)}</span></span>`;
    // Validation failed: use the corrected string for summaries
    state.lastConvertedFareCalcString = correctedString;
  }

  // ADT is the only source for CNN/INF auto-calculation; capture its validated string whenever
  // it's (re)converted so switching to CNN/INF or toggling auto-calc there always derives from
  // the latest Adult data.
  if (state.activePtc === 'ADT') {
    state.adtParsedFareCalc = state.lastConvertedFareCalcString;
  }

  // Display ROE
  els.roe.textContent = parsed.roe.toFixed(7);

  // Calculate and display base fare
  const baseFare = calculatedNuc * parsed.roe;
  els.baseFare.textContent = baseFare.toFixed(2);

  // Show results
  els.parserResults.style.display = 'block';

  // Some malformed shapes (a stray second decimal point, a minus sign glued to a fare basis
  // code) can't be corrected automatically — the intended value is ambiguous — but they can be
  // silently mis-parsed into a wrong-but-plausible-looking number with no other sign anything is
  // off. Surface a heads-up rather than let that pass silently; the results above are still shown.
  if (parsed.warnings.length > 0) {
    showError(parsed.warnings.join(' '));
  }
  saveStateToStorage();
}

function getPaxType(suffix) {
  if (suffix === 'CH') return 'Child';
  if (suffix === 'IN') return 'Infant';
  return 'Adult';
}

function parseFareBasis(code) {
  return {
    brand: code[0],
    filler: code.substring(1, 4),
    type: code[4],
    country: code.substring(5, 7),
    level: code[7]
  };
}

function parseFareCalcStringInternal(input) {
  const result = {
    fareComponents: [],
    qSurcharges: [],
    nuc: null,
    roe: null,
    warnings: [],
  };

  // Fare components and Q surcharges only ever appear before the NUC keyword — NUC/ROE always
  // mark the totals section that follows. Bounding both scans to that region stops any stray or
  // malformed text between the fare string and NUC/ROE (a missing space, a copy-paste artifact)
  // from being misread as an extra fare component — e.g. without this bound, "NUC651.59ENDROE95"
  // (no space before ROE) has "651.59" immediately followed by exactly 8 alphanumeric characters
  // ("ENDROE95"), which the fare-component pattern below would otherwise happily match as a bogus
  // fare component, double-counting the NUC total itself into the calculated NUC.
  //
  // The NUC/ROE keyword is preferentially matched with a lookbehind requiring it be preceded by
  // whitespace or the start of the string — a bare `input.search(/NUC/)` would also match "NUC"
  // accidentally embedded inside an earlier token, e.g. a fare basis code like "TLNUC123", which
  // would truncate the scan window before the real fare components (dropping them) and also read
  // the embedded "123" as the stated NUC total instead of the real one later in the string. The
  // same risk applies to ROE, which gets the identical treatment. `\s*` between the keyword and
  // its digits (matching qPattern's existing tolerance) means a stray space — "NUC 511.77" —
  // still parses instead of being misreported as "not found".
  //
  // But that lookbehind can't be the *only* attempt: a malformed string can glue the real keyword
  // directly onto preceding stray text with no space at all — e.g. "NUC651.59ENDROE95.593911" —
  // where "ROE" is genuinely the total's keyword but isn't preceded by whitespace either. So each
  // keyword is looked up in two passes: first the strict (whitespace-anchored) pattern, which
  // correctly skips a false match embedded earlier in the string as long as a real, cleanly-
  // separated occurrence exists later to fall through to; only when NO whitespace-anchored
  // occurrence exists at all do we fall back to a bare, unanchored match (the previous behavior),
  // so a keyword that's merely glued to adjacent garbage — not embedded inside another token —
  // still parses.
  function findKeywordMatch(keyword) {
    const strict = input.match(new RegExp(`(?<=^|\\s)${keyword}\\s*(\\d+(?:\\.\\d+)?)`));
    return strict || input.match(new RegExp(`${keyword}\\s*(\\d+(?:\\.\\d+)?)`));
  }

  const nucKeywordMatch = findKeywordMatch('NUC');
  const nucIndex = nucKeywordMatch ? nucKeywordMatch.index : -1;
  const farePart = nucIndex === -1 ? input : input.slice(0, nucIndex);
  if (nucKeywordMatch) {
    result.nuc = parseFloat(nucKeywordMatch[1]);
  }

  const roeKeywordMatch = findKeywordMatch('ROE');
  if (roeKeywordMatch) {
    result.roe = parseFloat(roeKeywordMatch[1]);
  }

  // Known, intentionally-unfixed limitations (would need a real IATA airport-code list or a full
  // fare-basis grammar to resolve, which is out of scope for free-text regex parsing):
  // - A short/malformed fare-basis code (not exactly 8 chars) sitting directly against a Q
  //   surcharge with no separator can have farePattern's [A-Z0-9]{8} swallow into the Q token's
  //   characters, corrupting the *displayed* fare-basis text (numeric totals are usually still
  //   right, since qPattern independently re-finds the same digits elsewhere).
  // - A coincidental bare 6-letter uppercase word directly touching digits (e.g. "REBOOK50.00",
  //   not an actual airport-pair) is indistinguishable from a real bare-airport-code Q surcharge
  //   and will be read as one.

  // Extract fare amounts (numbers before fare basis codes)
  // Pattern: number (with or without decimal) followed by 8-character fare basis (alphanumeric), optional CH|IN suffix, and a /1-8 character ticket designator (alphanumeric, captured for display) — 8 is IATA's actual max designator length, not an arbitrary cap
  const farePattern = /(\d+(?:\.\d+)?)([A-Z0-9]{8})(CH|IN)?(\/[A-Z0-9]{1,8})?/g;
  let fareMatch;
  while ((fareMatch = farePattern.exec(farePart)) !== null && result.fareComponents.length < 6) {
    result.fareComponents.push({
      amount: parseFloat(fareMatch[1]),
      fareBasis: fareMatch[2],
      suffix: fareMatch[3] || '',
      paxType: getPaxType(fareMatch[3] || ''),
      designator: fareMatch[4] || '',
      index: fareMatch.index,
    });
  }

  // Extract Q surcharges. Named capture groups are used deliberately (not positional
  // qMatch[1]/[2]/... ) so adding/reordering alternatives below can never silently shift an
  // index and start reading the wrong group — that class of bug is exactly what motivated
  // rewriting this from positional groups in the first place.
  //
  // qDirect: Q immediately followed by a number, e.g. Q5.00, Q24.94 — no lookbehind restriction,
  //   because this shape can never match inside an 8-char fare basis code (see qCoded below), so
  //   it's always safe even when directly preceded by another surcharge's digits with no
  //   separator, e.g. "Q3.13Q24.94" (two consecutive surcharges, a common real fare string shape
  //   that a blanket "Q must not follow a digit" lookbehind used to incorrectly swallow).
  // qCoded: Q + one or two 3-letter airport codes + a number, e.g. QBOM5.00, Q BOMCCU5.00 — keeps
  //   the negative lookbehind, because THIS shape is the one that can false-positive-match inside
  //   a fare basis code (e.g. "256.70QWEEPIN1": Q + "WEE" + "PIN" + "1" looks identical in form).
  // qNumFirst: number then Q then optional airport code(s), e.g. 58.47QDUB, 470.74QHAM.
  // qNumQ: Q + 6-letter airport pair + number + Q, e.g. Q DUBCOK58.47Q.
  // qAirport / qAirportQ: bare 6-letter airport pair + number, with or without a trailing Q,
  //   e.g. DUBCOK18.82, DUBCOK58.47Q.
  const qPattern = /Q\s*(?<qDirect>\d+(?:\.\d+)?)|(?<![A-Z0-9])Q\s*[A-Z]{3}(?:[A-Z]{3})?(?<qCoded>\d+(?:\.\d+)?)|(?<qNumFirst>\d+(?:\.\d+)?)Q(?:\s*[A-Z]{3}){0,2}(?![A-Z0-9])|(?<![A-Z0-9])Q\s*[A-Z]{6}(?<qNumQ>\d+(?:\.\d+)?)Q|(?<![A-Z0-9])[A-Z]{6}(?<qAirport>\d+(?:\.\d+)?)(?![A-Z0-9])|[A-Z]{6}(?<qAirportQ>\d+(?:\.\d+)?)Q(?![A-Z0-9])/g;
  let qMatch;
  while ((qMatch = qPattern.exec(farePart)) !== null) {
    const g = qMatch.groups;
    const amount = g.qDirect || g.qCoded || g.qNumFirst || g.qNumQ || g.qAirport || g.qAirportQ;
    if (amount) {
      result.qSurcharges.push(parseFloat(amount));
    }
  }

  // Flag (don't silently act on) shapes that would otherwise mis-parse into a wrong-but-plausible
  // number with no other indication anything is off — the intended value is ambiguous, so the
  // best we can do is calculate a best-effort result and tell the user to double-check it.
  if (/\d+\.\d+\.\d+/.test(farePart)) {
    result.warnings.push('A number with more than one decimal point was found — the parsed amount(s) may be incorrect.');
  }
  if (/-\d+(?:\.\d+)?[A-Z0-9]{8}/.test(farePart)) {
    result.warnings.push('A negative amount was found before a fare basis code — the minus sign is ignored, so the parsed amount may be incorrect.');
  }

  return result;
}

function clearParser() {
  els.fareCalcString.value = '';
  els.parserResults.style.display = 'none';
  state.lastConvertedFareCalcString = null;
  if (state.activePtc === 'ADT') {
    state.adtParsedFareCalc = null;
  }
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Scales fare components and Q-surcharges in a validated ADT fare calculation string by `percent`,
// forces `paxSuffix` (CH/IN) onto each fare basis code, and recomputes NUC from the scaled totals.
// Mirrors parseFareCalcStringInternal()'s own farePattern/qPattern and its farePart-bounding /
// keyword-lookup logic exactly, so this always scales precisely what the parser itself would read
// out of the same string — kept as literal copies (not a shared reference) because the parser's
// regexes live inside that function's closure; if those patterns change, update both together.
function deriveFareCalcString(adtString, percent, paxSuffix) {
  function findKeywordMatch(keyword) {
    const strict = adtString.match(new RegExp(`(?<=^|\\s)${keyword}\\s*(\\d+(?:\\.\\d+)?)`));
    return strict || adtString.match(new RegExp(`${keyword}\\s*(\\d+(?:\\.\\d+)?)`));
  }

  const nucKeywordMatch = findKeywordMatch('NUC');
  const nucIndex = nucKeywordMatch ? nucKeywordMatch.index : -1;
  const farePart = nucIndex === -1 ? adtString : adtString.slice(0, nucIndex);
  const rest = nucIndex === -1 ? '' : adtString.slice(nucIndex);

  let scaledTotal = 0;

  const farePattern = /(\d+(?:\.\d+)?)([A-Z0-9]{8})(CH|IN)?(?:\/[A-Z0-9]{1,8})?/g;
  const scaledFarePart = farePart.replace(farePattern, (match, amountStr, fareBasis) => {
    const scaled = round2(parseFloat(amountStr) * percent);
    scaledTotal += scaled;
    const trailing = match.slice(amountStr.length + fareBasis.length).replace(/^(CH|IN)/, '');
    return `${scaled.toFixed(2)}${fareBasis}${paxSuffix}${trailing}`;
  });

  const qPattern = /Q\s*(?<qDirect>\d+(?:\.\d+)?)|(?<![A-Z0-9])Q\s*[A-Z]{3}(?:[A-Z]{3})?(?<qCoded>\d+(?:\.\d+)?)|(?<qNumFirst>\d+(?:\.\d+)?)Q(?:\s*[A-Z]{3}){0,2}(?![A-Z0-9])|(?<![A-Z0-9])Q\s*[A-Z]{6}(?<qNumQ>\d+(?:\.\d+)?)Q|(?<![A-Z0-9])[A-Z]{6}(?<qAirport>\d+(?:\.\d+)?)(?![A-Z0-9])|[A-Z]{6}(?<qAirportQ>\d+(?:\.\d+)?)Q(?![A-Z0-9])/g;
  const scaledFarePartWithQ = scaledFarePart.replace(qPattern, (match, ...args) => {
    const g = args[args.length - 1];
    const amountStr = g.qDirect || g.qCoded || g.qNumFirst || g.qNumQ || g.qAirport || g.qAirportQ;
    if (!amountStr) return match;
    const scaled = round2(parseFloat(amountStr) * percent);
    scaledTotal += scaled;
    return match.replace(amountStr, scaled.toFixed(2));
  });

  const recomputedNuc = round2(scaledTotal);
  const scaledRest = rest.replace(/NUC(\d+(?:\.\d+)?)/, `NUC${recomputedNuc.toFixed(2)}`);
  return scaledFarePartWithQ + scaledRest;
}

// Finds top-level (...) side-trip groups. One level of bracket matching is sufficient — IATA
// side trips aren't nested in practice — so any '(' seen while already inside a group is just
// absorbed into that same outer span rather than starting a new one.
function findSideTripSpans(input) {
  const spans = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ')') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          spans.push({ start, end: i + 1 });
          start = -1;
        }
      }
    }
  }
  return spans;
}

// Replaces each side-trip span with equal-length whitespace so every other character's index is
// unchanged — used only to find the outbound/inbound boundary without a side trip's own fare
// component being miscounted as a 3rd/4th "primary" leg.
function buildFareSpine(input, spans) {
  let spine = input;
  spans.forEach(({ start, end }) => {
    spine = spine.slice(0, start) + ' '.repeat(end - start) + spine.slice(end);
  });
  return spine;
}

// Determines the outbound/inbound split point for the hybrid (INF/CNN, CNN/ADT) tabs. Per the
// agreed rule, the first Fare Basis Code in the string is Outbound and the second is Inbound —
// there's no attempt to re-derive this from routing/city codes (this parser has no airport
// database or mileage logic to do that reliably). Side trips are excluded from the "primary"
// component count via the spine (see buildFareSpine) so they can't be mistaken for a 3rd leg;
// `-/` open-jaw markers need no special handling since they never match farePattern and simply
// pass through as routing text on whichever side of the boundary they land on.
// Returns { boundaryIndex, warning }: boundaryIndex is an index into `input` (null if the string
// doesn't have exactly 2 primary fare components, i.e. the split can't be confidently determined —
// e.g. a one-way fare, or a multi-stop fare with more than 2 priced legs).
function findHybridBoundary(input) {
  const spans = findSideTripSpans(input);
  const spine = buildFareSpine(input, spans);

  function findKeywordMatch(keyword, haystack) {
    const strict = haystack.match(new RegExp(`(?<=^|\\s)${keyword}\\s*(\\d+(?:\\.\\d+)?)`));
    return strict || haystack.match(new RegExp(`${keyword}\\s*(\\d+(?:\\.\\d+)?)`));
  }
  const nucMatch = findKeywordMatch('NUC', spine);
  const spineFarePart = nucMatch ? spine.slice(0, nucMatch.index) : spine;

  const farePattern = /(\d+(?:\.\d+)?)([A-Z0-9]{8})(CH|IN)?(?:\/[A-Z0-9]{1,8})?/g;
  const primaryIndices = [];
  let m;
  while ((m = farePattern.exec(spineFarePart)) !== null) {
    primaryIndices.push(m.index);
  }

  if (primaryIndices.length === 2) {
    return { boundaryIndex: primaryIndices[1], warning: null };
  }
  return {
    boundaryIndex: null,
    warning: `Could not confidently split this fare string into outbound/inbound legs (found ${primaryIndices.length} primary fare component${primaryIndices.length === 1 ? '' : 's'}, expected 2) — the whole string was scaled at the outbound rate. Review before using it.`,
  };
}

// Hybrid version of deriveFareCalcString(): applies a different ratio/suffix to the outbound vs.
// inbound fare components and surcharges of the same ADT string, using findHybridBoundary() to
// decide which leg each match belongs to. Unlike deriveFareCalcString(), the fare-component and
// Q-surcharge passes can't simply be chained (one regex-replace after another) — scaling a fare
// amount can change its digit count and shift every later character's position, which would
// silently corrupt the position-based outbound/inbound comparison for the second pass. Instead,
// every edit is computed against the *original* (unmodified) string's positions first and the
// result is assembled in one final pass — see the `edits` array below.
function deriveHybridFareCalcString(adtString, ratios, suffixes) {
  const { boundaryIndex, warning } = findHybridBoundary(adtString);

  function findKeywordMatch(keyword) {
    const strict = adtString.match(new RegExp(`(?<=^|\\s)${keyword}\\s*(\\d+(?:\\.\\d+)?)`));
    return strict || adtString.match(new RegExp(`${keyword}\\s*(\\d+(?:\\.\\d+)?)`));
  }
  const nucKeywordMatch = findKeywordMatch('NUC');
  const nucIndex = nucKeywordMatch ? nucKeywordMatch.index : -1;
  const farePart = nucIndex === -1 ? adtString : adtString.slice(0, nucIndex);
  const rest = nucIndex === -1 ? '' : adtString.slice(nucIndex);

  function phaseFor(index) {
    if (boundaryIndex === null) return 'outbound';
    return index < boundaryIndex ? 'outbound' : 'inbound';
  }

  let scaledTotal = 0;
  const edits = []; // { start, end, text }, positions relative to farePart

  const farePattern = /(\d+(?:\.\d+)?)([A-Z0-9]{8})(CH|IN)?(?:\/[A-Z0-9]{1,8})?/g;
  let fareMatch;
  while ((fareMatch = farePattern.exec(farePart)) !== null) {
    const full = fareMatch[0];
    const amountStr = fareMatch[1];
    const fareBasis = fareMatch[2];
    const phase = phaseFor(fareMatch.index);
    const scaled = round2(parseFloat(amountStr) * ratios[phase]);
    scaledTotal += scaled;
    const trailing = full.slice(amountStr.length + fareBasis.length).replace(/^(CH|IN)/, '');
    edits.push({
      start: fareMatch.index,
      end: fareMatch.index + full.length,
      text: `${scaled.toFixed(2)}${fareBasis}${suffixes[phase]}${trailing}`,
    });
  }

  const qPattern = /Q\s*(?<qDirect>\d+(?:\.\d+)?)|(?<![A-Z0-9])Q\s*[A-Z]{3}(?:[A-Z]{3})?(?<qCoded>\d+(?:\.\d+)?)|(?<qNumFirst>\d+(?:\.\d+)?)Q(?:\s*[A-Z]{3}){0,2}(?![A-Z0-9])|(?<![A-Z0-9])Q\s*[A-Z]{6}(?<qNumQ>\d+(?:\.\d+)?)Q|(?<![A-Z0-9])[A-Z]{6}(?<qAirport>\d+(?:\.\d+)?)(?![A-Z0-9])|[A-Z]{6}(?<qAirportQ>\d+(?:\.\d+)?)Q(?![A-Z0-9])/g;
  let qMatch;
  while ((qMatch = qPattern.exec(farePart)) !== null) {
    const g = qMatch.groups;
    const amountStr = g.qDirect || g.qCoded || g.qNumFirst || g.qNumQ || g.qAirport || g.qAirportQ;
    if (!amountStr) continue;
    const full = qMatch[0];
    const start = qMatch.index;
    const end = start + full.length;
    // Defensive: the fare and Q patterns target disjoint text shapes, but skip anything that
    // would overlap an already-recorded fare-component edit rather than double-editing it.
    if (edits.some(e => start < e.end && end > e.start)) continue;
    const phase = phaseFor(start);
    const scaled = round2(parseFloat(amountStr) * ratios[phase]);
    scaledTotal += scaled;
    edits.push({ start, end, text: full.replace(amountStr, scaled.toFixed(2)) });
  }

  edits.sort((a, b) => a.start - b.start);
  let rebuilt = '';
  let cursor = 0;
  edits.forEach(({ start, end, text }) => {
    if (start < cursor) return;
    rebuilt += farePart.slice(cursor, start) + text;
    cursor = end;
  });
  rebuilt += farePart.slice(cursor);

  const recomputedNuc = round2(scaledTotal);
  const scaledRest = rest.replace(/NUC(\d+(?:\.\d+)?)/, `NUC${recomputedNuc.toFixed(2)}`);
  return { string: rebuilt + scaledRest, warning };
}

// Derives and applies the CNN/INF (single-ratio) or INF/CNN, CNN/ADT (hybrid, two-ratio) Fare
// Calculation String from the last validated ADT string, then runs it through the normal
// parseFareCalcString() pipeline so validation/rendering stay authoritative. `silent` suppresses
// the "validate Adult first" error (used on tab-switch re-derivation, where a missing ADT source
// just means "nothing to refresh yet").
function applyAutoCalc(ptc, { silent = false } = {}) {
  if (!state.adtParsedFareCalc) {
    if (!silent) {
      showError('Please calculate and validate the Adult Fare Calculation String first.');
      els.autoCalcFromAdult.checked = false;
    }
    syncAutoCalcUI();
    return;
  }
  let derived;
  let warning = null;
  if (ptc in PTC_HYBRID_RATIOS) {
    const result = deriveHybridFareCalcString(state.adtParsedFareCalc, PTC_HYBRID_RATIOS[ptc], PTC_HYBRID_SUFFIX[ptc]);
    derived = result.string;
    warning = result.warning;
  } else {
    derived = deriveFareCalcString(state.adtParsedFareCalc, PTC_AUTO_CALC_PERCENT[ptc], PTC_FARE_BASIS_SUFFIX[ptc]);
  }
  els.fareCalcString.value = derived;
  parseFareCalcString();
  syncAutoCalcUI();
  if (warning) {
    showError(warning);
  }
}

function toggleParserSection() {
  els.parserCollapsible.classList.toggle('collapsed');
  els.parserToggleBtn.classList.toggle('collapsed');
  const isCollapsed = els.parserCollapsible.classList.contains('collapsed');
  els.parserToggleBtn.textContent = isCollapsed ? 'Show' : 'Hide';
  els.parserToggleBtn.setAttribute('aria-expanded', !isCollapsed);
}

// Builds the minimal tax-only summary shape used when a PTC has tax data but no fare data yet.
function buildTaxOnlySummaryData(taxResult, addTaxesValue, convertedFareCalcString) {
  const netWithK3 = taxResult.netTax + (taxResult.k3OnYQ || 0);
  return {
    currency: taxResult.currency,
    oldFare: 0,
    newFare: 0,
    diff: 0,
    k3Fare: 0,
    k3Fee: 0,
    k3OnYQ: taxResult.k3OnYQ || 0,
    fee: 0,
    addTaxes: addTaxesValue || '',
    refundTaxes: taxResult.negativeTaxes.join('/') || '',
    taxAdj: netWithK3,
    perPax: netWithK3,
    subTotal: netWithK3,
    pax: 1,
    convertedFareCalcString: convertedFareCalcString || '',
  };
}

// Minimal all-zero summary shape for a PTC that only has a converted Fare Calculation String —
// no fare or tax was ever calculated for it. Mirrors buildTaxOnlySummaryData()'s shape so it
// flows through mergeSummaryData()/renderSummary() identically, just contributing zero to every
// numeric total while still surfacing its Fare Calculation String row.
function buildFareCalcOnlySummaryData(convertedFareCalcString) {
  return {
    currency: '',
    oldFare: 0,
    newFare: 0,
    diff: 0,
    k3Fare: 0,
    k3Fee: 0,
    k3OnYQ: 0,
    fee: 0,
    addTaxes: '',
    refundTaxes: '',
    taxAdj: 0,
    perPax: 0,
    subTotal: 0,
    pax: 1,
    convertedFareCalcString: convertedFareCalcString || '',
  };
}

// Sums the numeric fields of several PTC summaryData objects into one consolidated object.
// Currency must match across all PTCs (mirrors the existing old/new-fare currency-mismatch check).
function mergeSummaryData(dataList) {
  // A fare-calc-string-only PTC has no currency of its own (buildFareCalcOnlySummaryData uses
  // ''), so pick the first PTC that actually has one rather than assuming dataList[0] does —
  // otherwise a currency-less PTC sorting first (e.g. ADT with only a converted string) would
  // blank out the whole merged row's currency even though CNN/INF have real amounts.
  const currency = dataList.map(d => d.currency).find(Boolean) || '';
  const mismatch = dataList.find(d => d.currency && currency && d.currency !== currency);
  if (mismatch) {
    return { error: `All passenger types must use the same currency to summarise together (found ${currency} and ${mismatch.currency}).` };
  }
  const numericKeys = ['oldFare', 'newFare', 'diff', 'k3Fare', 'k3Fee', 'k3OnYQ', 'fee', 'taxAdj', 'subTotal', 'pax'];
  const merged = { currency, addTaxes: '', refundTaxes: '', convertedFareCalcString: '' };
  numericKeys.forEach(key => { merged[key] = dataList.reduce((sum, d) => sum + (d[key] || 0), 0); });
  merged.perPax = merged.pax > 0 ? merged.subTotal / merged.pax : merged.subTotal;
  merged.addTaxes = dataList.map(d => d.addTaxes).filter(Boolean).join('/');
  merged.refundTaxes = dataList.map(d => d.refundTaxes).filter(Boolean).join('/');
  merged.convertedFareCalcString = dataList.map(d => d.convertedFareCalcString).filter(Boolean).join(' // ');
  return merged;
}

function handleSummarise() {
  // Make sure the currently active tab's latest numbers are captured before aggregating,
  // even if a tax-only (or fare-calc-string-only) calculation hasn't been synced to ptcData yet.
  if (state.ptcData[state.activePtc].summaryData) {
    // summaryData already exists (calculateFare() ran at some point) — but
    // convertedFareCalcString is only baked in at calculateFare()-time, so if the user
    // re-converts the Fare Calculation String afterward without recalculating the fare, the
    // stored copy goes stale. Refresh it from the current per-tab state every time Summarise is
    // clicked, regardless of whether fare-calc or fare-diff was done first.
    state.ptcData[state.activePtc].summaryData.convertedFareCalcString = state.lastConvertedFareCalcString || '';
  } else if (state.lastTaxResult) {
    state.ptcData[state.activePtc].summaryData = buildTaxOnlySummaryData(
      state.lastTaxResult, els.addTaxes.value, state.lastConvertedFareCalcString
    );
  } else if (state.lastConvertedFareCalcString) {
    state.ptcData[state.activePtc].summaryData = buildFareCalcOnlySummaryData(state.lastConvertedFareCalcString);
  }

  // Inactive PTC tabs only have their last-saved snapshot (no live DOM state to read here). A
  // tab that has a converted Fare Calc String but never had a fare/tax calculated still needs a
  // zero-valued summary entry so its string shows up — otherwise it's silently excluded from
  // both the single-PTC and consolidated summary just because it has no fare/tax numbers.
  PTC_CODES.forEach(ptc => {
    if (ptc === state.activePtc) return;
    const entry = state.ptcData[ptc];
    const savedFcs = entry.formSnapshot?.stateValues?.lastConvertedFareCalcString || '';
    if (entry.summaryData) {
      entry.summaryData.convertedFareCalcString = savedFcs;
    } else if (savedFcs) {
      entry.summaryData = buildFareCalcOnlySummaryData(savedFcs);
    }
  });

  const activePtcs = getActivePtcCodes();
  if (activePtcs.length === 0) {
    showError('No calculation data available. Please calculate fare or taxes first.');
    return;
  }

  const breakdown = activePtcs.map(ptc => ({ ptc, data: state.ptcData[ptc].summaryData }));

  if (activePtcs.length === 1) {
    renderSummary(breakdown[0].data, breakdown);
    return;
  }

  const consolidated = mergeSummaryData(breakdown.map(b => b.data));
  if (consolidated.error) {
    showError(consolidated.error);
    return;
  }
  renderSummary(consolidated, breakdown);
}

// Help icon click to show keyboard shortcuts
els.helpIcon.addEventListener('click', openHelpModal);

// Theme toggle functionality
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  els.themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
  localStorage.setItem('theme', newTheme);
}

// Load saved theme preference
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  els.themeToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';
}

// Initialize theme and any auto-saved session on load
loadTheme();
loadStateFromStorage();
updatePtcTabUI();

// Theme toggle click event
els.themeToggle.addEventListener('click', toggleTheme);

// Enter key to calculate
els.oldTax.addEventListener('keypress', (e) => { if (e.key === 'Enter') calculateTaxes(); });
els.newTax.addEventListener('keypress', (e) => { if (e.key === 'Enter') calculateTaxes(); });
els.oldFare.addEventListener('keypress', (e) => { if (e.key === 'Enter') calculateFare(); });
els.newFare.addEventListener('keypress', (e) => { if (e.key === 'Enter') calculateFare(); });
els.changeFee.addEventListener('keypress', (e) => { if (e.key === 'Enter') calculateFare(); });
document.addEventListener('keydown', (e) => {
  const errorModal = document.getElementById('errorModal');
  const helpModal = document.getElementById('helpModal');
  const isErrorModalOpen = errorModal?.classList.contains('show');
  const isHelpModalOpen = helpModal?.classList.contains('show');
  const isAnyModalOpen = isErrorModalOpen || isHelpModalOpen;

  // Handle modal closing
  if (isAnyModalOpen && e.key === 'Escape') {
    e.preventDefault();
    if (isErrorModalOpen) closeErrorModal();
    if (isHelpModalOpen) closeHelpModal();
    return;
  }

  if (isErrorModalOpen && e.key === 'Enter') {
    e.preventDefault();
    closeErrorModal();
    return;
  }

  // Keyboard shortcuts (only when no modal is open)
  if (!isAnyModalOpen) {
    // Ctrl + Shift + C - Clear Fare (Ctrl+C reserved for OS copy)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      clearFare();
      return;
    }
    // Ctrl + X - Clear Taxes
    if (e.ctrlKey && e.key === 'x') {
      e.preventDefault();
      clearTaxes();
      return;
    }
    // Ctrl + M - Toggle Dark/Light Mode
    if (e.ctrlKey && e.key === 'm') {
      e.preventDefault();
      toggleTheme();
      return;
    }
    // Ctrl + ? - Show Help
    if (e.ctrlKey && (e.key === '?' || e.key === '/')) {
      e.preventDefault();
      openHelpModal();
      return;
    }
  }

  // Regular Enter key for calculation (only for fare fields, not tax fields)
  if (!isAnyModalOpen && e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
    // Don't handle Enter if it's on tax fields (they have their own handlers)
    if (e.target.id === 'oldTax' || e.target.id === 'newTax') {
      return;
    }
    e.preventDefault();
    calculateFare();
  }
});

function tryCalculateTaxes() {
  if (els.oldTax.value.trim() && els.newTax.value.trim()) {
    calculateTaxes();
  }
}

function isK3Requested() {
  return els.applyK3OnFareDiff.checked || els.applyK3OnChangeFee.checked;
}

function validateK3CabinSelection() {
  if (isK3Requested() && !els.cabin.value) {
    showError('Select cabin when K3 is requested.');
    return false;
  }
  return true;
}

function tryCalculateFare() {
  if (!validateK3CabinSelection()) return;

  const oldFare = parseAmount(els.oldFare.value);
  const newFare = parseAmount(els.newFare.value);
  if (!oldFare || !newFare) return;

  if (oldFare.currency && newFare.currency && oldFare.currency !== newFare.currency) {
    showError('Old Fare and New Fare must use the same currency.');
    return;
  }

  calculateFare();
}

function toggleTaxSection() {
  els.taxCollapsible.classList.toggle('collapsed');
  els.taxToggleBtn.classList.toggle('collapsed', els.taxCollapsible.classList.contains('collapsed'));
  els.taxToggleBtn.textContent = els.taxCollapsible.classList.contains('collapsed') ? 'Show' : 'Hide';
}

function formatAmount(value, currency = '') {
  if (!value) return '0';
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  
  // Get rounding rule for currency, default to standard 2 decimals
  const rule = roundingRules[currency] || { type: 'standard', decimals: 2 };
  let rounded;
  
  if (rule.type === 'ceiling') {
    // Round up (Math.ceil)
    rounded = Math.ceil(num);
  } else if (rule.type === 'nearest') {
    // Round to nearest
    const multiplier = Math.pow(10, rule.decimals);
    rounded = Math.round(num * multiplier) / multiplier;
  } else {
    // Standard rounding (default)
    const multiplier = Math.pow(10, rule.decimals);
    rounded = Math.round(num * multiplier) / multiplier;
  }
  
  // Format with correct decimal places (no thousand separators for parsing consistency)
  if (rule.decimals === 0) {
    return rounded.toString();
  }
  return rounded.toFixed(rule.decimals);
}

function parseAmount(text) {
  if (!text) return null;
  const m = text.trim().match(/^(?:([A-Z]{3})\s*)?([+-]?\d+(?:\.\d+)?)(?:\s*([A-Z]{3}))?$/i);
  if (!m) return null;
  const amount = parseFloat(m[2]);
  if (!Number.isFinite(amount)) return null;
  return {
    currency: (m[1] || m[3]) ? (m[1] || m[3]).toUpperCase() : null,
    amount,
  };
}

function parseTaxToken(token) {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const isPaid = trimmed.toUpperCase().startsWith('PD');
  const content = isPaid ? trimmed.slice(2).trim() : trimmed;
  // Tax/fee codes are always exactly 2 characters (IATA convention, e.g. YQ, K3, 6A) — anchoring
  // the code group to {2} instead of {1,6} stops a greedy amount match from swallowing the
  // leading digit of a digit+letter code like "6A" (e.g. "10006A" is amount 1000, code 6A,
  // not amount 10006, code A).
  const m = content.match(/^([A-Z]{3})?\s*([+-]?\d+(?:\.\d+)?)\s*([A-Z0-9]{2})$/i);
  if (!m) return null;
  const amount = parseFloat(m[2]);
  if (!Number.isFinite(amount)) return null;
  return {
    currency: m[1] ? m[1].toUpperCase() : null,
    amount,
    code: m[3].toUpperCase(),
    isPaid,
  };
}

function sanitizeTaxString(text) {
  return text
    .split('/')
    .map(entry => entry.trim())
    .filter(Boolean)
    .join('/');
}

function formatTaxInput(text) {
  if (!text) return '';
  
  // Split by multiple separators: spaces, commas, newlines, tabs, slashes
  const entries = text.split(/[\s,\/\n\t]+/).filter(Boolean);
  const validEntries = [];
  const invalidEntries = [];
  
  // Validate each entry: 3-letter currency + amount + exactly 2-character tax code (letters
  // and/or digits, e.g. YQ, K3, 6A — see parseTaxToken for why this must be exactly 2, not 1-6).
  const pattern = /^([A-Z]{3})(\d+(?:\.\d+)?)([A-Z0-9]{2})$/i;
  const paidPattern = /^PD(?:([A-Z]{3}))?(\d+(?:\.\d+)?)([A-Z0-9]{2})$/i;
  
  entries.forEach(entry => {
    const normalized = entry.trim().toUpperCase();
    const paidMatch = normalized.match(paidPattern);
    if (paidMatch) {
      const currency = paidMatch[1] ? paidMatch[1].toUpperCase() : '';
      const formatted = currency ? `PD${currency}${paidMatch[2]}${paidMatch[3].toUpperCase()}` : `PD${paidMatch[2]}${paidMatch[3].toUpperCase()}`;
      validEntries.push(formatted);
      return;
    }
    const match = normalized.match(pattern);
    if (match) {
      // Format as CurrencyAmountTaxCode (uppercase, no spaces)
      const formatted = `${match[1].toUpperCase()}${match[2]}${match[3].toUpperCase()}`;
      validEntries.push(formatted);
    } else {
      invalidEntries.push(entry);
    }
  });
  
  // Show warning for invalid entries
  if (invalidEntries.length > 0) {
    showError(`Skipped invalid tax entries: ${invalidEntries.join(', ')}. Format: CurrencyAmountTaxCode (e.g., INR30K3)`);
  }
  
  // Join valid entries with slashes
  return validEntries.join('/');
}

function updateAddTaxesWithK3(baseAddTaxes, k3FareStr) {
  const cleaned = sanitizeTaxString(
    (baseAddTaxes || '')
      .split('/')
      .filter(entry => !entry.trim().includes('K3'))
      .join('/')
  );
  return [cleaned, k3FareStr].filter(Boolean).join('/');
}

// "PD" only marks an entry as already paid for the reader's benefit — it does not change how
// the entry is totaled. Both PD and non-PD amounts for a code are summed into the same bucket
// on each side, so: identical PD amounts restated on both sides net to a 0 diff (nothing owed),
// while any extra amount on either side (PD or not) still shows up as the real difference.
function parseTaxes(text) {
  const taxes = {};
  if (!text) return { taxes, currency: null };
  const tokens = text.split(/[\/\n,]+/);
  const parsedTokens = tokens.map(parseTaxToken).filter(Boolean);
  const inferredCurrency = parsedTokens.find(t => t.currency)?.currency || 'INR';
  parsedTokens.forEach(parsed => {
    const cur = parsed.currency || inferredCurrency;
    const key = `${cur}${parsed.code}`;
    taxes[key] = (taxes[key] || 0) + parsed.amount;
  });
  return { taxes, currency: inferredCurrency };
}

function getCurrentFareK3State(currencyOverride = null) {
  const oldFare = parseAmount(els.oldFare.value);
  const newFare = parseAmount(els.newFare.value);
  const explicitFareCurrency = oldFare?.currency ?? newFare?.currency;
  const currency = explicitFareCurrency || currencyOverride || state.lastTaxResult?.currency || els.currency.value || 'INR';
  const diff = oldFare && newFare ? newFare.amount - oldFare.amount : 0;
  const feeAmount = parseAmount(els.changeFee.value)?.amount ?? 0;
  const applyFareDiffK3 = els.applyK3OnFareDiff.checked;
  const applyChangeFeeK3 = els.applyK3OnChangeFee.checked;
  const cabin = els.cabin.value;
  const k3Requested = (applyFareDiffK3 && diff > 0) || (applyChangeFeeK3 && feeAmount !== 0);

  let k3Fare = 0;
  let k3Fee = 0;

  if (k3Requested && cabin) {
    const rate = K3_RATES[cabin] ?? 0.05;
    if (applyFareDiffK3 && diff > 0) {
      k3Fare = diff * rate;
    }
    if (applyChangeFeeK3 && feeAmount !== 0) {
      k3Fee = feeAmount * rate;
    }
  }

  return {
    currency,
    diff,
    feeAmount,
    cabin,
    k3Requested,
    k3Fare,
    k3Fee,
    totalK3: k3Fare + k3Fee,
    k3Label: (k3Fare + k3Fee) > 0 ? `${currency}${formatAmount(k3Fare + k3Fee, currency)}` : 'N/A',
    k3FareStr: k3Fare > 0 ? `${currency}${formatAmount(k3Fare, currency)}K3` : '',
  };
}

function calculateTaxes() {
  // Prevent recursive calls
  if (state.isCalculatingTax) return;
  state.isCalculatingTax = true;
  
  const oldText = els.oldTax.value;
  const newText = els.newTax.value;
  if (!oldText || !newText) {
    showError('Enter both OLD TAX and NEW TAX.');
    state.isCalculatingTax = false;
    return;
  }

  // Check cache
  const cacheKey = JSON.stringify({ oldText, newText, applyK3OnYQ: els.applyK3OnYQ.checked });
  if (state.taxCalculationCache.has(cacheKey)) {
    const cachedResult = state.taxCalculationCache.get(cacheKey);
    renderTaxResult(cachedResult);
    state.isCalculatingTax = false;
    return;
  }

  const oldTaxData = parseTaxes(oldText);
  const newTaxData = parseTaxes(newText);
  const oldTaxes = oldTaxData.taxes;
  const newTaxes = newTaxData.taxes;

  let firstCurrency = null;
  const result = {
    positiveTaxes: [],
    negativeTaxes: [],
    posTotal: 0,
    negTotal: 0,
    currency: null,
  };

  // PD amounts are merged into oldTaxes/newTaxes just like regular entries (see parseTaxes),
  // so a code that's fully restated (PD or not) on both sides nets to a 0 diff automatically,
  // while any genuinely extra amount on either side still comes through as the real difference.
  const allTaxCodes = new Set([
    ...Object.keys(oldTaxes).map(k => k.substring(3)),
    ...Object.keys(newTaxes).map(k => k.substring(3)),
  ]);

  allTaxCodes.forEach(code => {
    const matchingOldKeys = Object.keys(oldTaxes).filter(k => k.endsWith(code));
    const matchingNewKeys = Object.keys(newTaxes).filter(k => k.endsWith(code));

    const oldAmount = matchingOldKeys.reduce((sum, key) => sum + (oldTaxes[key] || 0), 0);
    const newAmount = matchingNewKeys.reduce((sum, key) => sum + (newTaxes[key] || 0), 0);
    const diff = newAmount - oldAmount;

    if (diff === 0) {
      return;
    }

    const currency = matchingNewKeys.length > 0
      ? matchingNewKeys[0].match(/^([A-Z]{3})/)[1]
      : matchingOldKeys.length > 0
        ? matchingOldKeys[0].match(/^([A-Z]{3})/)[1]
        : firstCurrency ?? 'INR';

    if (!firstCurrency) firstCurrency = currency;

    if (diff > 0) {
      const label = `${currency}${formatAmount(diff, currency)}${code}`;
      result.positiveTaxes.push(label);
      result.posTotal += diff;
    } else if (diff < 0) {
      const label = `-${currency}${formatAmount(Math.abs(diff), currency)}${code}`;
      result.negativeTaxes.push(label);
      result.negTotal += diff;
    }
  });

  result.currency = firstCurrency ?? newTaxData.currency ?? oldTaxData.currency ?? 'INR';
  result.netTax = result.posTotal + result.negTotal;

  // Calculate K3 on positive YQ if checkbox is checked
  let k3OnYQ = 0;
  if (els.applyK3OnYQ.checked) {
    // Find positive YQ tax amount
    const yqPattern = /YQ$/i;
    const yqTax = result.positiveTaxes.find(tax => yqPattern.test(tax));
    if (yqTax) {
      const yqMatch = yqTax.match(/^([A-Z]{3})([0-9]+(?:\.[0-9]+)?)YQ$/i);
      if (yqMatch) {
        const yqAmount = parseFloat(yqMatch[2]);
        // Calculate K3 based on cabin selection
        if (els.cabin.value) {
          const rate = K3_RATES[els.cabin.value] ?? 0.05;
          k3OnYQ = yqAmount * rate;
        } else {
          showError('Select cabin when K3 on YQ is requested.');
          // Calculation continues with k3OnYQ = 0
        }
      }
    }
  }
  result.k3OnYQ = k3OnYQ;

  // Store in cache
  state.taxCalculationCache.set(cacheKey, result);

  renderTaxResult(result);

  // Update fare calculator fields with recalculated values (without rendering summary)
  const netTaxOnly = result.netTax;
  const fareK3State = getCurrentFareK3State(result.currency);
  // Change-fee K3 is excluded here; it is added separately via k3FeeAmount below and belongs
  // to the Change Fee field, not the tax adjustment / Add Taxes total.
  const k3FromFare = (result.currency === fareK3State.currency) ? fareK3State.k3Fare : 0;
  const totalK3 = k3FromFare + k3OnYQ;
  const netTaxWithK3 = netTaxOnly + totalK3;

  els.taxAdj.value = result.currency ? `${result.currency}${formatAmount(netTaxWithK3, result.currency)}` : '';

  // Keep the active tab's stored summary data live-updated with the new tax numbers, whatever
  // kind of summary it currently is — fare-based (built by calculateFare()) or a tax-only /
  // fare-calc-only one built by handleSummarise() when Summarise was clicked before any fare was
  // entered. Targeting state.ptcData directly (rather than state.lastSummaryData, which a
  // tax-only/fare-calc-only summary is never assigned to) is what makes a recalculation always
  // reach whichever object is actually canonical for this tab, regardless of how it was created
  // or in what order fare/tax/Summarise happened — otherwise a Summary built before any fare
  // existed would silently stop picking up further tax edits.
  const activeSummary = state.ptcData[state.activePtc].summaryData;
  if (activeSummary) {
    const diff = activeSummary.diff;
    const feeAmount = activeSummary.fee;
    const k3FeeAmount = fareK3State.k3Fee;
    const passengerCount = activeSummary.pax;
    const perPax = diff + feeAmount + k3FeeAmount + netTaxWithK3;
    const subTotal = perPax * passengerCount;

    els.perPax.value = `${result.currency}${formatAmount(perPax, result.currency)}`;
    els.subTotal.value = `${result.currency}${formatAmount(subTotal, result.currency)}`;

    // Update stored summary data with new tax adjustment and Add Taxes text (K3 on YQ may have changed)
    activeSummary.taxAdj = netTaxWithK3;
    activeSummary.perPax = perPax;
    activeSummary.subTotal = subTotal;
    activeSummary.addTaxes = els.addTaxes.value;
    activeSummary.k3OnYQ = k3OnYQ;
  }

  state.isCalculatingTax = false;
  saveStateToStorage();
}

function buildCurrentSummaryData() {
  const currency = state.lastFareCurrency ?? state.lastTaxResult?.currency ?? els.currency.value ?? 'INR';
  const oldFare = parseAmount(els.oldFare.value);
  const newFare = parseAmount(els.newFare.value);
  const fee = parseAmount(els.changeFee.value);
  const diff = oldFare && newFare ? newFare.amount - oldFare.amount : 0;

  const fareK3State = getCurrentFareK3State(state.lastTaxResult?.currency);
  const k3FareAmount = fareK3State.k3Fare;
  // Only include K3 from fare if currencies match
  const k3FeeAmount = (fareK3State.currency === state.lastTaxResult?.currency) ? fareK3State.k3Fee : 0;
  const k3OnYQ = state.lastTaxResult?.k3OnYQ ?? 0;
  const feeAmount = fee ? fee.amount : 0;
  const netTaxOnly = state.lastTaxResult ? state.lastTaxResult.netTax : 0;
  const passengerCount = Math.max(1, parseInt(els.pax.value, 10) ?? 1);
  
  // Only add K3 to tax adjustment if currencies match
  const taxAdj = state.lastTaxResult 
    ? state.lastTaxResult.netTax + ((fareK3State.currency === state.lastTaxResult.currency) ? k3FareAmount + k3OnYQ : 0)
    : k3FareAmount + k3OnYQ;
  // Recalculate perPax and subTotal to include tax adjustment
  const perPax = diff + feeAmount + k3FeeAmount + taxAdj;
  const subTotal = perPax * passengerCount;

  return {
    currency,
    oldFare: oldFare ? oldFare.amount : 0,
    newFare: newFare ? newFare.amount : 0,
    diff,
    k3Fare: k3FareAmount,
    k3Fee: k3FeeAmount,
    k3OnYQ,
    fee: feeAmount,
    addTaxes: els.addTaxes.value,
    refundTaxes: els.refundTaxes.value,
    taxAdj,
    perPax,
    subTotal,
    pax: passengerCount,
    convertedFareCalcString: state.lastConvertedFareCalcString || '',
  };
}

function extractK3FareFromAddTaxes() {
  if (!els.addTaxes.value) return 0;
  const entries = els.addTaxes.value.split('/').map(e => e.trim());
  for (const entry of entries) {
    const match = entry.match(/^([A-Z]{3})([0-9]+(?:\.[0-9]+)?)K3$/);
    if (match) {
      return parseFloat(match[2]);
    }
  }
  return 0;
}

function renderTaxResult(result) {
  const noTaxes = result.currency ? `${result.currency}${formatAmount(0, result.currency)}` : 'None';

  // Use DocumentFragment for batch DOM updates
  const fragment = document.createDocumentFragment();
  const div = document.createElement('div');
  let k3OnYQDisplay = '';
  if (result.k3OnYQ > 0) {
    k3OnYQDisplay = `<br><b>K3 on YQ:</b> ${result.currency}${formatAmount(result.k3OnYQ, result.currency)}`;
  }
  div.innerHTML = `
    <b>Positive Taxes</b><br><br>
    <span class="pos">${result.positiveTaxes.join('/') || noTaxes}</span><br><br>
    <b>Negative Taxes</b><br><br>
    <span class="neg">${result.negativeTaxes.join('/') || 'None'}</span><br><br>
    <b>Positive Total:</b> ${result.currency}${formatAmount(result.posTotal, result.currency)}<br>
    <b>Negative Total:</b> -${result.currency}${formatAmount(Math.abs(result.negTotal), result.currency)}<br>
    <b>Net Total:</b> ${result.currency}${formatAmount(result.netTax, result.currency)}${k3OnYQDisplay}
  `;
  fragment.appendChild(div);
  els.taxResult.innerHTML = '';
  els.taxResult.appendChild(fragment);

  // Calculate total K3 (fare diff K3 + YQ K3). Change-fee K3 is excluded here since it is
  // already reflected in the Change Fee field, not the Add Taxes field.
  const fareK3State = getCurrentFareK3State();
  const k3FromFare = (result.currency === fareK3State.currency) ? fareK3State.k3Fare : 0;
  const k3OnYQ = result.k3OnYQ || 0;
  const totalK3 = k3FromFare + k3OnYQ;

  // Add total K3 to add taxes as a single entry
  const positiveTaxStr = result.positiveTaxes.join('/');
  let k3TaxStr = '';
  if (totalK3 > 0) {
    k3TaxStr = `${result.currency}${formatAmount(totalK3, result.currency)}K3`;
  }
  els.addTaxes.value = updateAddTaxesWithK3(positiveTaxStr, k3TaxStr);
  els.refundTaxes.value = result.negativeTaxes.join('/') || '';

  if (fareK3State.k3Fare > 0 && result.currency !== fareK3State.currency) {
    showError(`K3 from last fare calculation (${fareK3State.currency}${formatAmount(fareK3State.k3Fare, fareK3State.currency)}) is not added because tax currency is ${result.currency}.`);
  }
  els.taxAdj.value = result.currency ? `${result.currency}${formatAmount(result.netTax + totalK3, result.currency)}` : '';
  state.lastTaxResult = result;
}

function clearTaxes() {
  els.oldTax.value = '';
  els.newTax.value = '';
  els.taxResult.innerHTML = '';
  els.addTaxes.value = '';
  els.refundTaxes.value = '';
  els.taxAdj.value = '';
  els.applyK3OnYQ.checked = false;
  state.lastTaxResult = null;
  state.clearTaxCache();
  // Also hide summary content when taxes are cleared
  els.summaryContent.style.display = 'none';
  els.summary.innerHTML = '';
  els.gdsString.value = '';
  state.lastSummaryData = null;
  state.ptcData[state.activePtc].summaryData = null;
  updatePtcTabUI();
}

function showINRMessage(message) {
  if (els.inrMessage) {
    els.inrMessage.textContent = message;
  }
}

function clearINRMessage() {
  if (els.inrMessage) {
    els.inrMessage.textContent = '';
  }
}

function calculateFare() {
  // Prevent recursive calls
  if (state.isCalculatingFare) return;
  state.isCalculatingFare = true;
  
  const oldFare = parseAmount(els.oldFare.value);
  const newFare = parseAmount(els.newFare.value);
  if (!oldFare || !newFare) {
    showError('Enter both Old Base Fare and New Base Fare.');
    state.isCalculatingFare = false;
    return;
  }

  const currency = oldFare.currency ?? newFare.currency ?? state.lastTaxResult?.currency ?? els.currency.value;
  if (oldFare.currency && newFare.currency && oldFare.currency !== newFare.currency) {
    showError('Old Fare and New Fare must use the same currency.');
    state.isCalculatingFare = false;
    return;
  }

  if (currency === 'INR') {
    showINRMessage('INR currency detected, check if K3 needs to be calculated.');
  } else {
    clearINRMessage();
  }

  const fee = parseAmount(els.changeFee.value) ?? { amount: 0, currency };
  const passengerCount = Math.max(1, parseInt(els.pax.value, 10) ?? 1);
  const diff = newFare.amount - oldFare.amount;
  els.fareDiff.value = `${currency}${formatAmount(diff, currency)}`;

  const fareK3State = getCurrentFareK3State(currency);
  const applyFareDiffK3 = fareK3State.k3Requested && els.applyK3OnFareDiff.checked;
  const applyChangeFeeK3 = fareK3State.k3Requested && els.applyK3OnChangeFee.checked;

  // Check cache
  const fareCacheKey = JSON.stringify({
    oldFare: els.oldFare.value,
    newFare: els.newFare.value,
    changeFee: els.changeFee.value,
    applyFareDiffK3,
    applyChangeFeeK3,
    cabin: els.cabin.value,
    pax: passengerCount,
    taxAdj: state.lastTaxResult?.netTax ?? 0
  });
  
  if (state.fareCalculationCache.has(fareCacheKey)) {
    const cachedResult = state.fareCalculationCache.get(fareCacheKey);
    // Restore cached values
    els.k3Tax.value = cachedResult.k3Label;
    els.perPax.value = `${currency}${formatAmount(cachedResult.perPassenger, currency)}`;
    els.subTotal.value = `${currency}${formatAmount(cachedResult.subTotal, currency)}`;
    // Store summary data for manual summarise button
    state.lastSummaryData = cachedResult.summaryData;
    state.ptcData[state.activePtc].summaryData = cachedResult.summaryData;
    updatePtcTabUI();
    state.isCalculatingFare = false;
    return;
  }

  let k3Fare = fareK3State.k3Fare;
  let k3Fee = fareK3State.k3Fee;
  let k3Label = fareK3State.k3Label;
  if (fareK3State.k3Requested && !fareK3State.cabin) {
    const cabinError = '⚠️ K3 requested. Select cabin to calculate K3.';
    showError(cabinError);
    state.isCalculatingFare = false;
    return;
  }
  els.k3Tax.value = k3Label;

  // Track K3 fare state to preserve it if tax adjustment is recalculated later
  state.updateFareK3(currency, k3Fare + k3Fee, k3Fare > 0 ? `${currency}${formatAmount(k3Fare, currency)}K3` : '');

  const netTaxOnly = state.lastTaxResult ? state.lastTaxResult.netTax : 0;
  const k3OnYQ = state.lastTaxResult?.k3OnYQ ?? 0;

  // Append combined K3 (fare diff + YQ) to Add Taxes (remove any existing K3 first to prevent duplication)
  const k3ForAddTaxes = k3Fare + k3OnYQ;
  if (k3ForAddTaxes > 0) {
    // Remove existing K3 entries first to ensure clean state
    removeK3FFromAddTaxes();
    // Append new K3
    const k3FareStr = `${currency}${formatAmount(k3ForAddTaxes, currency)}K3`;
    els.addTaxes.value = updateAddTaxesWithK3(els.addTaxes.value, k3FareStr);
  } else {
    // Remove K3 entries if K3 is not applied (checkboxes deselected)
    removeK3FFromAddTaxes();
  }

  const feeWithK3 = fee.amount + k3Fee;
  const k3Total = k3Fare + k3Fee;
  // Include K3 on fare diff and K3 on YQ in net tax adjustment, not K3 on change fee
  const netTaxWithK3 = netTaxOnly + k3Fare + k3OnYQ;
  const perPassenger = diff + fee.amount + k3Fee + netTaxWithK3;
  const subTotal = perPassenger * passengerCount;

  els.taxAdj.value = `${currency}${formatAmount(netTaxWithK3, currency)}`;
  els.perPax.value = `${currency}${formatAmount(perPassenger, currency)}`;
  els.subTotal.value = `${currency}${formatAmount(subTotal, currency)}`;

  const summaryData = {
    currency,
    oldFare: oldFare ? oldFare.amount : 0,
    newFare: newFare ? newFare.amount : 0,
    diff,
    k3Fare,
    k3Fee,
    k3OnYQ,
    fee: fee.amount,
    addTaxes: els.addTaxes.value,
    refundTaxes: els.refundTaxes.value,
    taxAdj: netTaxWithK3,
    perPax: perPassenger,
    subTotal,
    pax: passengerCount,
    convertedFareCalcString: state.lastConvertedFareCalcString || '',
  };

  // Store in cache
  state.fareCalculationCache.set(fareCacheKey, {
    k3Label,
    perPassenger,
    subTotal,
    summaryData
  });

  // Store summary data for manual summarise button
  state.lastSummaryData = summaryData;
  state.ptcData[state.activePtc].summaryData = summaryData;
  updatePtcTabUI();

  state.isCalculatingFare = false;
}

// One row definition per summary metric: a label plus a getter that formats that metric
// for a single PTC's summaryData object. Shared by both the single- and multi-PTC table.
const SUMMARY_ROW_DEFS = [
  { label: 'Old Fare', get: d => `${d.currency}${formatAmount(d.oldFare, d.currency)}` },
  { label: 'New Fare', get: d => `${d.currency}${formatAmount(d.newFare, d.currency)}` },
  { label: 'Fare Difference', get: d => `${d.currency}${formatAmount(d.diff, d.currency)}` },
  {
    label: 'Change Fee',
    get: d => d.k3Fee > 0
      ? `${d.currency}${formatAmount(d.fee + d.k3Fee, d.currency)} (incl. K3 ${d.currency}${formatAmount(d.k3Fee, d.currency)})`
      : `${d.currency}${formatAmount(d.fee, d.currency)}`,
  },
  { label: 'Add Taxes', get: d => d.addTaxes || '-' },
  { label: 'Refund Taxes', get: d => d.refundTaxes || '-' },
  { label: 'Tax Adjustment (Net)', get: d => `${d.currency}${formatAmount(d.taxAdj, d.currency)}` },
  { label: 'Amount Payable per Pax', get: d => `${d.currency}${formatAmount(d.perPax, d.currency)}` },
  { label: 'No. of Pax', get: d => `${d.pax}` },
  { label: 'Sub Total', get: d => `${d.currency}${formatAmount(d.subTotal, d.currency)}` },
];

// `breakdown`: [{ ptc, data }] for every PTC with data (1-3 entries). `amountPayable`
// (optional): total Sub Total across all active PTCs, shown as a single full-width row
// between Sub Total and the Fare Calculation String rows — only when more than one PTC is
// active (a lone PTC's Amount Payable would just repeat its own Sub Total). Builds one table:
// header row of PTC names, one row per metric (each PTC gets its own column, no Total column).
function buildSummaryTable(breakdown, amountPayable) {
  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  breakdown.forEach(({ ptc }) => {
    const th = document.createElement('th');
    th.textContent = PTC_LABELS[ptc] || ptc;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const valueColSpan = breakdown.length;
  SUMMARY_ROW_DEFS.forEach(rowDef => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.innerHTML = `<b>${rowDef.label}</b>`;
    tr.appendChild(tdLabel);
    breakdown.forEach(({ data }) => {
      const td = document.createElement('td');
      td.textContent = rowDef.get(data);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  if (amountPayable) {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.innerHTML = '<b>Amount Payable</b>';
    const tdVal = document.createElement('td');
    tdVal.colSpan = valueColSpan;
    tdVal.textContent = `${amountPayable.currency}${formatAmount(amountPayable.subTotal, amountPayable.currency)}`;
    tr.appendChild(tdLabel);
    tr.appendChild(tdVal);
    tbody.appendChild(tr);
  }

  // Fare Calculation String is shown as one full-width row per PTC (rather than a column-per-PTC
  // metric row) since the strings are long free text and don't read well squeezed into a narrow column.
  breakdown.forEach(({ ptc, data }) => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.innerHTML = `<b>Fare Calculation String ${PTC_LABELS[ptc] || ptc}</b>`;
    const tdVal = document.createElement('td');
    tdVal.colSpan = valueColSpan;
    tdVal.textContent = data.convertedFareCalcString || '-';
    tr.appendChild(tdLabel);
    tr.appendChild(tdVal);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

// `breakdown`: [{ ptc, data }] for every PTC with data. `data`: the merged/consolidated
// summaryData (same object as a single PTC's data when only one PTC is active).
function renderSummary(data, breakdown) {
  // Show summary content
  els.summaryContent.style.display = 'block';

  // Generate and display GDS string
  const gdsString = generateGdsString(data, breakdown);
  els.gdsString.value = gdsString;

  els.summary.innerHTML = '';
  els.summary.appendChild(buildSummaryTable(breakdown, breakdown.length > 1 ? data : null));
}

function removeK3FFromAddTaxes() {
  if (els.addTaxes.value) {
    const entries = els.addTaxes.value.split('/');
    const filtered = entries.filter(e => !e.trim().includes('K3'));
    els.addTaxes.value = filtered.join('/');
  }
}

function clearFare() {
  els.oldFare.value = '';
  els.newFare.value = '';
  els.fareDiff.value = '';
  els.k3Tax.value = '';
  els.changeFee.value = '';
  els.applyK3OnFareDiff.checked = false;
  els.applyK3OnChangeFee.checked = false;
  clearINRMessage();
  els.taxAdj.value = '';
  els.perPax.value = '';
  els.subTotal.value = '';
  els.pax.value = '1';
  // Clear Final Summary table
  els.summary.innerHTML = '';
  els.gdsString.value = '';
  els.summaryContent.style.display = 'none';
  // Preserve tax values when clearing fare only
  state.updateFareK3(null, 0, '');
  state.clearFareCache();
  state.lastSummaryData = null;
  state.ptcData[state.activePtc].summaryData = null;
  updatePtcTabUI();
}

// Rebuilds the summary table(s) as self-contained HTML with inline styles (borders, padding,
// bold labels) so the table format survives paste into apps that support rich text (Word,
// Outlook/Gmail, Docs, Slack, Notion, etc.) instead of arriving as bare tab-separated text.
// Inline styles are required here — a pasted-in app has no access to this page's styles.css.
function buildSummaryHtmlForClipboard(tables) {
  const border = '3px solid #334155';
  const cellStyle = `border:${border}; padding:8px 12px; text-align:center; font-family:sans-serif; font-size:14px;`;
  const tableStyle = `border:${border}; border-collapse:collapse;`;
  return Array.from(tables).map(table => {
    const rows = Array.from(table.rows).map(row => {
      const cells = Array.from(row.cells).map(cell => {
        const tag = cell.tagName.toLowerCase();
        const isBoldLabel = !!cell.querySelector('b');
        const weight = tag === 'th' || isBoldLabel ? 'font-weight:700;' : '';
        const colspanAttr = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
        return `<${tag} style="${cellStyle}${weight}"${colspanAttr}>${escapeHtml(cell.textContent)}</${tag}>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table style="${tableStyle}">${rows}</table>`;
  }).join('<br>');
}

function copySummaryTable() {
  const tables = els.summary.querySelectorAll('table');
  if (tables.length === 0) {
    showError('No summary to copy.');
    return;
  }
  const text = Array.from(tables).map(table =>
    Array.from(table.rows).map(row =>
      Array.from(row.cells).map(cell => cell.textContent).join('\t')
    ).join('\n')
  ).join('\n\n');

  function fallbackCopyPlainText() {
    navigator.clipboard.writeText(text).then(() => {
      showError('Summary copied to clipboard!', true);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          showError('Summary copied to clipboard!', true);
        } else {
          showError('Unable to copy automatically. Please paste manually.', false);
        }
      } catch (error) {
        document.body.removeChild(textarea);
        showError('Unable to copy automatically. Please paste manually.', false);
      }
    });
  }

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const html = buildSummaryHtmlForClipboard(tables);
    const item = new ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    });
    navigator.clipboard.write([item]).then(() => {
      showError('Summary copied to clipboard!', true);
    }).catch(fallbackCopyPlainText);
  } else {
    fallbackCopyPlainText();
  }
}

// Builds one "FARE DIFF ... + CHG FEE ... +/- TAX ... = ..." line for a single PTC's data
// (per-pax amount — GDS commands are per-transaction, not per-group).
function buildGdsLine(data) {
  const parts = [];
  parts.push(`FARE DIFF ${data.currency}${formatAmount(data.diff, data.currency)}`);
  // Include K3 in the displayed change fee, matching the summary table's Change Fee row
  // (SUMMARY_ROW_DEFS: d.fee + d.k3Fee) — data.perPax already folds k3Fee into the trailing
  // total below, so leaving it out here made the line items silently not add up to that total.
  const feeWithK3 = data.fee + (data.k3Fee || 0);
  parts.push(`+ CHG FEE ${data.currency}${formatAmount(feeWithK3, data.currency)}`);
  const taxPrefix = data.taxAdj > 0 ? '+' : '-';
  parts.push(`${taxPrefix} TAX ${data.currency}${formatAmount(Math.abs(data.taxAdj), data.currency)}`);
  parts.push(`= ${data.currency}${formatAmount(data.perPax, data.currency)}`);
  return parts.join(' ');
}

// `breakdown` (optional): [{ ptc, data }] — when more than one PTC has data, emit one line
// per PTC followed by a final consolidated total line; otherwise unchanged single-line output.
function generateGdsString(data, breakdown = null) {
  if (breakdown && breakdown.length > 1) {
    // els.gdsString is a single-line <input>, so PTC lines are pipe-separated rather than
    // newline-separated (a newline would be silently dropped/garbled in an <input> value).
    const lines = breakdown.map(({ ptc, data: ptcData }) => `${PTC_LABELS[ptc] || ptc} ${buildGdsLine(ptcData)}`);
    lines.push(`TOTAL = ${data.currency}${formatAmount(data.subTotal, data.currency)}`);
    return lines.join('  |  ');
  }
  return buildGdsLine(data);
}

function copyGdsString() {
  const gdsText = els.gdsString.value;
  if (!gdsText) {
    showError('No GDS string to copy.');
    return;
  }

  navigator.clipboard.writeText(gdsText).then(() => {
    showError('GDS string copied to clipboard!', true);
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = gdsText;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        showError('GDS string copied to clipboard!', true);
      } else {
        showError('Unable to copy automatically. Please paste manually.', false);
      }
    } catch (error) {
      document.body.removeChild(textarea);
      showError('Unable to copy automatically. Please paste manually.', false);
    }
  });
}
