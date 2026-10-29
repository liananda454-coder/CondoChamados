'use strict';
const $ = s => document.querySelector(s);
let state, tickets = [], selected, selectedVersion;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleString('pt-BR');
function notice(text, error=false) { $('#message').textContent=text; $('#message').className=error?'error':'success'; }
async function api(path, options={}) {
  const response=await fetch('/api'+path,{...options, headers:{'X-CondoChamados':'1', ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...options.headers}});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error || 'Não foi possível completar a operação.');
  return data;
}
function options(selector, values) { $(selector).replaceChildren(...values.map(v=>new Option(v,v))); }
async function init() {
  if(location.pathname==='/') return;
  state=await api('/session');
  $('#login').hidden=!!state.user; $('#workspace').hidden=!state.user;
  if(!state.user) { $('#account').replaceChildren(); return; }
  $('#account').innerHTML=`<span>${escapeHTML(state.user.name)}<small>${state.user.role==='admin'?'Administração':escapeHTML(state.user.unit)}</small></span><button id="logout" class="secondary">Sair</button>`;
  $('#logout').onclick=()=>{window.top.location.href='/signout-with-chatgpt?return_to=%2F';};
  const admin=state.user.role==='admin';
  $('#greeting').textContent=admin?'Visão geral do condomínio':'Seus chamados, de perto';
  $('#subtitle').textContent=admin?'Organize prioridades e acompanhe a evolução de cada atendimento.':'Abra uma ocorrência e acompanhe as atualizações da administração.';
  $('#users-tab').hidden=!admin;
  options('#new-category',state.categories); options('#update-status',state.statuses); options('#update-priority',state.priorities);
  options('#filter-status',['',...state.statuses]); $('#filter-status').options[0].text='Todos os status';
  options('#filter-category',['',...state.categories]); $('#filter-category').options[0].text='Todas as categorias';
  await refresh();
}
async function refresh() { tickets=(await api('/tickets')).tickets; render(); }
function render() {
  $('#stats').innerHTML=state.statuses.map((s,i)=>`<div class="stat"><span class="dot d${i}"></span><span>${s}</span><strong>${tickets.filter(t=>t.status===s).length}</strong></div>`).join('');
  const q=$('#search').value.toLocaleLowerCase('pt-BR');
  const rows=tickets.filter(t=>(!$('#filter-status').value || t.status===$('#filter-status').value)&&(!$('#filter-category').value || t.category===$('#filter-category').value)&&`${t.protocol} ${t.title} ${t.location} ${t.assignee}`.toLocaleLowerCase('pt-BR').includes(q));
  $('#count').textContent=`${rows.length} chamado(s)`;
  $('#ticket-list').innerHTML=rows.length?rows.map(t=>`<button class="ticket" data-id="${t.id}"><div><small>${escapeHTML(t.protocol)} · ${escapeHTML(t.category)}</small><h3>${escapeHTML(t.title)}</h3><p>${escapeHTML(t.location)} · ${escapeHTML(t.author)}</p></div><div class="ticket-right"><span class="badge b${state.statuses.indexOf(t.status)}">${escapeHTML(t.status)}</span><small>Prioridade ${escapeHTML(t.priority)}</small><small>${date(t.created_at)}</small></div><span aria-hidden="true">↗</span></button>`).join(''):'<div class="empty"><span>▤</span><h3>Nenhum chamado por aqui</h3><p>Registre uma ocorrência ou ajuste os filtros para encontrar um atendimento.</p></div>';
  document.querySelectorAll('.ticket').forEach(b=>b.onclick=()=>openDetail(b.dataset.id).catch(e=>notice(e.message,true)));
}
async function openDetail(id) {
  selected=id;
  const {ticket:t,history}=await api('/tickets/'+id);
  selectedVersion=t.version;
  $('#detail-protocol').textContent=t.protocol;
  $('#detail-content').innerHTML=`<h2>${escapeHTML(t.title)}</h2><span class="badge b${state.statuses.indexOf(t.status)}">${escapeHTML(t.status)}</span><p class="description">${escapeHTML(t.description)}</p><dl><dt>Local e categoria</dt><dd>${escapeHTML(t.location)} · ${escapeHTML(t.category)}</dd><dt>Solicitante</dt><dd>${escapeHTML(t.author)} · ${escapeHTML(t.unit)}</dd><dt>Responsável · Prioridade</dt><dd>${escapeHTML(t.assignee||'A definir')} · ${escapeHTML(t.priority)}</dd><dt>Abertura</dt><dd>${date(t.created_at)}</dd></dl>${t.has_photo?`<a href="/api/tickets/${t.id}/photo" target="_blank" rel="noopener"><img class="photo" src="/api/tickets/${t.id}/photo" alt="Foto anexada à ocorrência"></a>`:''}`;
  $('#history').innerHTML=history.map(h=>`<li><strong>${escapeHTML(h.actor)}</strong><small>${date(h.created_at)}</small><p>${escapeHTML(h.note)}</p></li>`).join('');
  $('#update-form').hidden=state.user.role!=='admin';
  for(const key of ['status','priority','assignee']) $('#update-form').elements[key].value=t[key];
  $('#update-form').elements.note.value=''; $('#update-form .form-error').textContent='';
  if(!$('#detail-dialog').open) $('#detail-dialog').showModal();
}
function submit(selector, handler) {
  $(selector).addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.target; const button=form.querySelector('button:not([type="button"])'); button.disabled=true;
    const error=form.querySelector('.form-error'); if(error)error.textContent='';
    try { await handler(form); } catch(e) { if(error)error.textContent=e.message; else notice(e.message,true); } finally {button.disabled=false;}
  });
}
submit('#ticket-form',async form=>{const result=await api('/tickets',{method:'POST',body:new FormData(form)});$('#new-dialog').close();form.reset();await refresh();notice(`Chamado ${result.protocol} registrado.`);await openDetail(result.id);});
submit('#update-form',async form=>{await api('/tickets/'+selected,{method:'PATCH',body:JSON.stringify({...Object.fromEntries(new FormData(form)),version:selectedVersion})});await refresh();await openDetail(selected);notice('Atendimento atualizado.');});
async function loadUsers(){const result=await api('/users');$('#user-list').innerHTML=result.users.map(u=>`<article class="user-row"><strong>${escapeHTML(u.name)}</strong><span>${escapeHTML(u.email)}</span><span>${escapeHTML(u.unit)} · ${u.role==='admin'?'Administração':'Morador'}</span></article>`).join('');}
submit('#user-form',async form=>{await api('/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();notice('Acesso cadastrado.');await loadUsers();});
$('#new-ticket').onclick=()=>{$('#ticket-form .form-error').textContent='';$('#new-dialog').showModal();};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
for(const selector of ['#search','#filter-status','#filter-category']) $(selector).addEventListener('input',render);
$('#tickets-tab').onclick=()=>{$('#ticket-section').hidden=false;$('#user-section').hidden=true;};
$('#users-tab').onclick=async()=>{$('#ticket-section').hidden=true;$('#user-section').hidden=false;try{await loadUsers();}catch(e){notice(e.message,true);}};
init().catch(e=>notice(e.message,true));
