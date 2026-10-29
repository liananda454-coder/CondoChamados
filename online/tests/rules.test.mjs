import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUpdate, mayRead, imageType, field } from '../.sites-runtime/test-build/rules.js';
test('conclusão exige responsável e solução',()=>{
 assert.throws(()=>checkUpdate({status:'Concluído',priority:'Alta',assignee:'Equipe',note:''}));
 assert.throws(()=>checkUpdate({status:'Em atendimento',priority:'Alta',assignee:'',note:'A caminho'}));
 assert.equal(checkUpdate({status:'Concluído',priority:'Alta',assignee:'Equipe',note:'Reparado'}).status,'Concluído');
});
test('morador só acessa os próprios registros; administração acessa todos',()=>{
 assert.equal(mayRead({user_id:'ana',role:'resident'},{user_id:'bia'}),false);
 assert.equal(mayRead({user_id:'ana',role:'resident'},{user_id:'ana'}),true);
 assert.equal(mayRead({user_id:'admin',role:'admin'},{user_id:'ana'}),true);
});
test('rejeita formato executável e aceita assinaturas de imagem',()=>{
 assert.equal(imageType(new TextEncoder().encode('<svg onload="alert(1)">')),null);
 assert.equal(imageType(Uint8Array.from([255,216,255,0])),'image/jpeg');
 assert.equal(imageType(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');
});
test('valida campos e valores de status',()=>{
 assert.throws(()=>field({title:[]},'title'));
 assert.throws(()=>checkUpdate({status:'errado',priority:'Alta',assignee:'Equipe',note:'Atualização'}));
 assert.equal(field({title:'  Garagem  '},'title'),'Garagem');
});
