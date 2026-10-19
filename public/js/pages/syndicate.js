import { S, L, tr, api, refreshState, errorText } from '../core.js';
import { esc, icon, fmt, modal, toast, emptyState, timeAgo } from '../ui.js';

let rootEl = null;
let data = null;
let chat = [];
let cleanupFns = [];
let poll = null;

export async function render(root) {
  rootEl = root;
  await load();
  poll = setInterval(async () => {
    if (!rootEl || document.hidden) return;
    try {
      const res = await api('/api/chat');
      chat = res.messages;
      renderChat();
    } catch { /* noop */ }
  }, 8000);
  return () => { if (poll) clearInterval(poll); rootEl = null; };
}

async function load() {
  data = await api('/api/alliance');
  chat = (await api('/api/chat')).messages;
  draw();
}

function draw() {
  if (!rootEl) return;
  const mine = data.mine;
  rootEl.innerHTML = `<div class="section-title"><div><div class="kicker">${esc(tr('syndicate.subtitle'))}</div><h2>${esc(tr('syndicate.title'))}</h2></div><span class="sub">${data.list.length} SYNDICATES</span></div>
    <div class="grid side">
      <div class="col">
        <div class="panel">
          <div class="panel-head"><h3>${esc(tr('syndicate.mine'))}</h3>${mine ? `<span class="tag cyan">[${esc(mine.tag)}]</span>` : ''}</div>
          ${mine ? `<div class="row between"><div><div style="font-family:var(--font-display);font-size:22px;letter-spacing:.05em">${esc(mine.name)}</div><div class="mono tiny muted">${esc(tr('syndicate.leader'))} #${mine.leaderId} · ${mine.members.length} ${esc(tr('syndicate.members'))}</div></div><button class="btn sm danger" data-leave>${esc(tr('syndicate.leave'))}</button></div>
            <p class="small muted">${esc(L(mine.desc))}</p>
            <div class="list" style="margin-top:10px">${mine.members.map((m) => `<div class="troop-row"><div class="tr-name"><span class="mini-avatar">${esc(m.name.slice(0, 1))}</span><div><b>${esc(m.name)}</b><div class="mono tiny muted">${esc(tr('charter.' + m.charter))}</div></div></div><span class="tag">${esc(m.role)}</span></div>`).join('')}</div>`
            : `<div class="empty-state"><b>${esc(tr('syndicate.none'))}</b></div><button class="btn primary" data-create>${icon('plus')} ${esc(tr('syndicate.create'))}</button>`}
        </div>
        <div class="panel">
          <div class="panel-head"><h3>${esc(tr('syndicate.members'))}</h3><span class="tag">${data.list.length}</span></div>
          <div class="list">${data.list.map((a) => `<div class="list-row"><div class="lr-main"><div class="lr-title">[${esc(a.tag)}] ${esc(a.name)}</div><div class="lr-sub">${esc(a.leaderName)} · ${a.memberCount} ${esc(tr('syndicate.members'))} · ${a.open ? esc(tr('syndicate.open')) : esc(tr('syndicate.closed'))}</div></div>${!mine ? `<button class="btn xs" data-join="${a.id}">${esc(tr('syndicate.join'))}</button>` : ''}</div>`).join('') || emptyState(tr('common.empty'))}</div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>${esc(tr('syndicate.chat'))}</h3><span class="tag green">LIVE</span></div>
        <div class="chat-box" id="chat-box"></div>
        <form class="chat-form" id="chat-form"><input class="input" id="chat-input" maxlength="240" placeholder="${esc(tr('syndicate.chatPlaceholder'))}" autocomplete="off"><button class="btn primary" type="submit">${esc(tr('syndicate.send'))}</button></form>
      </div>
    </div>`;
  renderChat();
  rootEl.querySelector('[data-create]')?.addEventListener('click', openCreate);
  rootEl.querySelector('[data-leave]')?.addEventListener('click', leave);
  rootEl.querySelectorAll('[data-join]').forEach((b) => b.addEventListener('click', () => join(b.dataset.join)));
  rootEl.querySelector('#chat-form')?.addEventListener('submit', sendChat);
}

function renderChat() {
  const box = rootEl?.querySelector('#chat-box');
  if (!box) return;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = chat.map((m) => `<div class="chat-msg ${m.self ? 'self' : ''}"><span class="cm-name">${esc(m.name)}${m.role === 'admin' ? ' ★' : ''}</span><span class="cm-body">${esc(m.body)}</span></div>`).join('') || `<div class="empty-state">${esc(tr('common.empty'))}</div>`;
  if (atBottom) box.scrollTop = box.scrollHeight;
}

async function openCreate() {
  modal({
    title: tr('syndicate.createTitle'), narrow: true,
    body: `<div class="field"><label>${esc(tr('syndicate.tag'))}</label><input class="input" id="al-tag" maxlength="5" placeholder="NOISE"></div>
      <div class="field"><label>${esc(tr('syndicate.name'))}</label><input class="input" id="al-name" maxlength="32"></div>
      <div class="field"><label>${esc(tr('syndicate.desc'))}</label><textarea class="textarea" id="al-desc" maxlength="120"></textarea></div>`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('syndicate.create'), class: 'primary', onClick: async () => {
        try {
          await api('/api/alliance/create', { method: 'POST', body: { tag: document.getElementById('al-tag').value, name: document.getElementById('al-name').value, desc: document.getElementById('al-desc').value } });
          toast(tr('syndicate.createSuccess'), 'success'); await load();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
  });
}

async function join(id) {
  try { await api(`/api/alliance/${id}/join`, { method: 'POST' }); toast(tr('syndicate.joinSuccess'), 'success'); await load(); }
  catch (e) { toast(errorText(e), 'error'); }
}
async function leave() {
  try { await api('/api/alliance/leave', { method: 'POST' }); toast(tr('syndicate.leaveSuccess'), 'success'); await load(); }
  catch (e) { toast(errorText(e), 'error'); }
}
async function sendChat(e) {
  e.preventDefault();
  const input = rootEl.querySelector('#chat-input');
  const body = input.value.trim();
  if (!body) return;
  try {
    await api('/api/chat', { method: 'POST', body: { body } });
    input.value = '';
    chat = (await api('/api/chat')).messages;
    renderChat();
  } catch (e) { toast(errorText(e), 'error'); }
}
