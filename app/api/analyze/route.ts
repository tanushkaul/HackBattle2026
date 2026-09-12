import {NextResponse} from 'next/server';
import {assessRows,scanForAdvice} from '@/lib/analyze';
import {extractFromImage,explainRows,ReadingError} from '@/lib/ai';
import {fallbackResult} from '@/lib/explanations';
import {isLanguage,tr,type Language} from '@/lib/i18n';
import {detectMime} from '@/lib/files';
import type {ExtractedRow} from '@/lib/types';
export const runtime='nodejs';
export const maxDuration=60;
function validRows(rows:unknown):rows is ExtractedRow[]{return Array.isArray(rows)&&rows.length>0&&rows.length<=100&&rows.every(r=>r&&typeof r.nameAsPrinted==='string'&&r.nameAsPrinted.trim().length>0&&r.nameAsPrinted.length<=200&&(r.value===null||typeof r.value==='number'&&Number.isFinite(r.value))&&(r.unit===null||typeof r.unit==='string'&&r.unit.length<=80)&&(r.printedRange===null||typeof r.printedRange==='string'&&r.printedRange.length<=200));}
const configured=()=>!!(process.env.OPENROUTER_API_KEY||process.env.AI_API_KEY)?.trim();
function fail(code:string,status:number){return NextResponse.json({code},{status,headers:{'Cache-Control':'no-store'}});}
export async function GET(){return NextResponse.json({aiAvailable:configured()},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
 try{
 if(Number(request.headers.get('content-length'))>8500000)return fail('TOO_LARGE',413);
 const raw=await request.text();if(raw.length>8500000)return fail('TOO_LARGE',413);
 let body;try{body=JSON.parse(raw);}catch{return fail('BAD_REQUEST',400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return fail('BAD_REQUEST',400);
 const language:Language=isLanguage(body.language)?body.language:'English';
 if(body.language!==undefined&&!isLanguage(body.language))return fail('BAD_REQUEST',400);
 if(body.rows!==undefined){
 if(!validRows(body.rows))return fail('VALUES',400);
 const fallback=fallbackResult(body.rows,language);
 if(!configured())return NextResponse.json({...fallback,mode:'offline'});
 try{
 const explained=await explainRows(assessRows(body.rows),language);
 const script=language==='Hindi'?/[\u0900-\u097f]/:language==='Tamil'?/[\u0b80-\u0bff]/:language==='Kannada'?/[\u0c80-\u0cff]/:language==='Assamese'?/[\u0980-\u09ff]/:/[a-z]/i;
 // The deterministic status and translated comparison sentence always remain visible.
 const rows=fallback.rows.map((r,i)=>{
 const extra=explained.byKey[String(i)];
 if(!extra||scanForAdvice(extra.explanation)||!script.test(extra.explanation))return r;
 return {...r,explanation:extra.explanation,doctorQuestion:extra.doctorQuestion&&!scanForAdvice(extra.doctorQuestion)&&script.test(extra.doctorQuestion)?extra.doctorQuestion:r.doctorQuestion};
 });
 return NextResponse.json({...fallback,rows,mode:'live'});
 }catch{return NextResponse.json({...fallback,mode:'offline',noticeCode:'translationFallback'});}
 }
 const {imageBase64,mimeType}=body;
 if(typeof imageBase64!=='string'||!imageBase64.length||imageBase64.length>8388608||imageBase64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64))return fail('INVALID_FILE',400);
 const bytes=Buffer.from(imageBase64,'base64');
 const actual=detectMime(bytes);
 if(!actual||actual!==mimeType)return fail('INVALID_FILE',415);
 if(bytes.length>6*1024*1024)return fail('TOO_LARGE',413);
 if(!configured())return fail('MISSING_KEY',503);
 const result=await extractFromImage(imageBase64,actual);
 if(!result.rows.length)return fail('UNREADABLE',422);
 return NextResponse.json({extracted:result.rows,unreadableCount:result.unreadable.length});
 }catch(error){return error instanceof ReadingError?fail(error.code,error.status):fail('SERVICE',500);}
}
