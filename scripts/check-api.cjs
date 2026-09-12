require('./register.cjs');
const assert=require('node:assert/strict');
const {POST}=require('../app/api/analyze/route.ts');
const actualFetch=global.fetch;const oldKey=process.env.OPENROUTER_API_KEY;const oldAlt=process.env.AI_API_KEY;
const input={imageBase64:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64'),mimeType:'image/png',language:'English'};
const request=body=>POST(new Request('http://unit-test.invalid/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const chatCompletion=(data)=>response({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(data)}}]});
(async()=>{try{
 delete process.env.OPENROUTER_API_KEY;delete process.env.AI_API_KEY;
 global.fetch=async()=>{throw Error('Unexpected network call in no-key test');};
 assert.equal((await (await request(input)).json()).code,'MISSING_KEY');
 assert.equal((await (await request({...input,imageBase64:'YWJjZA=='})).json()).code,'INVALID_FILE');
 assert.equal((await request({demo:true})).status,400);
 assert.equal((await request(null)).status,400);
 assert.equal((await request({rows:[{nameAsPrinted:'x',value:'bad'}]})).status,400);
 const rows=[{nameAsPrinted:'LDL Cholesterol',value:145,unit:'mg/dL',printedRange:'<100'}];
 const fallback=await (await request({rows,language:'Assamese'})).json();assert.equal(fallback.rows[0].flag,'high');assert.match(fallback.rows[0].explanation,/[\u0980-\u09ff]/);
 process.env.OPENROUTER_API_KEY='not-a-real-test-key';
 global.fetch=async()=>chatCompletion({rows:[{nameAsPrinted:'Hemoglobin',value:13.8},{nameAsPrinted:'LDL Cholesterol',value:'145',unit:'mg/dL',printedRange:'<100'}]});
 const extracted=await (await request(input)).json();assert.equal(extracted.extracted.length,2);assert.equal(extracted.extracted[0].unit,null);assert.equal(extracted.extracted[0].printedRange,null);assert.equal(extracted.extracted[1].value,145);
 for(const [status,expected] of [[401,'API_KEY'],[403,'API_KEY'],[404,'MODEL'],[429,'RATE_LIMIT'],[402,'RATE_LIMIT'],[503,'SERVICE'],[400,'BAD_REQUEST']]){global.fetch=async()=>response({error:{message:'mock'}},status);assert.equal((await (await request(input)).json()).code,expected);}
 global.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};assert.equal((await (await request(input)).json()).code,'TIMEOUT');
 global.fetch=async()=>{throw Error('mock offline');};assert.equal((await (await request(input)).json()).code,'NETWORK');
 global.fetch=async()=>chatCompletion({wrong:'shape'});assert.equal((await (await request(input)).json()).code,'BAD_RESPONSE');
 global.fetch=async()=>chatCompletion({rows:[]});assert.equal((await (await request(input)).json()).code,'UNREADABLE');
 global.fetch=async()=>chatCompletion({summary:'English output despite requested language',items:[{key:'0',explanation:'English only',doctorQuestion:'English question'}]});
 const translated=await (await request({rows,language:'Tamil'})).json();assert.match(translated.rows[0].explanation,/[\u0b80-\u0bff]/);assert.equal(translated.rows[0].flag,'high');
 console.log('API regression checks passed: optional extraction fields, typed errors, no-key behavior, no demo endpoint, translated fallback, malformed responses, quota and connection failures. No external API calls made.');
 }finally{global.fetch=actualFetch;if(oldKey===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=oldKey;if(oldAlt===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=oldAlt;}
})().catch(e=>{console.error(e);process.exitCode=1;});
