// Test-only loader for project TypeScript, without a test server or real network.
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const Module=require('node:module');
const root=path.resolve(__dirname,'..');const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...rest){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...rest);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(mod,filename)=>{const source=fs.readFileSync(filename,'utf8');const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;mod._compile(output,filename);};
