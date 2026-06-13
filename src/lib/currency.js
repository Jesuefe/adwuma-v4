// ─── Currency symbols map ─────────────────────────────────────────────────────
export const CURRENCY_SYMBOLS = {
  NGN: '₦',
  GHS: 'GH₵',
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'CA$',
  AED: 'AED ',
  AUD: 'A$',
  PLN: 'zł',
};

// Paystack only supports NGN and GHS natively
export const PAYSTACK_CURRENCIES = ['NGN', 'GHS'];

/**
 * Format a monetary amount with currency symbol
 * @param {number} amount
 * @param {string} currency - ISO 4217 code e.g. 'NGN'
 * @param {object} options
 */
export function formatMoney(amount, currency = 'NGN', options = {}) {
  const { compact = false, showCode = false } = options;
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  const num = Number(amount);

  if (isNaN(num)) return `${symbol}0`;

  if (compact && num >= 1_000_000) {
    return `${symbol}${(num / 1_000_000).toFixed(1)}M`;
  }
  if (compact && num >= 1_000) {
    return `${symbol}${(num / 1_000).toFixed(1)}K`;
  }

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return showCode
    ? `${symbol}${formatted} ${currency}`
    : `${symbol}${formatted}`;
}

/**
 * Convert amount to Paystack kobo/pesewas (smallest unit)
 * Paystack expects integers in smallest currency unit
 */
export function toPaystackAmount(amount, currency = 'NGN') {
  return Math.round(Number(amount) * 100);
}

/**
 * Get display name for currency
 */
export function getCurrencyName(code) {
  const names = {
    NGN: 'Nigerian Naira',
    GHS: 'Ghanaian Cedi',
    USD: 'US Dollar',
    GBP: 'British Pound',
    EUR: 'Euro',
    CAD: 'Canadian Dollar',
    AED: 'UAE Dirham',
    AUD: 'Australian Dollar',
    PLN: 'Polish Zloty',
  };
  return names[code] || code;
}

/**
 * Check if a currency is supported by Paystack
 */
export function isPaystackCurrency(currency) {
  return PAYSTACK_CURRENCIES.includes(currency);
}

/**
 * Calculate platform fee split
 */
export function calculateEscrowSplit(amount, platformFeePct = 10) {
  const platformFee = (amount * platformFeePct) / 100;
  const agentPayout = amount - platformFee;
  return { platformFee, agentPayout, total: amount };
}

/**
 * Calculate posting fee for a job
 */
export function calculatePostingFee(serviceFee, postingFeePct = 1) {
  return (serviceFee * postingFeePct) / 100;
}
