import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { STATUSES,CATEGORIES,PRIORITIES,ApiError,field,checkUpdate,imageType,mayRead } from './rules';

type Member={id:number;user_id:string;name:string;email:string;unit:string;role:string};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const database=()=>{if(!env.DB)throw new Error('Database unavailable');return env.DB;};
async function member():Promise<Member|null>{
 const identity=await getChatGPTUser();if(!identity)return null;
 const db=database(), email=identity.email.trim().toLowerCase();
 // Bootstrap only on this owner-private Site. A single primary key makes the claim atomic.
 await db.prepare('INSERT OR IGNORE INTO condo_owner (id,user_id) VALUES (1,?)').bind(identity.userId).run();
 const owner=await db.prepare('SELECT user_id FROM condo_owner WHERE id=1').first<{user_id:string}>();
 let row=await db.prepare('SELECT * FROM condo_members WHERE user_id=?').bind(identity.userId).first<Member>();
 if(!row&&owner?.user_id===identity.userId){
  await db.prepare("INSERT OR IGNORE INTO condo_members (user_id,name,email,unit,role) VALUES (?,?,?,'Administração','admin')").bind(identity.userId,identity.displayName,email).run();
 }else if(!row){
  await db.prepare('UPDATE condo_members SET user_id=? WHERE email=? AND user_id IS NULL').bind(identity.userId,email).run();
 }
 row=await db.prepare('SELECT * FROM condo_members WHERE user_id=?').bind(identity.userId).first<Member>();
 if(!row)throw new ApiError(403,'Sua conta ainda não foi autorizada pela administração.');
 return row;
}
async function getTicket(id:number,user:Member){
 const row=await database().prepare('SELECT t.*,m.name AS author,m.unit FROM condo_tickets t JOIN condo_members m ON m.user_id=t.user_id WHERE t.id=?').bind(id).first<any>();
 if(!row||!mayRead(user,row))throw new ApiError(404,'Chamado não encontrado.');return row;
}
function admin(user:Member){if(user.role!=='admin')throw new ApiError(403,'Apenas a administração pode realizar esta ação.');}
export async function handle(request:Request):Promise<Response>{
 try{
  const url=new URL(request.url), path=url.pathname.slice(4), db=database();
  if(!['GET','HEAD'].includes(request.method)){
   if(request.headers.get('X-CondoChamados')!=='1'||request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.get('origin')&&request.headers.get('origin')!==url.origin))throw new ApiError(403,'Atualize a página e tente novamente.');
   if(Number(request.headers.get('content-length')||0)>6*1024*1024)throw new ApiError(413,'Envie uma foto menor que 6 MB.');
  }
  const user=await member();
  if(path==='/session'&&request.method==='GET')return json({user:user?{...user,id:user.id}:null,statuses:STATUSES,categories:CATEGORIES,priorities:PRIORITIES});
  if(!user)throw new ApiError(401,'Entre com sua conta autorizada para continuar.');
  if(path==='/tickets'&&request.method==='GET'){
   const rows=await db.prepare("SELECT t.id,t.protocol,t.title,t.category,t.location,t.priority,t.status,t.assignee,t.created_at,t.updated_at,m.name AS author,m.unit FROM condo_tickets t JOIN condo_members m ON m.user_id=t.user_id WHERE (?='admin' OR t.user_id=?) ORDER BY t.id DESC").bind(user.role,user.user_id).all();
   return json({tickets:rows.results});
  }
  if(path==='/tickets'&&request.method==='POST'){
   const form=await request.formData(), data=Object.fromEntries(form);
   const title=field(data,'title',5,120), description=field(data,'description',10,4000), location=field(data,'location',2,160), category=field(data,'category');
   if(!CATEGORIES.includes(category))throw new ApiError(400,'Categoria inválida.');
   const photo=form.get('photo');let photoKey:string|null=null, photoType:string|null=null;
   if(photo instanceof File&&photo.size){
    if(photo.size>5*1024*1024)throw new ApiError(413,'A foto deve ter no máximo 5 MB.');
    const bytes=new Uint8Array(await photo.arrayBuffer());photoType=imageType(bytes);
    if(!photoType)throw new ApiError(400,'Use uma foto JPG, PNG ou WebP válida.');
    if(!env.BUCKET)throw new Error('Storage unavailable');
    photoKey='photos/'+crypto.randomUUID();await env.BUCKET.put(photoKey,bytes,{httpMetadata:{contentType:photoType}});
   }
   const stamp=new Date().toISOString(),protocol=`CC-${stamp.slice(0,4)}-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
   try{
    const result=await db.batch([
     db.prepare('INSERT INTO condo_tickets (protocol,user_id,title,description,category,location,photo_key,photo_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id').bind(protocol,user.user_id,title,description,category,location,photoKey,photoType,stamp,stamp),
     db.prepare('INSERT INTO condo_history (ticket_id,actor_id,actor_name,note,created_at) SELECT id,?,?,?,? FROM condo_tickets WHERE protocol=?').bind(user.user_id,user.name,'Chamado aberto.',stamp,protocol)
    ]);
    return json({id:(result[0].results[0] as any).id,protocol},201);
   }catch(e){if(photoKey&&env.BUCKET)await env.BUCKET.delete(photoKey);throw e;}
  }
  const match=path.match(/^\/tickets\/(\d+)(\/photo)?$/);
  if(match){
   const id=Number(match[1]),row=await getTicket(id,user);
   if(match[2]&&request.method==='GET'){
    if(!row.photo_key||!env.BUCKET)throw new ApiError(404,'Foto não encontrada.');
    const object=await env.BUCKET.get(row.photo_key);if(!object)throw new ApiError(404,'Foto não encontrada.');
    return new Response(object.body,{headers:{'Content-Type':row.photo_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="foto"'}});
   }
   if(!match[2]&&request.method==='GET'){
    const history=await db.prepare('SELECT note,created_at,actor_name AS actor FROM condo_history WHERE ticket_id=? ORDER BY id').bind(id).all();
    const {photo_key,photo_type,...ticket}=row;return json({ticket:{...ticket,has_photo:!!photo_key},history:history.results});
   }
   if(!match[2]&&request.method==='PATCH'){
    admin(user);const data=await request.json() as Record<string,unknown>, {status,priority,assignee,note}=checkUpdate(data);
    if(Number(data.version)!==row.version)throw new ApiError(409,'O chamado foi atualizado. Feche e abra novamente antes de salvar.');
    const changes=[['status','Status',status],['priority','Prioridade',priority],['assignee','Responsável',assignee]].filter(([key,,v])=>row[key]!==v).map(([key,label,v])=>`${label}: ${row[key]||'A definir'} → ${v}`);
    if(note)changes.push(note);if(!changes.length)throw new ApiError(400,'Nenhuma alteração informada.');
    const stamp=new Date().toISOString();
    // History first, under the same optimistic version guard and atomic D1 batch.
    const results=await db.batch([
     db.prepare('INSERT INTO condo_history (ticket_id,actor_id,actor_name,note,created_at) SELECT id,?,?,?,? FROM condo_tickets WHERE id=? AND version=?').bind(user.user_id,user.name,changes.join('\n'),stamp,id,row.version),
     db.prepare('UPDATE condo_tickets SET status=?,priority=?,assignee=?,updated_at=?,closed_at=?,version=version+1 WHERE id=? AND version=?').bind(status,priority,assignee,stamp,status==='Concluído'?(row.closed_at||stamp):null,id,row.version)
    ]);
    if(!results[1].meta.changes)throw new ApiError(409,'O chamado foi atualizado por outra pessoa. Reabra antes de salvar.');
    return json({ok:true});
   }
  }
  if(path==='/users'){
   admin(user);
   if(request.method==='GET')return json({users:(await db.prepare('SELECT id,name,email,unit,role FROM condo_members ORDER BY name').all()).results});
   if(request.method==='POST'){
    const data=await request.json() as Record<string,unknown>,name=field(data,'name',2,100),email=field(data,'email',3,254).toLowerCase(),unit=field(data,'unit',1,80),role=field(data,'role');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['admin','resident'].includes(role))throw new ApiError(400,'Confira o e-mail e o perfil.');
    try{await db.prepare('INSERT INTO condo_members (name,email,unit,role) VALUES (?,?,?,?)').bind(name,email,unit,role).run();}catch(e){if(String(e).includes('UNIQUE'))throw new ApiError(409,'E-mail já cadastrado.');throw e;}
    return json({ok:true},201);
   }
  }
  throw new ApiError(404,'Rota não encontrada.');
 }catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);console.error('CondoChamados API failure',e instanceof Error?e.message:'unknown');return json({error:'Não foi possível concluir a operação. Tente novamente.'},500);}
}
