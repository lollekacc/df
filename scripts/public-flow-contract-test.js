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
const quiz = read('assets/indexbehovsanalys.js');
const mobileOffers = read('assets/offers.js');
const familyOffers = read('assets/family-offers.js');
const informationRotator = read('assets/information-rotator.js');
const businessPage = read('foretag.html');
const demoAgreement = read('demo-avtalssammanfattning.html');
const publicSources = fs.readdirSync(path.join(root, 'assets'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => read(path.join('assets', file)))
  .concat(chat)
  .join('\n');

const runNetworkContract = (hostname, override, port = '3000') => {
  const window = { location: { hostname, port } };
  if (override !== undefined) window.DEALETT_API_BASE = override;
  vm.runInNewContext(network, { window, console });
  return window.DealettNetwork;
};

const quizContext = {
  document: { addEventListener() {} },
};
vm.runInNewContext(quiz, quizContext);
const selectFeaturedOfferCandidates = quizContext.selectFeaturedOfferCandidates;
const getQuizOfferHighlights = quizContext.getQuizOfferHighlights;

assert(
  typeof selectFeaturedOfferCandidates === 'function',
  'The quiz featured-offer selector is not available for contract testing.'
);

assert(
  typeof getQuizOfferHighlights === 'function' &&
    getQuizOfferHighlights(['Roaming inom EU/EES'])[0] === '24 mån bindningstid',
  'Quiz offer cards do not show the exact 24-month binding period as their first information line.'
);

assert(
  getQuizOfferHighlights(['Samtal, sms och roaming inom EU/EES', '3Världen ingår'])[1] === '3Världen ingår',
  'Quiz offer cards do not prioritize the branded 3Världen benefit.'
);

const chatOfferRendererStart = chat.indexOf('const renderChatOfferCards =');
const chatBindingLine = chat.indexOf('card.bindingLabel ?', chatOfferRendererStart);
const chatDataLine = chat.indexOf('card.dataLabel ?', chatOfferRendererStart);
const chatPriceLine = chat.indexOf('card.monthlyPriceLabel ?', chatOfferRendererStart);
assert(
  chatOfferRendererStart !== -1 &&
    chatBindingLine > chatOfferRendererStart &&
    chatBindingLine < chatDataLine &&
    chatDataLine < chatPriceLine,
  'Chat offer cards do not show the binding period as their first information line.'
);

const initialBest = {
  planId: 'tele2-unlimited',
  operator: 'Tele2',
  planMonthlyPrice: 399,
  recommendationType: 'best_match',
};
const initialSecondary = {
  planId: 'tre-unlimited',
  operator: 'Tre',
  planMonthlyPrice: 499,
  recommendationType: 'next_best_match',
};
const cheaperFallback = {
  planId: 'fallback-cheaper',
  operator: 'Fallback',
  planMonthlyPrice: 99,
};
const initialFeatured = selectFeaturedOfferCandidates({
  bestMatch: initialBest,
  secondaryOffer: initialSecondary,
  lowestEffectiveCost: { ...initialBest, recommendationType: 'lowest_effective_cost' },
}, [cheaperFallback, initialBest, initialSecondary]);
const initialFeaturedIds = initialFeatured.map((entry) => entry.plan.planId);

assert(
  initialFeaturedIds.length === 2 &&
    new Set(initialFeaturedIds).size === 2 &&
    initialFeaturedIds.join(',') === 'tele2-unlimited,tre-unlimited',
  'Initial quiz results do not keep two unique backend-featured offers in authoritative order.'
);

const refinedBest = {
  planId: 'tre-unlimited',
  operator: 'Tre',
  planMonthlyPrice: 399,
  recommendationType: 'best_match',
};
const refinedSecondary = {
  planId: 'telia-unlimited-plus-streaming-bundle',
  operator: 'Telia',
  planMonthlyPrice: 549,
  recommendationType: 'best_streaming_alternative',
};
const refinedFeatured = selectFeaturedOfferCandidates({
  featuredOffers: [refinedBest, refinedSecondary],
  bestMatch: refinedBest,
  secondaryOffer: refinedSecondary,
  lowestEffectiveCost: { ...refinedBest, recommendationType: 'lowest_effective_cost' },
}, [refinedBest]);
const refinedFeaturedIds = refinedFeatured.map((entry) => entry.plan.planId);

assert(
  refinedFeaturedIds.length === 2 &&
    new Set(refinedFeaturedIds).size === 2 &&
    refinedFeaturedIds.join(',') === 'tre-unlimited,telia-unlimited-plus-streaming-bundle',
  'Refined quiz results do not retain the distinct featured offer omitted from strict options.'
);

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

[
  { source: mobileOffers, expectedMetaLists: 3, label: 'Mobile' },
  { source: familyOffers, expectedMetaLists: 2, label: 'Family' },
].forEach(({ source, expectedMetaLists, label }) => {
  const metaLists = source.match(/const meta = createElement\('ul', 'offer-card-meta(?: operator-plan-meta)?'\);/g) || [];
  const bindingFirstLists = source.match(/const meta = createElement\('ul', 'offer-card-meta(?: operator-plan-meta)?'\);\s*\[\s*'24 mån bindningstid'/g) || [];

  assert(
    metaLists.length === expectedMetaLists && bindingFirstLists.length === metaLists.length,
    `${label} offer cards do not show 24 mån bindningstid as the first information line.`
  );
});

assert(
  mobileOffers.includes("const serviceName = String(plan.roaming?.serviceName || '').trim()") &&
    familyOffers.includes("const serviceName = String(plan.roaming?.serviceName || '').trim()") &&
    mobileOffers.includes("'Utomlandstjänst', value: getRoamingServiceLabel(plan)") &&
    familyOffers.includes("'Utomlandstjänst', value: getRoamingServiceLabel(plan)"),
  'Mobile or family cards do not expose the catalog-provided 3Världen service name.'
);

assert(
  informationRotator.includes("serviceName ? `${serviceName}: ` : ''") &&
    informationRotator.includes('Tre Obegränsad inkluderar 3Världen'),
  'Homepage quick recommendations do not name 3Världen.'
);

assert(
  (businessPage.match(/3Världen Företag/g) || []).length === 2 &&
    businessPage.indexOf('3Världen Företag') > businessPage.indexOf('<h3>3Företag Obegränsad Max</h3>'),
  'The eligible 3Företag Obegränsad Max card does not name 3Världen Företag.'
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
for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
  const previewNetwork = runNetworkContract(hostname, undefined, '5500');
  assert(
    previewNetwork.resolveResource('/api/mobile/plans') === `http://${hostname}:3000/api/mobile/plans`,
    'Live Server must request offers from the local backend.'
  );
}
assert(runNetworkContract('localhost', '', '5500').apiBase === '', 'Explicit same-origin overrides must be preserved.');
assert(
  localhostNetwork.apiBase === '' && localhostNetwork.resolveResource('/api/public/v1/environment') === '/api/public/v1/environment' &&
    loopbackNetwork.apiBase === '' &&
    productionNetwork.resolveResource('/api/public/v1/orders') === 'https://db-qtmd.onrender.com/api/public/v1/orders' &&
    overriddenNetwork.resolveResource('/api/chat') === 'http://127.0.0.1:41793/api/chat',
  'Local same-origin, production-default, or explicit API-base routing is incorrect.'
);

console.log('Public flow contract checks passed.');
