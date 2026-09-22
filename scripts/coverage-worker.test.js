const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const code = fs.readFileSync(path.join(__dirname, '../assets/coverage-worker.js'), 'utf8');
const boundary = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/geo/sweden-boundary.geojson'), 'utf8'));
const expected = {
  "telia:4g": "c5eaf2c77e4effa1d3724e7425b6eca5f4148e56727802d90499c3be9d8f37b0",
  "telia:4gPlus": "0a15ed916db5a4900de1ecb16384e7a9e812b7ea7dd9595b85d5432797809bf7",
  "telia:5g": "ebfe203b90a5a0205a4236db08572d77e49d5448fc16000221575cf8542bcdb9",
  "telia:5gPlus": "ead3a310a85ad677e7b731db3dfd9a062376a4fdc1befb08374b84f4da88b2e7",
  "tele2:4g": "9aa69cb62e74616faab608042774398b2f053a50a222efc69c6d4bb8436f5c6e",
  "tele2:4gPlus": "0acd962e50f02de12dd67853333cf34e09966259944dfebd852c967fe93acf0a",
  "tele2:5g": "e6a05c10709e216b1313d9e6a94d76131c600c96a32e1b6c539b6f7d48727ff3",
  "tele2:5gPlus": "d4227e1a848d2de025c5c6e984de43fa08b9ab84662f247599ef575b6d3c37e4",
  "telenor:4g": "c15890a9a6f66284fa37041c0f96ee10f942687fdad2b67f773584fd1f853774",
  "telenor:4gPlus": "5bfb5c977df8909351feb4b032d1d1a64ec0127f5b3a15e9dbacd21b98c67123",
  "telenor:5g": "69a34763a911fc38839ad837349b139a21856850799e09f41067fb54c1ae6525",
  "telenor:5gPlus": "b4b111f1f0995d14ce007daf1ff205356ff0c3f53b33f3512bafca1d1abae1fb",
  "tre:4g": "273abdbdb49dc75063e3fd65dd7079d61694ff6620bab733c7899304f1df7273",
  "tre:4gPlus": "ce1497434ac960804abe7f73c42f2967f93a47ac4a6616781ccff36e4a54b3c6",
  "tre:5g": "f2eb37ef9b5432fff11de2a1f19ea400fb980422846b3d4a2262ecd4bdccad90",
  "tre:5gPlus": "3971fbc3f4a9772e0d5e95e3ea33115b0f9de80cda2f8e9dd28baa230873c0b3"
};
const harness = () => {
  const messages = [];
  let fetches = 0;
  const self = { location: { href: 'https://example.com/df/assets/coverage-worker.js' }, postMessage: data => messages.push(data) };
  vm.runInNewContext(code, { self, URL, setTimeout, fetch: async () => { fetches++; return { ok: true, json: async () => boundary }; } });
  return { self, messages, fetches: () => fetches };
};
test('all 16 coverage results match the previous generator, and boundary is cached', async () => {
  const h = harness(); let id = 0;
  for (const [key, hash] of Object.entries(expected)) {
    const [operator, network] = key.split(':');
    await h.self.onmessage({ data: { kind: 'coverage', id: ++id, combinations: [{ operator, network }] } });
    const result = h.messages.at(-1);
    assert.equal(result.error, undefined);
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(result.collection)).digest('hex'), hash);
    assert(result.texture.features.length > 0);
  }
  assert.equal(h.fetches(), 1);
});
test('new selections supersede old work, cancellation suppresses pending results', async () => {
  const h = harness(); const combinations = [{ operator: 'telia', network: '4g' }];
  await Promise.all([h.self.onmessage({data:{kind:'coverage',id:1,combinations}}), h.self.onmessage({data:{kind:'coverage',id:2,combinations}})]);
  assert.deepEqual(h.messages.map(m=>m.id), [2]);
  const pending = h.self.onmessage({data:{kind:'coverage',id:3,combinations}});
  await h.self.onmessage({data:{kind:'cancel',id:4}}); await pending;
  assert.equal(h.messages.length, 1);
});
test('network-only selection includes all operators and cache repeats exactly', async () => {
  const h = harness();const combinations=['telia','tele2','telenor','tre'].map(operator=>({operator,network:'5g'}));
  await h.self.onmessage({data:{kind:'coverage',id:1,combinations}});
  const first=JSON.stringify(h.messages[0].collection);
  assert.equal(new Set(h.messages[0].texture.features.map(f=>f.properties.operator)).size,4);
  await h.self.onmessage({data:{kind:'coverage',id:2,combinations}});
  assert.equal(JSON.stringify(h.messages[1].collection),first);
});

test('street coverage keeps the requested operator and network', async () => {
  const h=harness();
  const roads=Array.from({length:40},(_,i)=>({properties:{class:'primary'},geometry:{type:'LineString',coordinates:[[18+i*0.001,59.3],[18.01+i*0.001,59.31]]}}));
  await h.self.onmessage({data:{kind:'streets',id:1,combinations:[{operator:'tre',network:'5g'}],roads,zoom:10}});
  const result=h.messages[0];assert.equal(result.error,undefined);assert(result.collection.features.length>0);
  assert(result.collection.features.every(f=>f.properties.operator==='tre'&&f.properties.network==='5g'));
});
test('boundary failure can be retried', async () => {
  const messages=[];let calls=0;
  const self={location:{href:'https://example.com/df/assets/coverage-worker.js'},postMessage:data=>messages.push(data)};
  vm.runInNewContext(code,{self,URL,setTimeout,fetch:async()=>({ok:++calls>1,json:async()=>boundary})});
  const combinations=[{operator:'telia',network:'4g'}];
  await self.onmessage({data:{kind:'coverage',id:1,combinations}});assert(messages[0].error);
  await self.onmessage({data:{kind:'coverage',id:2,combinations}});assert.equal(messages[1].error,undefined);assert(messages[1].collection.features.length>0);
});
