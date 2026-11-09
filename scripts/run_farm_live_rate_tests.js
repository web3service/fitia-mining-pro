'use strict';
const assert=require('assert');
const {createLiveRateService,SupabaseLiveRateRepository}=require('../farm-live-rate');
(async()=>{
  const calls=[]; const storage={request:async(method,path,body)=>{calls.push({method,path,body});return method==='GET'?[{rate_units:100000000,version:1,enabled:false}]:{rateUnits:'50000000',version:2,enabled:false};}};
  const svc=createLiveRateService(new SupabaseLiveRateRepository(storage));
  assert.strictEqual((await svc.get()).rateUnits,'100000000');
  assert.deepStrictEqual(await svc.set({rateUnits:'50000000',expectedVersion:1}),{rateUnits:'50000000',version:2,enabled:false});
  assert.deepStrictEqual(calls[1].body,{p_rate_units:'50000000',p_expected_version:1});
  await assert.rejects(svc.set({rateUnits:'0',expectedVersion:1}),e=>e.code==='LIVE_RATE_PARAMS');
  await assert.rejects(svc.set({rateUnits:'50000000',expectedVersion:'1'}),e=>e.code==='LIVE_RATE_PARAMS');
  console.log('Taux réel préparé : validation, version et réponse atomique (sans activation)');
})().catch(e=>{console.error(e);process.exitCode=1;});
