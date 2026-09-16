#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const homepage = read('index.html');
const snabbval = read('assets/information-rotator.js');
const recommendedPlanIds = [
  'tre-25gb',
  'tre-6gb',
  'tele2-unlimited',
  'tele2-unlimited-plus',
  'telia-unlimited-plus-streaming-bundle',
  'tre-unlimited',
];

recommendedPlanIds.forEach((planId) => {
  assert(snabbval.includes(`planId: '${planId}'`), `Snabbval does not map a question to ${planId}.`);
});

[
  'data-information-dialog-answer',
  'data-information-plan-title',
  'data-information-plan-price',
  'data-information-add-to-cart',
].forEach((hook) => {
  assert(homepage.includes(hook), `Homepage is missing the Snabbval hook ${hook}.`);
});

assert(!homepage.includes('Svar på väg'), 'The placeholder Snabbval answer is still present.');
assert(
  !snabbval.includes('fallbackPlan') &&
    !snabbval.includes('buildFallbackCartPayload') &&
    snabbval.includes('item.runtimeSellable !== false'),
  'Snabbval can bypass the live catalog with a stale or unavailable plan.'
);
assert(
  snabbval.includes("fetchJson('/api/mobile/plans'") &&
    snabbval.includes("fetchJson('/api/mobile/cart-item'") &&
    snabbval.includes('window.DealettCart.appendItem') &&
    snabbval.includes('window.DealettCart.openDrawer'),
  'Snabbval is not wired from the live catalog to the shared cart drawer.'
);

console.log('Snabbval contract checks passed.');
