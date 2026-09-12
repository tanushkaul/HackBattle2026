import { assessRows } from './analyze';
import {tr, type Language} from './i18n';
import {term} from './terms';
import type {AnalyzeResult,ExtractedRow} from './types';
export function fallbackResult(input:ExtractedRow[],language:Language='English'):AnalyzeResult {
 const assessed=assessRows(input);
 return {rows:assessed.map(r=>{const info=term(r.matchedKey,language,r.nameAsPrinted);return {...r,displayName:info.name,measures:info.meaning,reason:r.flag==='not_assessed'?tr(language,!r.printedRange?'missingRange':'statusUnknown'):'',explanation:info.meaning+' '+tr(language,r.flag==='normal'?'statusNormal':r.flag==='high'?'statusHigh':r.flag==='low'?'statusLow':'statusUnknown'),doctorQuestion:r.flag==='normal'?null:tr(language,'questionMeaning')};}),summary:tr(language,'summaryText'),unreadable:[],guardrailTriggered:false,disclaimer:tr(language,'disclaimer')};
}
export function parseText(text:string):ExtractedRow[]{
 return text.split('\n').filter(l=>l.trim()).slice(0,100).map(l=>{const p=l.split(/\t|\|/).map(x=>x.trim());return {nameAsPrinted:p[0]||'',value:/^-?\d+(\.\d+)?$/.test(p[1]||'')?Number(p[1]):null,unit:p[2]||null,printedRange:p[3]||null};});
}
