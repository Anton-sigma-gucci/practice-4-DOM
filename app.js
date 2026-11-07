'use strict';

/* ==========================================================================
   Subscription Calculator
   Prices, discounts and add-on costs live in data-* attributes in index.html,
   so this file only reads them and does the maths.
   ========================================================================== */

/* ---------- Constants ---------- */
const MIN_USERS = 1;
const MAX_USERS = 100;
const MOBILE_MAX_WIDTH = 640;
const TABLET_MAX_WIDTH = 1024;

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/* ---------- DOM references (querySelector / querySelectorAll) ---------- */
const form = document.querySelector('#subscription-form');
const usersField = document.querySelector('#users-field');
const usersInput = document.querySelector('#users');
const usersError = document.querySelector('#users-error');
const stepButtons = document.querySelectorAll('[data-step]');
const optionCards = document.querySelectorAll('.option');
const planInputs = document.querySelectorAll('input[name="plan"]');
const periodInputs = document.querySelectorAll('input[name="period"]');
const addonInputs = document.querySelectorAll('input[name="addon"]');
const confirmButton = document.querySelector('#confirm-btn');
const confirmation = document.querySelector('#confirmation');
const viewportInfo = document.querySelector('#viewport-info');

const output = {
  plan: document.querySelector('#out-plan'),
  users: document.querySelector('#out-users'),
  period: document.querySelector('#out-period'),
  addons: document.querySelector('#out-addons'),
  subtotal: document.querySelector('#out-subtotal'),
  discount: document.querySelector('#out-discount'),
  total: document.querySelector('#out-total'),
  note: document.querySelector('#out-note')
};

/* ---------- Helpers ---------- */
const formatCents = (cents) => currency.format(cents / 100);

const pluralize = (count, singular, plural) => (count === 1 ? singular : plural);

/* Reads the current choice of plan, period and add-ons from the form. */
function getSelection() {
  const plan = document.querySelector('input[name="plan"]:checked');
  const period = document.querySelector('input[name="period"]:checked');
  const addons = Array.from(document.querySelectorAll('input[name="addon"]:checked'));

  return {
    planName: plan.value,
    planPrice: Number(plan.dataset.price),
    months: Number(period.dataset.months),
    discountPercent: Number(period.dataset.discount),
    periodLabel: period.dataset.label,
    addonNames: addons.map((addon) => addon.value),
    addonsPrice: addons.reduce((sum, addon) => sum + Number(addon.dataset.price), 0)
  };
}

/* Checks the "users" field and returns { valid, value } or { valid, message }. */
function validateUsers() {
  const raw = usersInput.value.trim();

  if (usersInput.validity.badInput || raw === '') {
    return { valid: false, message: 'Enter the number of users, from 1 to 100.' };
  }

  const value = Number(raw);

  if (!Number.isInteger(value)) {
    return { valid: false, message: 'Use a whole number of users.' };
  }
  if (value < MIN_USERS) {
    return { valid: false, message: 'At least 1 user is required.' };
  }
  if (value > MAX_USERS) {
    return { valid: false, message: 'You can add up to 100 users.' };
  }

  return { valid: true, value };
}

/*
 * Price = (plan price + add-ons) x users x months x (1 - discount).
 * All money is counted in cents to avoid floating point errors.
 */
function calculate(selection, users) {
  const pricePerUserCents = (selection.planPrice + selection.addonsPrice) * 100;
  const subtotalCents = pricePerUserCents * users * selection.months;
  const discountCents = Math.round((subtotalCents * selection.discountPercent) / 100);

  return {
    pricePerUserCents,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents
  };
}

/* ---------- UI state ---------- */
function syncSelection() {
  optionCards.forEach((card) => {
    const input = card.querySelector('input');
    card.classList.toggle('is-selected', input.checked);
  });
}

function showUsersError(message) {
  usersError.textContent = message;
  usersError.classList.add('is-visible');
  usersField.classList.add('has-error');
  usersInput.setAttribute('aria-invalid', 'true');
}

function clearUsersError() {
  usersError.classList.remove('is-visible');
  usersField.classList.remove('has-error');
  usersInput.removeAttribute('aria-invalid');
}

function hideConfirmation() {
  confirmation.classList.remove('is-visible');
}

function updateStepButtons(users) {
  stepButtons.forEach((button) => {
    const delta = Number(button.dataset.step);
    const atLimit = users.valid &&
      ((delta < 0 && users.value <= MIN_USERS) || (delta > 0 && users.value >= MAX_USERS));
    button.disabled = atLimit;
  });
}

function showPlaceholders() {
  output.users.textContent = '—';
  output.subtotal.textContent = '—';
  output.discount.textContent = '—';
  output.total.textContent = '—';
  output.note.textContent = 'Fix the number of users to see the price.';
}

/* Recalculates everything and refreshes the summary card. */
function render() {
  syncSelection();
  hideConfirmation();

  const selection = getSelection();
  const users = validateUsers();

  output.plan.textContent = selection.planName;
  output.period.textContent = selection.periodLabel;
  output.addons.textContent = selection.addonNames.length ? selection.addonNames.join(', ') : 'None';

  updateStepButtons(users);

  if (!users.valid) {
    showUsersError(users.message);
    showPlaceholders();
    confirmButton.disabled = true;
    return;
  }

  clearUsersError();
  confirmButton.disabled = false;

  const result = calculate(selection, users.value);

  output.users.textContent = `${users.value} ${pluralize(users.value, 'user', 'users')}`;
  output.subtotal.textContent = formatCents(result.subtotalCents);
  output.discount.textContent = result.discountCents > 0
    ? `−${formatCents(result.discountCents)} (${selection.discountPercent}%)`
    : `${formatCents(0)} (0%)`;
  output.total.textContent = formatCents(result.totalCents);
  output.note.textContent =
    `${formatCents(result.pricePerUserCents)} per user / month, billed for ${selection.periodLabel}.`;
}

/* ---------- BOM: window width ---------- */
function updateViewportInfo() {
  const width = window.innerWidth;
  let mode = 'Desktop';

  if (width < MOBILE_MAX_WIDTH) {
    mode = 'Mobile';
  } else if (width < TABLET_MAX_WIDTH) {
    mode = 'Tablet';
  }

  viewportInfo.textContent = `${mode} layout, ${width} px wide`;
}

/* ---------- Event handlers ---------- */
function handleStep(event) {
  const delta = Number(event.currentTarget.dataset.step);
  const users = validateUsers();
  const next = users.valid ? users.value + delta : MIN_USERS;

  usersInput.value = Math.min(MAX_USERS, Math.max(MIN_USERS, next));
  render();
}

/* Clicking anywhere on a plan or period card selects its radio button,
   even in browsers that do not stretch the hidden input over the card. */
function handleCardClick(event) {
  const radio = event.currentTarget.querySelector('input[type="radio"]');

  if (radio && event.target !== radio && !radio.checked) {
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function handleUsersKeydown(event) {
  // Block characters that make no sense for a whole, positive number.
  if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) {
    event.preventDefault();
  }
}

function handleEscape(event) {
  if (event.key === 'Escape') {
    hideConfirmation();
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const users = validateUsers();

  if (!users.valid) {
    showUsersError(users.message);
    usersInput.focus();
    return;
  }

  const selection = getSelection();
  const result = calculate(selection, users.value);
  const addons = selection.addonNames.length ? selection.addonNames.join(', ') : 'no add-ons';

  const message =
    `Subscription confirmed: ${selection.planName} plan, ` +
    `${users.value} ${pluralize(users.value, 'user', 'users')}, ` +
    `${selection.periodLabel}, ${addons}. ` +
    `Total: ${formatCents(result.totalCents)}.`;

  confirmation.textContent = message;
  confirmation.classList.add('is-visible');

  // BOM: native browser dialog
  window.alert(`${message}\n\nThis is a demo. No payment was made.`);
}

/* ---------- Event listeners (addEventListener only) ---------- */
usersInput.addEventListener('input', render);
usersInput.addEventListener('keydown', handleUsersKeydown);

planInputs.forEach((input) => input.addEventListener('change', render));
periodInputs.forEach((input) => input.addEventListener('change', render));
addonInputs.forEach((input) => input.addEventListener('change', render));

stepButtons.forEach((button) => button.addEventListener('click', handleStep));
optionCards.forEach((card) => card.addEventListener('click', handleCardClick));

form.addEventListener('submit', handleSubmit);
document.addEventListener('keydown', handleEscape);
window.addEventListener('resize', updateViewportInfo);

/* ---------- Init ---------- */
render();
updateViewportInfo();