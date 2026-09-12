export type ReportMime='application/pdf'|'image/png'|'image/jpeg'|'image/webp';
export function detectMime(b:Uint8Array):ReportMime|null {
 if(b.length>=5&&String.fromCharCode(...b.slice(0,5))==='%PDF-')return 'application/pdf';
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>x===b[i]))return 'image/png';
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function prepareFile(original:File):Promise<File>{
 if(!original.size)throw Error('EMPTY_FILE');
 if(original.size>12*1024*1024)throw Error('TOO_LARGE');
 const mime=detectMime(new Uint8Array(await original.slice(0,16).arrayBuffer()));
 if(!mime)throw Error('INVALID_FILE');
 const typed=new File([original],original.name,{type:mime});
 if(mime==='application/pdf'){if(original.size>6*1024*1024)throw Error('TOO_LARGE');return typed;}
 // Decode using the standard image element: createImageBitmap is not supported consistently on mobile.
 const url=URL.createObjectURL(typed);
 try{
 const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('DECODE'));i.src=url;});
 if(!img.naturalWidth||!img.naturalHeight)throw Error('DECODE');
 if(Math.max(img.naturalWidth,img.naturalHeight)<=3200&&typed.size<=5*1024*1024)return typed;
 const scale=Math.min(1,3200/Math.max(img.naturalWidth,img.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('DECODE');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
 if(!blob)throw Error('DECODE');if(blob.size>6*1024*1024)throw Error('TOO_LARGE');
 return new File([blob],original.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
 }finally{URL.revokeObjectURL(url);}
}
