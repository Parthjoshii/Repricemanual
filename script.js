const byId = (id) => document.getElementById(id);

// Rounding rules by currency
const roundingRules = {
  'INR': { type: 'ceiling', decimals: 0 },      // Round up, no decimals
  'JPY': { type: 'nearest', decimals: 0 },      // Round to nearest, no decimals
  'KRW': { type: 'nearest', decimals: 0 },      // Korean Won - no decimals
  'TWD': { type: 'nearest', decimals: 0 },      // Taiwan Dollar - no decimals
  'XAF': { type: 'nearest', decimals: 0 },      // Central African Franc - no decimals
  'XOF': { type: 'nearest', decimals: 0 },      // West African Franc - no decimals
  'CLP': { type: 'nearest', decimals: 0 },      // Chilean Peso - no decimals
  'ISK': { type: 'nearest', decimals: 0 },      // Icelandic Króna - no decimals
  'VND': { type: 'nearest', decimals: 0 },      // Vietnamese Dong - no decimals
  'IDR': { type: 'standard', decimals: 0 },     // Indonesian Rupiah - no decimals
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
};

const state = {
  lastTaxResult: null,
  lastFareK3Total: 0,
  lastFareCurrency: null,
  lastK3AddTaxes: '',
  lastSummaryData: null,
  taxCalculationCache: new Map(),
  fareCalculationCache: new Map(),
  isCalculatingTax: false,
  isCalculatingFare: false,
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

// Parser functions
function parseFareCalcString() {
  const input = els.fareCalcString.value.trim();

  if (!input) {
    showError('Please enter a fare calculation string.');
    els.parserResults.style.display = 'none';
    return;
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

  // Display fare components
  els.fareComponents.innerHTML = parsed.fareComponents
    .map(comp => `<li>${comp.amount.toFixed(2)}</li>`)
    .join('');

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
  } else {
    // Generate corrected fare string
    const correctedString = input.replace(/NUC\d+(?:\.\d+)?/, `NUC${calculatedNuc.toFixed(2)}`);
    els.nucValidation.innerHTML = `<span class="error">✗ NUC Validation: FAIL<br><br>Corrected Fare String:<br><span style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: var(--text-primary);">${correctedString}</span></span>`;
  }

  // Display ROE
  els.roe.textContent = parsed.roe.toFixed(7);

  // Calculate and display base fare
  const baseFare = calculatedNuc * parsed.roe;
  els.baseFare.textContent = baseFare.toFixed(2);

  // Show results
  els.parserResults.style.display = 'block';
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
  };

  // Extract fare amounts (numbers before fare basis codes)
  // Pattern: number (with or without decimal) followed by 8-character fare basis (alphanumeric), optional CH|IN suffix, and /4-character designator (alphanumeric)
  const farePattern = /(\d+(?:\.\d+)?)([A-Z0-9]{8})(CH|IN)?(?:\/[A-Z0-9]{1,4})?/g;
  let fareMatch;
  while ((fareMatch = farePattern.exec(input)) !== null && result.fareComponents.length < 6) {
    result.fareComponents.push({
      amount: parseFloat(fareMatch[1]),
      fareBasis: fareMatch[2],
      paxType: getPaxType(fareMatch[3] || '')
    });
  }

  // Extract Q surcharges
  // Pattern 1: Q followed by optional space, then optional airport codes (3 or 6 letters), then a number
  // Examples: Q5.00, QDXB5.00, Q DXBDXB4.00, Q DXBBOM4.00
  // Pattern 2: Number followed by Q, then optional airport codes (3 or 6 letters)
  // Examples: 58.47QDUB, 58.47Q DUB, 470.74QHAM
  // Pattern 3: Q before airport code, number, then Q after (Q-number-Q pattern)
  // Examples: Q DUBCOK58.47Q, QCOKDUB58.47Q
  // Pattern 4: Airport code (6 letters) followed by number (no Q)
  // Examples: DUBCOK18.82, COKDUB23.41
  // Q surcharge pattern — negative lookbehind ensures Q is NOT part of a fare basis code
  // (e.g. 256.70QWEEPIN1 — the Q here is preceded by "1" so lookbehind rejects it)
  // Handles: Q5.00 / QBOM5.00 / Q BOM5.00 / Q BOMCCU5.00 / Q5 (integer) / 58.47QDUB / 470.74QHAM / Q DUBCOK58.47Q / DUBCOK18.82
  // Also handles Q without left space: DUBCOK58.47Q, COKDUB23.41Q
  const qPattern = /(?<![A-Z0-9])Q\s*(?:[A-Z]{3}){0,2}(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)Q(?:\s*[A-Z]{3}){0,2}(?![A-Z0-9])|(?<![A-Z0-9])Q\s*[A-Z]{6}(\d+(?:\.\d+)?)Q|(?<![A-Z0-9])[A-Z]{6}(\d+(?:\.\d+)?)(?![A-Z0-9])|([A-Z]{6})(\d+(?:\.\d+)?)Q(?![A-Z0-9])/g;
  let qMatch;
  while ((qMatch = qPattern.exec(input)) !== null) {
    // Match group 1 is for Q-first pattern, group 2 for number-first pattern
    // Match group 3 is for Q-number-Q pattern, group 4 for airport-number pattern
    // Match group 5-6 is for airport-number-Q pattern (no left space)
    const amount = qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4] || qMatch[6];
    if (amount) {
      result.qSurcharges.push(parseFloat(amount));
    }
  }

  // Extract NUC
  const nucMatch = input.match(/NUC(\d+(?:\.\d+)?)/);
  if (nucMatch) {
    result.nuc = parseFloat(nucMatch[1]);
  }

  // Extract ROE
  const roeMatch = input.match(/ROE(\d+(?:\.\d+)?)/);
  if (roeMatch) {
    result.roe = parseFloat(roeMatch[1]);
  }

  return result;
}

function clearParser() {
  els.fareCalcString.value = '';
  els.parserResults.style.display = 'none';
}

function toggleParserSection() {
  els.parserCollapsible.classList.toggle('collapsed');
  els.parserToggleBtn.classList.toggle('collapsed');
  const isCollapsed = els.parserCollapsible.classList.contains('collapsed');
  els.parserToggleBtn.textContent = isCollapsed ? 'Show' : 'Hide';
  els.parserToggleBtn.setAttribute('aria-expanded', !isCollapsed);
}

function handleSummarise() {
  if (!state.lastSummaryData && !state.lastTaxResult) {
    showError('No calculation data available. Please calculate fare or taxes first.');
    return;
  }

  // Combine tax and fare data if both are available
  let summaryData = state.lastSummaryData;
  if (state.lastTaxResult) {
    // If only tax data is available, create a minimal summary structure
    if (!summaryData) {
      summaryData = {
        currency: state.lastTaxResult.currency,
        oldFare: 0,
        newFare: 0,
        diff: 0,
        k3Fare: 0,
        k3Fee: 0,
        k3OnYQ: state.lastTaxResult.k3OnYQ || 0,
        fee: 0,
        addTaxes: state.lastTaxResult.positiveTaxes.join('/') || '',
        refundTaxes: state.lastTaxResult.negativeTaxes.join('/') || '',
        taxAdj: state.lastTaxResult.netTax + (state.lastTaxResult.k3OnYQ || 0),
        perPax: state.lastTaxResult.netTax + (state.lastTaxResult.k3OnYQ || 0),
        subTotal: state.lastTaxResult.netTax + (state.lastTaxResult.k3OnYQ || 0),
        pax: 1,
      };
    } else {
      // Fare data exists, tax data is already incorporated in the fare calculation
      // The summaryData already includes taxAdj which has the tax calculation
    }
  }

  renderSummary(summaryData);
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

// Initialize theme on load
loadTheme();

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
  const m = trimmed.match(/^([A-Z]{3})?\s*([+-]?\d+(?:\.\d+)?)\s*([A-Z0-9]{1,6})$/i);
  if (!m) return null;
  const amount = parseFloat(m[2]);
  if (!Number.isFinite(amount)) return null;
  return {
    currency: m[1] ? m[1].toUpperCase() : null,
    amount,
    code: m[3].toUpperCase(),
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
  
  // Validate each entry: 3-letter currency + amount + 1-6 character tax code (letters or digits)
  const pattern = /^([A-Z]{3})(\d+(?:\.\d+)?)([A-Z0-9]{1,6})$/i;
  
  entries.forEach(entry => {
    const match = entry.match(pattern);
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

function parseTaxes(text, defaultCurrency, skipPaid = false) {
  const taxes = {};
  if (!text) return taxes;
  const tokens = text.split(/[\/\n,]+/);
  tokens.forEach(token => {
    // Skip entries with PD prefix (paid taxes) if skipPaid is true
    if (skipPaid && token.trim().toUpperCase().startsWith('PD')) {
      return;
    }
    const parsed = parseTaxToken(token);
    if (parsed) {
      const code = parsed.code;
      const cur = parsed.currency || defaultCurrency;
      const key = `${cur}${code}`;
      taxes[key] = (taxes[key] || 0) + parsed.amount;
    }
  });
  return taxes;
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

  const oldTaxes = parseTaxes(oldText, 'INR', true); // Skip PD (paid) entries in OLD TAX
  const newTaxes = parseTaxes(newText, 'INR', false); // Include all entries in NEW TAX

  const allCurrencies = new Set();
  Object.keys(oldTaxes).forEach(k => {
    const m = k.match(/^([A-Z]{3})/);
    if (m) allCurrencies.add(m[1]);
  });
  Object.keys(newTaxes).forEach(k => {
    const m = k.match(/^([A-Z]{3})/);
    if (m) allCurrencies.add(m[1]);
  });

  let firstCurrency = null;
  const result = {
    positiveTaxes: [],
    negativeTaxes: [],
    posTotal: 0,
    negTotal: 0,
    currency: null,
  };

  allCurrencies.forEach(cur => {
    if (!firstCurrency) firstCurrency = cur;
    Object.keys(oldTaxes).forEach(k => {
      if (k.startsWith(cur)) {
        const code = k.substring(3);
        const oldAmt = oldTaxes[k] || 0;
        const newAmt = newTaxes[k] || 0;
        const diff = newAmt - oldAmt;
        if (diff > 0) {
          const label = `${cur}${formatAmount(diff, cur)}${code}`;
          result.positiveTaxes.push(label);
          result.posTotal += diff;
        } else if (diff < 0) {
          const label = `-${cur}${formatAmount(Math.abs(diff), cur)}${code}`;
          result.negativeTaxes.push(label);
          result.negTotal += diff;
        }
      }
    });
    Object.keys(newTaxes).forEach(k => {
      if (k.startsWith(cur) && !(k in oldTaxes)) {
        const code = k.substring(3);
        const newAmt = newTaxes[k];
        if (newAmt > 0) {
          const label = `${cur}${formatAmount(newAmt, cur)}${code}`;
          result.positiveTaxes.push(label);
          result.posTotal += newAmt;
        } else if (newAmt < 0) {
          const label = `-${cur}${formatAmount(Math.abs(newAmt), cur)}${code}`;
          result.negativeTaxes.push(label);
          result.negTotal += newAmt;
        }
      }
    });
  });

  result.currency = firstCurrency ?? 'INR';
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
  const k3FromFare = (result.currency === state.lastFareCurrency &&
                       (els.applyK3OnFareDiff.checked || els.applyK3OnChangeFee.checked))
                       ? state.lastFareK3Total : 0;
  const totalK3 = k3FromFare + k3OnYQ;
  const netTaxWithK3 = netTaxOnly + totalK3;

  els.taxAdj.value = result.currency ? `${result.currency}${formatAmount(netTaxWithK3, result.currency)}` : '';

  // If fare data exists, update perPax and subTotal
  if (state.lastSummaryData) {
    const diff = state.lastSummaryData.diff;
    const feeAmount = state.lastSummaryData.fee;
    const k3FeeAmount = state.lastSummaryData.k3Fee;
    const passengerCount = state.lastSummaryData.pax;
    const perPax = diff + feeAmount + k3FeeAmount + netTaxWithK3;
    const subTotal = perPax * passengerCount;

    els.perPax.value = `${result.currency}${formatAmount(perPax, result.currency)}`;
    els.subTotal.value = `${result.currency}${formatAmount(subTotal, result.currency)}`;

    // Update stored summary data with new tax adjustment
    state.lastSummaryData.taxAdj = netTaxWithK3;
    state.lastSummaryData.perPax = perPax;
    state.lastSummaryData.subTotal = subTotal;
  }

  state.isCalculatingTax = false;
}

function buildCurrentSummaryData() {
  const currency = state.lastFareCurrency ?? state.lastTaxResult?.currency ?? els.currency.value ?? 'INR';
  const oldFare = parseAmount(els.oldFare.value);
  const newFare = parseAmount(els.newFare.value);
  const fee = parseAmount(els.changeFee.value);
  const diff = oldFare && newFare ? newFare.amount - oldFare.amount : 0;

  const k3FareAmount = extractK3FareFromAddTaxes();
  // Only include K3 from fare if currencies match
  const k3FeeAmount = (state.lastFareCurrency === state.lastTaxResult?.currency) 
    ? Math.max(0, (state.lastFareK3Total ?? 0) - k3FareAmount) 
    : 0;
  const k3OnYQ = state.lastTaxResult?.k3OnYQ ?? 0;
  const feeAmount = fee ? fee.amount : 0;
  const netTaxOnly = state.lastTaxResult ? state.lastTaxResult.netTax : 0;
  const passengerCount = Math.max(1, parseInt(els.pax.value, 10) ?? 1);
  
  // Only add K3 to tax adjustment if currencies match
  const taxAdj = state.lastTaxResult 
    ? state.lastTaxResult.netTax + (state.lastFareCurrency === state.lastTaxResult.currency ? k3FareAmount + k3OnYQ : 0)
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

  // Calculate total K3 (fare diff K3 + YQ K3)
  const k3FromFare = (result.currency === state.lastFareCurrency && 
                       (els.applyK3OnFareDiff.checked || els.applyK3OnChangeFee.checked)) 
                       ? state.lastFareK3Total : 0;
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

  if (state.lastFareK3Total > 0 && result.currency !== state.lastFareCurrency) {
    showError(`K3 from last fare calculation (${state.lastFareCurrency}${formatAmount(state.lastFareK3Total, state.lastFareCurrency)}) is not added because tax currency is ${result.currency}.`);
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

  const currency = oldFare.currency ?? newFare.currency ?? els.currency.value;
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
  const applyFareDiffK3 = els.applyK3OnFareDiff.checked;
  const applyChangeFeeK3 = els.applyK3OnChangeFee.checked;
  const passengerCount = Math.max(1, parseInt(els.pax.value, 10) ?? 1);
  const diff = newFare.amount - oldFare.amount;
  els.fareDiff.value = `${currency}${formatAmount(diff, currency)}`;

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
    state.isCalculatingFare = false;
    return;
  }

  let k3Fare = 0;
  let k3Fee = 0;
  let k3Label = 'N/A';
  if ((applyFareDiffK3 && diff > 0) || (applyChangeFeeK3 && fee.amount !== 0)) {
    if (!els.cabin.value) {
      const cabinError = '⚠️ K3 requested. Select cabin to calculate K3.';
      showError(cabinError);
      state.isCalculatingFare = false;
      return;
    } else {
      const rate = K3_RATES[els.cabin.value] ?? 0.05;
      if (applyFareDiffK3 && diff > 0) k3Fare = diff * rate;
      if (applyChangeFeeK3 && fee.amount !== 0) k3Fee = fee.amount * rate;
      const k3Total = k3Fare + k3Fee;
      k3Label = `${currency}${formatAmount(k3Total, currency)}`;
    }
  }
  els.k3Tax.value = k3Label;

  // Track K3 fare state to preserve it if tax adjustment is recalculated later
  state.updateFareK3(currency, k3Fare + k3Fee, k3Fare > 0 ? `${currency}${formatAmount(k3Fare, currency)}K3` : '');

  // Append K3 Fare Diff to Add Taxes (remove any existing K3 first to prevent duplication)
  if (k3Fare > 0) {
    // Remove existing K3 entries first to ensure clean state
    removeK3FFromAddTaxes();
    // Append new K3
    const k3FareStr = `${currency}${formatAmount(k3Fare, currency)}K3`;
    els.addTaxes.value = updateAddTaxesWithK3(els.addTaxes.value, k3FareStr);
  } else {
    // Remove K3 entries if K3 is not applied (checkbox deselected)
    removeK3FFromAddTaxes();
  }

  const feeWithK3 = fee.amount + k3Fee;
  const k3Total = k3Fare + k3Fee;
  const netTaxOnly = state.lastTaxResult ? state.lastTaxResult.netTax : 0;
  const k3OnYQ = state.lastTaxResult?.k3OnYQ ?? 0;
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

  state.isCalculatingFare = false;
}

function renderSummary(data) {
  // Show summary content
  els.summaryContent.style.display = 'block';

  // Generate and display GDS string
  const gdsString = generateGdsString(data);
  els.gdsString.value = gdsString;

  const rows = [
    ['Old Fare', `${data.currency}${formatAmount(data.oldFare, data.currency)}`],
    ['New Fare', `${data.currency}${formatAmount(data.newFare, data.currency)}`],
    ['Fare Difference', `${data.currency}${formatAmount(data.diff, data.currency)}`],
  ];

  // Display Change Fee with K3 breakdown if applicable
  if (data.k3Fee > 0) {
    rows.push(['Change Fee (incl. K3)', `${data.currency}${formatAmount(data.fee + data.k3Fee, data.currency)} (incl. K3 ${data.currency}${formatAmount(data.k3Fee, data.currency)})`]);
  } else {
    rows.push(['Change Fee', `${data.currency}${formatAmount(data.fee, data.currency)}`]);
  }

  rows.push(
    ['Add Taxes', data.addTaxes ?? '-'],
    ['Refund Taxes', data.refundTaxes ?? '-'],
    ['Tax Adjustment (Net)', `${data.currency}${formatAmount(data.taxAdj, data.currency)}`],
    ['Amount Payable per Pax', `${data.currency}${formatAmount(data.perPax, data.currency)}`],
    ['No. of Pax', data.pax],
    ['Sub Total', `${data.currency}${formatAmount(data.subTotal, data.currency)}`],
  );

  // Use DocumentFragment for batch DOM updates
  const fragment = document.createDocumentFragment();
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  
  rows.forEach(([key, val]) => {
    const tr = document.createElement('tr');
    const tdKey = document.createElement('td');
    const tdVal = document.createElement('td');
    tdKey.innerHTML = `<b>${key}</b>`;
    tdVal.textContent = val;
    tr.appendChild(tdKey);
    tr.appendChild(tdVal);
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  fragment.appendChild(table);
  els.summary.innerHTML = '';
  els.summary.appendChild(fragment);
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
}

function copySummaryTable() {
  const table = els.summary.querySelector('table');
  if (!table) {
    showError('No summary to copy.');
    return;
  }
  const text = Array.from(table.rows).map(row => {
    return Array.from(row.cells).map(cell => cell.textContent).join('\t');
  }).join('\n');

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

function generateGdsString(data) {
  const parts = [];
  
  // Add fare difference
  parts.push(`FARE DIFF ${data.currency}${formatAmount(data.diff, data.currency)}`);
  
  // Add change fee
  parts.push(`+ CHG FEE ${data.currency}${formatAmount(data.fee, data.currency)}`);
  
  // Add tax adjustment with +/- prefix
  const taxPrefix = data.taxAdj > 0 ? '+' : '-';
  parts.push(`${taxPrefix} TAX ${data.currency}${formatAmount(Math.abs(data.taxAdj), data.currency)}`);
  
  // Add total (per-pax amount — GDS commands are per-transaction, not per-group)
  const total = data.perPax;
  parts.push(`= ${data.currency}${formatAmount(total, data.currency)}`);
  
  return parts.join(' ');
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
