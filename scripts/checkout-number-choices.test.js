const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/bestallning.js'), 'utf8');
const start = source.indexOf('  const buildParticipantSnapshots =');
const end = source.indexOf('  const buildPublicOrderPayload =', start);
const buildParticipants = vm.runInNewContext(`${source.slice(start, end)}; buildParticipantSnapshots`, {
  order: { startDate: '2026-10-01' },
  cart: [{}],
  getParticipantValue: () => null,
});
const family = [{ cartItemId: 'family', persons: 2, phoneLines: 2 }];

test('mixed family order keeps transferred numbers on their selected lines', () => {
  const participants = buildParticipants(family, ['0701234567'], [
    { type: 'new_number', phoneNumber: null, demoNumberPreference: '0700000003' },
    { type: 'number_transfer', phoneNumber: '0701234567' },
  ]);
  assert.equal(participants[0].phoneNumber, null);
  assert.equal(participants[0].numberHandling, 'new_number');
  assert.equal(participants[0].demoNumberPreference, '0700000003');
  assert.equal(participants[1].phoneNumber, '0701234567');
  assert.equal(participants[1].numberHandling, 'number_transfer');
});

test('all-new and legacy transfer orders retain their number handling', () => {
  const newNumbers = buildParticipants(family, [], [
    { type: 'new_number', demoNumberPreference: '0700000001' },
    { type: 'new_number', demoNumberPreference: '0700000006' },
  ]);
  assert.ok(newNumbers.every((person) => person.phoneNumber === null && person.numberHandling === 'new_number'));
  const legacy = buildParticipants(family, ['0701234567', '0702345678']);
  assert.equal(legacy[0].phoneNumber, '0701234567');
  assert.equal(legacy[1].phoneNumber, '0702345678');
  assert.ok(legacy.every((person) => person.numberHandling === 'number_transfer'));
});
