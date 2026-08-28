#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const checkout = read('assets/bestallning.js');
const chat = read('script.js');
const cart = read('assets/varukorg.js');
const network = read('assets/network-utils.js');
const mobileOffers = read('assets/offers.js');
const familyOffers = read('assets/family-offers.js');
const demoAgreement = read('demo-avtalssammanfattning.html');
const publicSources = fs.readdirSync(path.join(root, 'assets'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => read(path.join('assets', file)))
  .concat(chat)
  .join('\n');

const runNetworkContract = (hostname, override) => {
  const window = { location: { hostname } };
  if (override !== undefined) window.DEALETT_API_BASE = override;
  vm.runInNewContext(network, { window, console });
  return window.DealettNetwork;
};

assert(
  checkout.includes("fetchJson('/api/public/v1/orders'") &&
    checkout.includes("'Idempotency-Key': idempotencyKey"),
  'Checkout does not use the public order endpoint with an idempotency header.'
);

[
  'customer',
  'cartItems',
  'subscriptions',
  'participants',
  'portedNumbers',
  'questionnaire',
  'recommendation',
  'consentEvidence',
  'attribution',
  'source',
  'conversationId',
  'conversationToken',
  'conversationSnapshot',
  'agreement',
  'bankId',
  'selectedOfferId',
  'qualification',
  'calculation',
  'phoneNumbers',
].forEach((field) => {
  assert(new RegExp(`\\b${field}\\b`).test(checkout), `Public order capture is missing ${field}.`);
});

assert(
  checkout.includes('pendingOrderSubmission') &&
    checkout.includes('persistPendingOrderSubmission') &&
    checkout.includes('normalizeAcceptedOrder'),
  'Signed order retry or durable-acceptance handling is missing.'
);

assert(
  checkout.includes('const cartSelectionSupported = distinctCartOffers.size <= 1') &&
    checkout.includes('if (!cartSelectionSupported)') &&
    checkout.includes('cartSelectionSupported && !submissionInProgress'),
  'Checkout does not fail closed when distinct offers would share one agreement snapshot.'
);

assert(
  checkout.includes("fetchJson('/api/public/v1/environment'") &&
    checkout.includes('environment?.demoMode === true') &&
    checkout.includes("version: 'fictional-demo-v1'") &&
    checkout.includes('demoOnly: usingDemoOperatorDocuments') &&
    demoAgreement.includes('FIKTIV DEMO – INTE ETT AVTAL'),
  'Demo document fallback is not server-gated and explicitly fictional.'
);

assert(
  mobileOffers.includes('offerId: selectedOffer.planId || selectedOffer.offerId || selectedOffer.title') &&
    familyOffers.includes('planId: basePlan.id') &&
    familyOffers.includes('offerId: selectedOffer.planId || selectedOffer.title'),
  'Catalog cart fallbacks do not retain authoritative plan identifiers.'
);

assert(
  chat.includes("const conversationKey = 'dealettChatConversationV3'") &&
    chat.includes('window.crypto?.randomUUID') &&
    chat.includes('createStableChatId()'),
  'Stable V3 conversation and message identifiers are missing.'
);

assert(
  chat.includes('const maxRecoveryMessages = 250') &&
    chat.includes(').slice(-10).map((item) => ({'),
  'Recovery transcript bounds or ten-message model context are missing.'
);

assert(
  chat.includes('clientMessage: clientRecord ? {') &&
    chat.includes('conversationToken,') &&
    chat.includes('response?.messageMetadata?.id') &&
    chat.includes('structuredContent: buildAssistantStructuredContent(response)'),
  'Chat persistence metadata or secure conversation association is incomplete.'
);

assert(
  chat.includes('messages.length || conversationToken') &&
    chat.includes('{ conversationId: null, conversationToken: null }') &&
    checkout.includes('if (!messages.length) return null') &&
    checkout.includes('conversationSnapshot: conversationSnapshot ? {') &&
    !checkout.includes('conversationSnapshot?.conversationId || currentCheckout.conversationId'),
  'No-chat checkout can still expose an unowned conversation or empty archive snapshot.'
);

assert(
  checkout.includes('answersBySubscription: Object.fromEntries') &&
    checkout.includes('outputs: cloneJson(primaryCalculation.outputs || primaryCalculation, {})') &&
    checkout.includes("channel: typeof item.source === 'string' ? item.source"),
  'Submitted questionnaire, calculation, or per-line source evidence is not shaped for the operations-service allowlist.'
);

assert(
  chat.includes("response?.source === 'demo-simulated' && response?.simulated === true") &&
    chat.includes("response?.source === 'openai' && response?.simulated !== true") &&
    chat.includes('dealett-chat-simulation-label'),
  'Explicit demo responses are not truthfully labelled or source-gated.'
);

assert(
  cart.includes("sessionStorage.getItem('dealettChatConversationV3')") &&
    cart.includes('conversationId: readConversationId() || existing.conversationId'),
  'Cart-to-checkout conversation linking is missing.'
);

const hardcodedApiHosts = publicSources.match(/https:\/\/db-qtmd\.onrender\.com/g) || [];
assert(
  hardcodedApiHosts.length === 1 && network.includes("const PRODUCTION_API_BASE = 'https://db-qtmd.onrender.com'"),
  'The API base is not centralized in network-utils.js.'
);

const localhostNetwork = runNetworkContract('localhost');
const loopbackNetwork = runNetworkContract('127.0.0.1');
const productionNetwork = runNetworkContract('www.dealett.se');
const overriddenNetwork = runNetworkContract('localhost', 'http://127.0.0.1:41793/');
assert(
  localhostNetwork.apiBase === '' && localhostNetwork.resolveResource('/api/public/v1/environment') === '/api/public/v1/environment' &&
    loopbackNetwork.apiBase === '' &&
    productionNetwork.resolveResource('/api/public/v1/orders') === 'https://db-qtmd.onrender.com/api/public/v1/orders' &&
    overriddenNetwork.resolveResource('/api/chat') === 'http://127.0.0.1:41793/api/chat',
  'Local same-origin, production-default, or explicit API-base routing is incorrect.'
);

console.log('Public flow contract checks passed.');
