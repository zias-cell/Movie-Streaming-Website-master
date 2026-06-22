'use strict';

// All monetary amounts are stored as integer cents (USD) to avoid floating
// point rounding errors. These helpers convert to/from display strings.

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Format integer cents as a USD string, e.g. 1999 -> "$19.99". */
function formatCents(cents) {
  const n = Number(cents) || 0;
  return USD.format(n / 100);
}

/** Parse a user-entered dollar string ("19.99", "$1,299") into integer cents. */
function dollarsToCents(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (cleaned === '') return 0;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Integer cents -> plain dollars number (for form value attributes). */
function centsToDollars(cents) {
  return ((Number(cents) || 0) / 100).toFixed(2);
}

module.exports = { formatCents, dollarsToCents, centsToDollars };
