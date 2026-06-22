'use strict';

const crypto = require('node:crypto');

/** URL-friendly slug from an arbitrary title. */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/** Human-friendly, hard-to-guess order number e.g. "RW-7F3K9Q2". */
function generateOrderNumber() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 7; i++) {
    s += alphabet[crypto.randomInt(alphabet.length)];
  }
  return `RW-${s}`;
}

/**
 * Luhn check used by the demo checkout to sanity-check a card number format.
 * (No real charge is made by the demo gateway.)
 */
function luhnValid(number) {
  const digits = String(number).replace(/\D/g, '');
  if (digits.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Basic email shape validation. */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

module.exports = { slugify, generateOrderNumber, luhnValid, isValidEmail };
