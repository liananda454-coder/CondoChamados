import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';

// Isolated API integration test. Identity and storage bindings are mocked;
// application request handling and SQL are the actual production modules.
test('API: primeiro acesso, cadastro, foto, isolamento, conclusão e concorrência', async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 function statement(query,values=[]){return {bind(...args){return statement(query,args);},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return {meta:sql.prepare(query).run(...values)};},query,values};}
 const db={prepare:statement,async batch(stmts){sql.exec('BEGIN');try{const results=stmts.map(s=>{const prepared=sql.prepare(s.query);if(/RETURNING/i.test(s.query))return {results:prepared.all(...s.values),meta:{changes:1}};return {results:[],meta:prepared.run(...s.values)};});sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const objects=new Map(),bucket={async put(k,b,options){objects.set(k,{body:b,...options});},async get(k){return objects.get(k)||null;},async delete(k){objects.delete(k);}};
 let identity={userId:'owner-test',email:'owner@example.test',displayName:'Admin de teste'};
 const context=vm.createContext({Request,Response,URL,File,FormData,Uint8Array,crypto,console,Date,Error});
 const bindings=new vm.SyntheticModule(['env'],function(){this.setExport('env',{DB:db,BUCKET:bucket});},{context});
 const auth=new vm.SyntheticModule(['getChatGPTUser'],function(){this.setExport('getChatGPTUser',async()=>identity);},{context});
 const makeModule=path=>new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,{context});
 const rules=makeModule('lib/rules.ts'),api=makeModule('lib/api.ts');
 await api.link(spec=>spec==='cloudflare:workers'?bindings:spec.endsWith('chatgpt-auth')?auth:rules);await api.evaluate();
 const handle=api.namespace.handle;
 async function call(path,method='GET',body,custom=true){const headers={'Origin':'https://test.example'};if(custom)headers['X-CondoChamados']='1';if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}const response=await handle(new Request('https://test.example/api'+path,{method,headers,body}));return {response,status:response.status,data:response.headers.get('content-type')?.includes('json')?await response.json():null};}
 assert.equal((await call('/session')).data.user.role,'admin');
 assert.equal((await call('/users','POST',{name:'Morador teste',email:'resident@example.test',unit:'Torre 1 / 101',role:'resident'})).status,201);
 const owner=identity;identity={userId:'resident-test',email:'resident@example.test',displayName:'Morador'};
 assert.equal((await call('/session')).data.user.role,'resident');
 assert.equal((await call('/users')).status,403);
 assert.equal((await call('/tickets','POST',{},false)).status,403);
 const data=new FormData();for(const [key,val] of Object.entries({title:'Vazamento na garagem',description:'Água caindo sobre o piso da garagem.',location:'Garagem',category:'Hidráulica'}))data.set(key,val);
 data.set('photo',new File([Uint8Array.from([255,216,255,0])],'test.jpg',{type:'image/jpeg'}));
 const created=await call('/tickets','POST',data);assert.equal(created.status,201);
 const id=created.data.id;assert.equal((await call(`/tickets/${id}/photo`)).status,200);
 assert.equal((await call(`/tickets/${id}`,'PATCH',{})).status,403);
 identity=owner;
 assert.equal((await call(`/tickets/${id}`,'PATCH',{status:'Concluído',priority:'Alta',assignee:'Equipe',note:'',version:1})).status,400);
 assert.equal((await call(`/tickets/${id}`,'PATCH',{status:'Concluído',priority:'Alta',assignee:'Equipe',note:'Reparo efetuado',version:1})).status,200);
 assert.equal((await call(`/tickets/${id}`,'PATCH',{status:'Em análise',priority:'Alta',assignee:'Equipe',note:'Versão antiga',version:1})).status,409);
 const detail=(await call(`/tickets/${id}`)).data;assert.equal(detail.ticket.status,'Concluído');assert.equal(detail.history.length,2);
 assert.equal((await call('/users','POST',{name:'Outro morador',email:'other@example.test',unit:'Torre 2 / 201',role:'resident'})).status,201);
 identity={userId:'other-test',email:'other@example.test',displayName:'Outro'};
 assert.equal((await call('/tickets')).data.tickets.length,0);assert.equal((await call(`/tickets/${id}`)).status,404);assert.equal((await call(`/tickets/${id}/photo`)).status,404);
 identity=null;assert.equal((await call('/tickets')).status,401);
 sql.close();
});
