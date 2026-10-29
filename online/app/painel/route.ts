import { markup } from '../../lib/markup';
import { getChatGPTUser,chatGPTSignInPath } from '../chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await getChatGPTUser())return Response.redirect(new URL(chatGPTSignInPath('/painel'),request.url),302);
 return new Response(markup,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
