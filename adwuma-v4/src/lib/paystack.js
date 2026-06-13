import { toPaystackAmount, isPaystackCurrency } from './currency';

/**
 * Load Paystack inline script dynamically
 */
export function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve(window.PaystackPop);
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = () => reject(new Error('Failed to load Paystack script'));
    document.head.appendChild(script);
  });
}

/**
 * Open the Paystack payment popup
 * @param {object} params
 * @param {string} params.email - Payer email
 * @param {number} params.amount - Amount in major units (e.g. 12000 NGN)
 * @param {string} params.currency - ISO currency code
 * @param {string} params.reference - Unique transaction reference
 * @param {string} params.metadata - JSON metadata
 * @param {Function} params.onSuccess - Called with transaction data on success
 * @param {Function} params.onClose - Called when popup is closed without payment
 */
export async function openPaystackPopup({ email, amount, currency, reference, metadata, onSuccess, onClose }) {
  if (!isPaystackCurrency(currency)) {
    throw new Error(`Currency ${currency} is not supported by Paystack. Supported: NGN, GHS`);
  }

  const publicKey = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
  if (!publicKey || publicKey.startsWith('pk_live_xxx')) {
    throw new Error('Paystack public key not configured. Add REACT_APP_PAYSTACK_PUBLIC_KEY to your .env file.');
  }

  const PaystackPop = await loadPaystackScript();

  const handler = PaystackPop.setup({
    key: publicKey,
    email,
    amount: toPaystackAmount(amount, currency),
    currency,
    ref: reference,
    metadata: metadata || {},
    callback: (response) => {
      if (response.status === 'success') {
        onSuccess(response);
      }
    },
    onClose: () => {
      if (onClose) onClose();
    },
  });

  handler.openIframe();
}

/**
 * Generate a unique Paystack reference
 * Format: ADW-{timestamp}-{random6}
 */
export function generatePaystackRef() {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ADW-${ts}-${rand}`;
}

/**
 * Verify payment server-side via Supabase Edge Function
 * The edge function calls Paystack's verify API with the secret key
 */
export async function verifyPayment(reference) {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.functions.invoke('verify-payment', {
    body: { reference },
  });
  if (error) throw error;
  return data;
}
