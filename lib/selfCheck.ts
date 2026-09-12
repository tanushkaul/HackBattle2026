import {strict as assert} from 'node:assert';
import {assessRows,parsePrintedRange} from './analyze';
import {fallbackResult} from './explanations';
import {normalizeExtraction,ReadingError} from './ai';
import {LANGUAGES,messages} from './i18n';
import {detectMime} from './files';
import type {ExtractedRow} from './types';
const input:ExtractedRow[]=[{nameAsPrinted:'LDL Cholesterol',value:145,unit:'mg/dL',printedRange:'<100'},{nameAsPrinted:'Hemoglobin',value:13.8,unit:'g/dL',printedRange:'12-16'},{nameAsPrinted:'Creatinine',value:1,unit:'mg/dL',printedRange:null}];
const row=(range:string|null,value=100,name='LDL Cholesterol')=>assessRows([{nameAsPrinted:name,value,unit:'mg/dL',printedRange:range}])[0];
assert.equal(row(null).flag,'not_assessed');assert.equal(row('<100').flag,'high');assert.equal(row('≤100').flag,'normal');assert.equal(row('>100').flag,'low');assert.equal(row('≥100').flag,'normal');assert.equal(row('40–100').flag,'normal');assert.equal(row('40-100',39.9).flag,'low');assert.equal(row('200-300',145).flag,'low');assert.equal(row('40-100',70,'LDL Cholesterol Ratio').flag,'not_assessed');assert.equal(row('40-100',Infinity).flag,'not_assessed');assert.equal(parsePrintedRange('adults 40-100; children 20-60'),null);
const extracted=normalizeExtraction({rows:[{nameAsPrinted:'Hemoglobin',value:13.8},{nameAsPrinted:'LDL Cholesterol',value:'145',unit:'mg/dL',printedRange:'<100'},{nameAsPrinted:'x',value:'unclear'},{value:4}]});
assert.equal(extracted.rows.length,3);assert.equal(extracted.rows[0].unit,null);assert.equal(extracted.rows[0].printedRange,null);assert.equal(extracted.rows[1].value,145);assert.equal(extracted.rows[2].value,null);assert.equal(extracted.unreadable.length,1);assert.throws(()=>normalizeExtraction({oops:[]}),ReadingError);
assert.equal(detectMime(Uint8Array.from([255,216,255,0])),'image/jpeg');assert.equal(detectMime(new TextEncoder().encode('%PDF-1.7')),'application/pdf');assert.equal(detectMime(new TextEncoder().encode('RIFF1234WEBP')),'image/webp');assert.equal(detectMime(new TextEncoder().encode('not an image')),null);
assert.deepEqual(LANGUAGES,['English','Hindi','Tamil','Kannada','Assamese']);
for(const [key,values] of Object.entries(messages)){assert.equal(values.length,5,key);assert.ok(values.every(v=>v.trim().length>0),key);for(let i=1;i<5;i++)assert.notEqual(values[0],values[i],key);}
for(const language of LANGUAGES){const translated=fallbackResult(input,language);assert.deepEqual(translated.rows.map(r=>r.flag),['high','normal','not_assessed']);if(language!=='English'){const script=language==='Hindi'?/[\u0900-\u097f]/:language==='Tamil'?/[\u0b80-\u0bff]/:language==='Kannada'?/[\u0c80-\u0cff]/:/[\u0980-\u09ff]/;assert.ok(script.test(translated.summary));for(const r of translated.rows){assert.ok(script.test(r.explanation));assert.ok(script.test(r.displayName));assert.ok(script.test(r.measures));if(r.reason)assert.ok(script.test(r.reason));}}}
console.log('Passed: printed ranges, optional extraction fields, numeric strings, MIME detection and full 5-language dictionary/catalog coverage.');
