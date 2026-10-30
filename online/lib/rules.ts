export const STATUSES = ['Aberto', 'Em análise', 'Em atendimento', 'Concluído'];
export const CATEGORIES = ['Elétrica', 'Hidráulica', 'Elevadores', 'Portões', 'Iluminação', 'Limpeza', 'Áreas comuns', 'Segurança', 'Jardim e poda', 'Outros'];
export const PRIORITIES = ['Baixa', 'Normal', 'Alta', 'Urgente'];
export class ApiError extends Error { constructor(public status:number, message:string){super(message);} }
export function field(data:Record<string,unknown>, key:string, min=1, max=200):string {
 const v=data[key]; if(typeof v!=='string'||v.trim().length<min||v.trim().length>max) throw new ApiError(400,`Confira o campo ${key}: entre ${min} e ${max} caracteres.`);return v.trim();
}
export function checkUpdate(data:Record<string,unknown>){
 const status=field(data,'status'), priority=field(data,'priority'), assignee=field(data,'assignee',0,120), note=field(data,'note',0,2000);
 if(!STATUSES.includes(status)||!PRIORITIES.includes(priority))throw new ApiError(400,'Status ou prioridade inválidos.');
 if(['Em atendimento','Concluído'].includes(status)&&!assignee)throw new ApiError(400,'Informe o responsável.');
 if(status==='Concluído'&&!note)throw new ApiError(400,'Descreva a solução para concluir o chamado.');
 return {status,priority,assignee,note};
}
export function imageType(b:Uint8Array):string|null{
 if(b.length>3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n))return 'image/png';
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export function mayRead(user:{user_id:string;role:string}, ticket:{user_id:string}){return user.role==='admin'||user.user_id===ticket.user_id;}
