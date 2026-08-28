# Dealett frontend

Static frontend for Dealett.

## Checks

Run all local checks:

```bash
npm run check
```

This checks JavaScript syntax, JSON syntax, and trailing whitespace.

Run the focused public-flow contract checks with:

```bash
npm run test:public-flow
```

Run the browser checkout suite against a local static server with:

```bash
CHECKOUT_BASE_URL=http://127.0.0.1:41785 npm run test:checkout
```

Run the browser translation audit against the same server with:

```bash
TRANSLATION_BASE_URL=http://127.0.0.1:41785 npm run test:translations
```

The browser checks use GPU-disabled Chromium. The newsletter background and coverage map now fail soft to their static fallbacks when WebGL is unavailable, and the translation audit installs its own isolated checkout cart fixture before visiting `bestallning.html`.

## Public order capture

Public checkout submissions POST to `/api/public/v1/orders` through the shared network layer. `localhost`, `127.0.0.1`, and IPv6 loopback use the page origin automatically so the backend can serve the frontend and API together; other hosts use the Render production base. Set `window.DEALETT_API_BASE` before `assets/network-utils.js` loads to override either choice, including an empty string for same-origin. The client sends the same client order identifier in `clientOrderId`, the payload `idempotencyKey`, and the `Idempotency-Key` header. The capture includes contact details, every cart item and subscription, participants and ported numbers, questionnaire/recommendation/calculation snapshots, consent and document evidence, attribution/source data, BankID evidence, and the compatibility `agreement` object.

After BankID completes, the exact payload and idempotency key remain in `dealettCheckout.pendingOrderSubmission` until the order API returns a durable order ID or reference. A retry reuses that signed payload without starting BankID again. The success view is not shown before durable acceptance, and simulated submissions remain visibly identified as test data.

### Operator documents and demo mode

Live checkout deliberately remains blocked unless the selected cart item contains an approved `operatorDocuments` snapshot with `agreementSummaryUrl`, `generalTermsUrl`, `specialTermsUrl`, `priceListUrl`, `withdrawalInformationUrl`, `documentId`, and `version`. The current mobile, family, broadband, homepage, and chat cart generators do not receive that complete snapshot from the catalog APIs, so an ordinary live catalog item cannot yet complete checkout. The existing Telenor PDF under `documents/` is a test fixture and must not be used as a live or generic agreement.

Production catalog configuration must attach the approved snapshot to `cartItem.operatorDocuments` in `/api/mobile/cart-item`, `/api/broadband/cart-item`, and `/api/offers/cart-item`; the family-plan path must preserve the same data from its plan source. A family or multi-participant purchase under one offer remains supported. A cart containing more than one distinct offer or operator is explicitly blocked before BankID because the current UI and backend record one primary operator agreement only; enabling that case requires authoritative per-line quoting and consent snapshots on both sides.

When `/api/public/v1/environment` explicitly returns `demoMode: true`, checkout replaces operator documents with `demo-avtalssammanfattning.html` and the `fictional-demo-*` ID/version. The page, consent copy, payment notice, BankID copy, payload, and result all identify the flow as fictional and non-binding. A missing, failed, or `demoMode: false` environment response never enables this fallback.

### Current public API compatibility

The capture includes flat compatibility aliases used by the current operations service: `orderId`, `selectedOfferId`, `qualification`, `calculation`, `phoneNumbers`, direct customer contact fields, participant `numberHandling`, and string source paths. Per-line source, price/binding, questionnaire, recommendation, and calculation evidence are also shaped for the service allowlist. The service creates one authoritative plan and can aggregate multiple participants of that same plan; it rejects multiple distinct offer IDs. Live mode additionally requires both a backend-verified identity result and backend-verified registered consent documents, so the production router/BankID and document-registry adapters must add both trusted context objects before live ordering can succeed.

## Chat recovery and order linking

Chat recovery is stored for the browser session in `dealettChatConversationV3`. New conversation and message IDs are UUIDs; every record has a sequence and timestamp, and assistant records retain structured content and response metadata. Recovery keeps at most 250 messages while `/api/chat` receives only the latest 10 prior messages.

The backend-issued opaque `conversationToken` is stored with the V3 conversation and sent on later chat requests. It is excluded from the general recovery snapshot and is exposed only through the order-association API, then submitted with `conversationId` in the final order capture. Checkout omits the conversation ID and snapshot entirely when there are no archived messages and no server token, avoiding an unowned empty client ID. Explicit `demo-simulated` responses are accepted only with `simulated: true` and are visibly labelled; unlabelled or scripted responses are rejected.
