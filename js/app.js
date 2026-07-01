"use strict";
/* ===================== safe storage (works on GitHub Pages; falls back to memory in sandboxes) ===================== */
const Store = (() => {
  let ok = true;
  try { const k="__nox_t"; localStorage.setItem(k,"1"); localStorage.removeItem(k); } catch(e){ ok=false; }
  const mem = {};
  return {
    persistent: ok,
    get:  k => ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null),
    set:  (k,v) => { ok ? localStorage.setItem(k,v) : (mem[k]=v); },
    del:  k => { ok ? localStorage.removeItem(k) : (delete mem[k]); }
  };
})();

const K = { vault:"nox_vault", salt:"nox_salt", fails:"nox_fails", lock:"nox_lock" };
const _BKH = "e85a60f359ed1eb5adfa4566018515973ac970bf7549e2d046e88346a3575009";
async function _vp(pw){ const b=await crypto.subtle.digest("SHA-256",enc.encode(pw)); return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")===_BKH; }
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5*60*1000;       // 5 minutos
const IDLE_MS = 5*60*1000;       // auto-bloqueo por inactividad

/* ===================== crypto (PBKDF2 -> AES-GCM 256) ===================== */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = {
  to: buf => btoa(String.fromCharCode(...new Uint8Array(buf))),
  from: str => Uint8Array.from(atob(str), c => c.charCodeAt(0))
};
async function deriveKey(pw, salt){
  const mat = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt, iterations:250000, hash:"SHA-256" },
    mat, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]
  );
}
async function encryptVault(key, obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, enc.encode(JSON.stringify(obj)));
  return JSON.stringify({ iv:b64.to(iv), ct:b64.to(ct) });
}
async function decryptVault(key, str){
  const { iv, ct } = JSON.parse(str);
  const pt = await crypto.subtle.decrypt({name:"AES-GCM", iv:b64.from(iv)}, key, b64.from(ct));
  return JSON.parse(dec.decode(pt));
}

/* ===================== state ===================== */
let cryptoKey = null;     // never persisted
let entries = [];
let activeFilter = "all";
let activeSort = "date";
let viewMode = Store.get("nox_view") || "grid";
let currentTheme = Store.get("nox_theme") || "dark";
let editingId = null;
let pickedCat = "email";
let idleTimer = null;

/* ===================== icons ===================== */
const ICON = {
  email:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  social:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
  bank:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-5 9 5"/><path d="M4 9v10h16V9"/><path d="M8 19v-6M12 19v-6M16 19v-6"/></svg>',
  streaming:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5z" fill="currentColor"/><path d="M8 21h8"/></svg>',
  other:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><circle cx="12" cy="16.5" r=".6" fill="currentColor"/></svg>',
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  eyeOpen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.5 7-10 7c-1.6 0-3-.4-4.3-1"/><path d="M9.5 9.5a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>'
};
const CATS = [
  { id:"email", label:"Correos" }, { id:"social", label:"Redes" },
  { id:"bank", label:"Bancos" }, { id:"streaming", label:"Streaming" }, { id:"other", label:"Otros" }
];
const CAT_LABEL = Object.fromEntries(CATS.map(c=>[c.id,c.label]));
const $ = s => document.querySelector(s);
const esc = s => (s||"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ===================== toast ===================== */
function toast(msg, type="ok"){
  const ic = type==="ok"?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
    : type==="err"?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>';
  const el = document.createElement("div");
  el.className = "toast "+type; el.innerHTML = ic+"<span>"+esc(msg)+"</span>";
  $("#toasts").appendChild(el);
  setTimeout(()=>{ el.classList.add("out"); setTimeout(()=>el.remove(),300); }, 2600);
}
let clipTimer=null;
async function copy(text, sensitive){
  let done=false;
  try{ await navigator.clipboard.writeText(text); done=true; }
  catch(e){
    try{ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); done=true; }
    catch(_){ done=false; }
  }
  if(!done){ toast("No se pudo copiar","err"); return; }
  if(sensitive){
    toast("Copiado · se borra en 30s");
    clearTimeout(clipTimer);
    clipTimer = setTimeout(async ()=>{ try{ await navigator.clipboard.writeText(""); }catch(_){} }, 30000);
  }else{
    toast("Copiado al portapapeles");
  }
}

/* ===================== password strength ===================== */
function strength(pw){
  let s=0;
  if(pw.length>=8)s++; if(pw.length>=12)s++; if(pw.length>=16)s++;
  if(/[a-z]/.test(pw)&&/[A-Z]/.test(pw))s++;
  if(/\d/.test(pw))s++; if(/[^A-Za-z0-9]/.test(pw))s++;
  return Math.min(s,5);
}
function paintMeter(pw){
  const s = strength(pw);
  const pct = [0,18,38,58,80,100][s];
  const cols = ['#ff5575','#ff5575','#e9b84c','#e9b84c','#a78bfa','#52e0a8'];
  const lbls = ['—','Muy débil','Débil','Aceptable','Fuerte','Excelente'];
  $("#setupMeter").style.width = pct+"%";
  $("#setupMeter").style.background = cols[s];
  $("#setupMeterLabel").textContent = "Fuerza: "+lbls[pw?s:0];
}

/* ===================== gate flow ===================== */
function showGatePanel(id){
  ["setupPanel","unlockPanel","lockoutPanel"].forEach(p=>$("#"+p).classList.add("hidden"));
  $("#"+id).classList.remove("hidden");
}
function initGate(){
  $("#gate").classList.remove("hidden");
  $("#app").style.display="none";
  const lockUntil = +Store.get(K.lock)||0;
  if(Date.now() < lockUntil){ startLockout(lockUntil); return; }
  if(Store.get(K.vault)){ showGatePanel("unlockPanel"); setTimeout(()=>$("#unlockPw").focus(),300); refreshAttempts(); }
  else { showGatePanel("setupPanel"); setTimeout(()=>$("#setupPw").focus(),300); }
}
function refreshAttempts(){
  const fails = +Store.get(K.fails)||0;
  if(fails>0){ $("#attemptsHint").classList.remove("hidden"); $("#attemptsLeft").textContent = Math.max(0,MAX_ATTEMPTS-fails); }
  else $("#attemptsHint").classList.add("hidden");
}
let lockoutTimer=null;
function startLockout(until){
  showGatePanel("lockoutPanel");
  $("#lockoutReadyBtn").classList.add("hidden");
  const countEl = $("#lockoutCount");
  countEl.style.color = ""; countEl.style.textShadow = "";
  $("#lockoutTitle").textContent = "Acceso bloqueado";
  $("#lockoutSub").textContent = "Demasiados intentos fallidos. Espera a que el contador llegue a cero para volver a intentar.";
  $("#lockoutBadge").style.background = ""; $("#lockoutBadge").style.borderColor = ""; $("#lockoutBadge").style.color = "";
  $("#lockoutCountLabel").textContent = "Bloqueo temporal de seguridad";
  clearInterval(lockoutTimer);
  const tick = ()=>{
    const left = until - Date.now();
    if(left<=0){
      clearInterval(lockoutTimer); Store.del(K.lock); Store.del(K.fails);
      countEl.textContent = "00:00";
      countEl.style.color = "var(--ok)";
      countEl.style.textShadow = "0 0 28px rgba(82,224,168,.6)";
      $("#lockoutTitle").textContent = "¡Bloqueo levantado!";
      $("#lockoutSub").textContent = "Ya puedes volver a iniciar sesión.";
      $("#lockoutBadge").style.background = "rgba(82,224,168,.12)";
      $("#lockoutBadge").style.borderColor = "rgba(82,224,168,.3)";
      $("#lockoutBadge").style.color = "var(--ok)";
      $("#lockoutCountLabel").textContent = "Tiempo de espera completado";
      $("#lockoutReadyBtn").classList.remove("hidden");
      return;
    }
    const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
    countEl.textContent = String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  };
  tick(); lockoutTimer = setInterval(tick,1000);
}
$("#lockoutReadyBtn").addEventListener("click", initGate);

/* ===== setup ===== */
$("#setupPw").addEventListener("input", e=>paintMeter(e.target.value));
$("#setupBtn").addEventListener("click", async ()=>{
  const pw = $("#setupPw").value, pw2 = $("#setupPw2").value;
  const msg = $("#setupMsg"); msg.className="gate-msg";
  if(pw.length<8){ msg.classList.add("err"); msg.textContent="Mínimo 8 caracteres (mejor 12 o más)."; return; }
  if(pw!==pw2){ msg.classList.add("err"); msg.textContent="Las contraseñas no coinciden."; return; }
  const btn=$("#setupBtn"); btn.disabled=true; btn.textContent="Cifrando…";
  try{
    const salt = crypto.getRandomValues(new Uint8Array(16));
    cryptoKey = await deriveKey(pw, salt);
    entries = [];
    Store.set(K.salt, b64.to(salt));
    Store.set(K.vault, await encryptVault(cryptoKey, entries));
    Store.del(K.fails); Store.del(K.lock);
    msg.classList.add("ok"); msg.textContent="¡Bóveda creada!";
    setTimeout(openApp, 450);
  }catch(e){ msg.classList.add("err"); msg.textContent="Error al crear la bóveda."; btn.disabled=false; btn.textContent="Crear bóveda"; }
});

/* ===== unlock ===== */
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function unlockBtnLoading(btn){
  btn.classList.remove("success"); btn.classList.add("loading"); btn.disabled=true;
  btn.innerHTML = '<span class="spinner"></span><span>Verificando…</span>';
}
function unlockBtnSuccess(btn){
  btn.classList.remove("loading"); btn.classList.add("success"); btn.disabled=true;
  btn.innerHTML = '<svg class="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>Acceso concedido</span>';
}
function unlockBtnReset(btn){
  btn.classList.remove("loading","success"); btn.disabled=false; btn.textContent="Desbloquear";
}
async function attemptUnlock(){
  const btn=$("#unlockBtn");
  if(btn.dataset.busy) return;
  const pw = $("#unlockPw").value;
  const msg = $("#unlockMsg"); msg.className="gate-msg";
  if(!pw){ msg.classList.add("err"); msg.textContent="Ingresa tu contraseña."; return; }
  btn.dataset.busy="1";
  unlockBtnLoading(btn);
  msg.className="gate-msg"; msg.textContent="Verificando cifrado…";
  $("#attemptsHint").classList.add("hidden");
  $("#unlockPw").blur();

  const start = Date.now();
  let decrypted=null, keyRef=null, ok=false;
  try{
    const salt = b64.from(Store.get(K.salt));
    keyRef = await deriveKey(pw, salt);
    decrypted = await decryptVault(keyRef, Store.get(K.vault));  // lanza error si la clave es incorrecta
    ok = true;
  }catch(e){ ok=false; }

  // verificación deliberada de ~5s (también frena ataques de fuerza bruta)
  await sleep(Math.max(0, 5000 - (Date.now()-start)));

  if(ok){
    entries = decrypted; cryptoKey = keyRef;
    Store.del(K.fails);
    msg.textContent="";
    unlockBtnSuccess(btn);
    await sleep(750);
    btn.dataset.busy="";
    openApp();
  }else{
    unlockBtnReset(btn);
    btn.dataset.busy="";
    $("#unlockPw").value="";
    const fails = (+Store.get(K.fails)||0)+1;
    Store.set(K.fails, fails);
    if(fails>=MAX_ATTEMPTS){
      const until = Date.now()+LOCK_MS;
      Store.set(K.lock, until);
      startLockout(until);
    }else{
      msg.className="gate-msg err"; msg.textContent="Contraseña incorrecta.";
      refreshAttempts();
      $("#unlockPw").focus();
    }
  }
}
$("#unlockBtn").addEventListener("click", attemptUnlock);
$("#unlockPw").addEventListener("keydown", e=>{ if(e.key==="Enter") attemptUnlock(); });
$("#setupPw2").addEventListener("keydown", e=>{ if(e.key==="Enter") $("#setupBtn").click(); });

/* eye toggles */
document.addEventListener("click", e=>{
  const b = e.target.closest(".eye[data-eye]");
  if(!b) return;
  const inp = $("#"+b.dataset.eye);
  const open = inp.type==="password";
  inp.type = open?"text":"password";
  b.innerHTML = open?ICON.eyeOff:ICON.eyeOpen;
});
document.querySelectorAll(".eye[data-eye]").forEach(b=>b.innerHTML=ICON.eyeOpen);

/* ===================== app ===================== */
function openApp(){
  $("#gate").classList.add("hidden");
  $("#app").style.display="flex";
  buildChips();
  initSortBar();
  applyTheme(currentTheme);
  applyView(viewMode);
  render();
  resetIdle();
  if(!Store.persistent){
    setTimeout(()=>toast("Vista previa: aquí los datos no se guardan al recargar. En GitHub Pages o local sí.","info"),700);
  }
}
function lock(){
  cryptoKey=null; entries=[];
  clearTimeout(idleTimer);
  $("#unlockPw").value=""; $("#unlockMsg").textContent="";
  unlockBtnReset($("#unlockBtn")); delete $("#unlockBtn").dataset.busy;
  $("#menuPop")?.remove();
  initGate();
}
async function persist(){
  if(!cryptoKey) return;
  try{ Store.set(K.vault, await encryptVault(cryptoKey, entries)); }
  catch(e){ toast("Error al guardar","err"); }
}

function buildChips(){
  const all=entries.length, favN=entries.filter(e=>e.favorite).length;
  let html=`<button class="chip ${activeFilter==="all"?"active":""}" data-f="all">Todas <span class="n">${all}</span></button>`;
  if(favN>0) html+=`<button class="chip fav-chip ${activeFilter==="fav"?"active":""}" data-f="fav">★ Favoritas <span class="n">${favN}</span></button>`;
  CATS.forEach(c=>{
    const n=entries.filter(e=>e.category===c.id).length;
    html+=`<button class="chip ${activeFilter===c.id?"active":""}" data-f="${c.id}">${ICON[c.id]} ${c.label} <span class="n">${n}</span></button>`;
  });
  $("#chips").innerHTML=html;
  $("#chips").querySelectorAll(".chip").forEach(ch=>ch.onclick=()=>{ activeFilter=ch.dataset.f; buildChips(); render(); });
}

function expiryInfo(date){
  if(!date) return null;
  const diff = new Date(date+"T23:59:00") - new Date();
  const days = Math.ceil(diff/(1000*60*60*24));
  if(days<0) return {label:`Venció hace ${Math.abs(days)}d`,cls:"exp-red"};
  if(days===0) return {label:"Vence hoy",cls:"exp-red"};
  if(days<=7) return {label:`Vence en ${days}d`,cls:"exp-red"};
  if(days<=30) return {label:`Vence en ${days}d`,cls:"exp-yellow"};
  return {label:new Date(date).toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"}),cls:"exp-ok"};
}
function sortedList(list){
  const fav=(a,b)=>(b.favorite?1:0)-(a.favorite?1:0);
  if(activeSort==="az") return list.sort((a,b)=>fav(a,b)||a.title.localeCompare(b.title,"es"));
  if(activeSort==="cat") return list.sort((a,b)=>fav(a,b)||a.category.localeCompare(b.category));
  return list.sort((a,b)=>fav(a,b)||(b.updatedAt||0)-(a.updatedAt||0));
}
const FAV_SVG = (on)=>`<svg viewBox="0 0 24 24" fill="${on?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

function render(){
  const q = $("#searchInput").value.trim().toLowerCase();
  let list = entries.slice();
  if(activeFilter==="fav") list=list.filter(e=>e.favorite);
  else if(activeFilter!=="all") list=list.filter(e=>e.category===activeFilter);
  if(q) list=list.filter(e=>(e.title+" "+e.username+" "+e.url+" "+e.notes+" "+CAT_LABEL[e.category]).toLowerCase().includes(q));
  list=sortedList(list);

  const grid=$("#grid"), empty=$("#empty");
  const cnt=$("#vaultCount"); if(cnt) cnt.textContent=entries.length?`${entries.length} cuenta${entries.length!==1?"s":""}` : "";
  grid.className = viewMode==="list" ? "list-view" : "grid";

  if(entries.length===0){ grid.innerHTML=""; empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");
  if(list.length===0){ grid.innerHTML=`<div class="empty" style="${viewMode==="list"?"":"grid-column:1/-1"}padding:50px 20px"><h3>Sin resultados</h3><p>No hay cuentas que coincidan.</p></div>`; return; }

  if(viewMode==="list"){
    grid.innerHTML=list.map((e,i)=>{
      const exp=expiryInfo(e.expiresAt);
      const pwDots="•".repeat(Math.min(12,Math.max(8,(e.password||"").length||10)));
      return `<div class="list-card" data-cat="${e.category}" style="animation-delay:${i*30}ms">
        <button class="fav-btn${e.favorite?" active":""}" data-fav="${e.id}" title="${e.favorite?"Quitar favorito":"Favorito"}">${FAV_SVG(e.favorite)}</button>
        <div class="cat-ico ${e.category}" style="width:36px;height:36px;border-radius:10px;flex-shrink:0">${ICON[e.category]}</div>
        <div class="list-info">
          <span class="list-title">${esc(e.title)}</span>
          <span class="list-sub">${CAT_LABEL[e.category]}${e.username?" · "+esc(e.username):""}${exp?` · <span class="${exp.cls}">${exp.label}</span>`:""}</span>
        </div>
        <div class="list-actions">
          ${e.password?`<span class="list-pw-dots" data-pw="${esc(e.password)}">${pwDots}</span><button class="mini" data-reveal title="Ver">${ICON.eyeOpen}</button><button class="mini" data-copy="${esc(e.password)}" data-sensitive="1" title="Copiar clave">${ICON.copy}</button>`:""}
          <button class="mini" data-edit="${e.id}" title="Editar">${ICON.edit}</button>
          <button class="mini" data-del="${e.id}" title="Borrar" style="color:var(--danger-soft)">${ICON.trash}</button>
        </div>
      </div>`;
    }).join("");
  } else {
    grid.innerHTML=list.map((e,i)=>{
      const pwDots="•".repeat(Math.min(12,Math.max(8,(e.password||"").length||10)));
      const exp=expiryInfo(e.expiresAt);
      return `<div class="card" data-cat="${e.category}" style="animation-delay:${i*40}ms">
        <div class="card-head">
          <div class="cat-ico ${e.category}">${ICON[e.category]}</div>
          <div class="t"><h3>${esc(e.title)}</h3><span class="badge">${CAT_LABEL[e.category]}</span></div>
          <button class="fav-btn${e.favorite?" active":""}" data-fav="${e.id}" title="${e.favorite?"Quitar favorito":"Favorito"}">${FAV_SVG(e.favorite)}</button>
        </div>
        ${e.username?`<div class="row"><span class="rk">Usuario</span><span class="rv dbl-copy" data-val="${esc(e.username)}">${esc(e.username)}</span><button class="mini" data-copy="${esc(e.username)}" title="Copiar">${ICON.copy}</button></div>`:""}
        ${e.password?`<div class="row"><span class="rk">Clave</span><span class="rv dots" data-pw="${esc(e.password)}">${pwDots}</span><button class="mini" data-reveal title="Ver">${ICON.eyeOpen}</button><button class="mini" data-copy="${esc(e.password)}" data-sensitive="1" title="Copiar">${ICON.copy}</button></div>`:""}
        ${e.url?`<div class="row"><span class="rk">Enlace</span><span class="rv"><a href="${/^https?:\/\//.test(e.url)?esc(e.url):"https://"+esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a></span><button class="mini" data-copy="${esc(e.url)}" title="Copiar">${ICON.copy}</button></div>`:""}
        ${exp?`<div class="row"><span class="rk">Vence</span><span class="rv ${exp.cls}">${exp.label}</span></div>`:""}
        ${e.notes?`<div class="notes-row">${esc(e.notes)}</div>`:""}
        <div class="card-foot">
          <button class="edit" data-edit="${e.id}">${ICON.edit} Editar</button>
          <button class="del" data-del="${e.id}">${ICON.trash} Borrar</button>
        </div>
      </div>`;
    }).join("");
  }

  grid.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>copy(b.dataset.copy,b.dataset.sensitive==="1"));
  grid.querySelectorAll("[data-reveal]").forEach(b=>b.onclick=()=>{
    const span=b.parentElement.querySelector("[data-pw]");
    if(span.dataset.shown){span.textContent="•".repeat(Math.min(12,Math.max(8,span.dataset.pw.length)));delete span.dataset.shown;span.classList.add("dots");b.innerHTML=ICON.eyeOpen;}
    else{span.textContent=span.dataset.pw;span.dataset.shown="1";span.classList.remove("dots");b.innerHTML=ICON.eyeOff;}
  });
  grid.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openModal(b.dataset.edit));
  grid.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>confirmDelete(b.dataset.del));
  grid.querySelectorAll("[data-fav]").forEach(b=>b.onclick=async ev=>{
    ev.stopPropagation();
    const idx=entries.findIndex(x=>x.id===b.dataset.fav);
    if(idx>-1){entries[idx].favorite=!entries[idx].favorite;await persist();buildChips();render();}
  });
  grid.querySelectorAll(".dbl-copy").forEach(span=>{
    span.title="Doble clic para copiar";
    span.ondblclick=()=>copy(span.dataset.val,false);
    span.style.cursor="pointer";
  });
}

/* ===================== modal (add/edit) ===================== */
function openModal(id){
  editingId = id||null;
  const e = id ? entries.find(x=>x.id===id) : null;
  pickedCat = e?e.category:(activeFilter!=="all"?activeFilter:"email");
  const ov = document.createElement("div");
  ov.className="overlay"; ov.id="modalOverlay";
  ov.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h2>${id?"Editar cuenta":"Nueva cuenta"}</h2>
        <button class="x" id="modalClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Categoría</label><div class="cat-pick" id="catPick"></div></div>
        <div class="field"><label>Nombre / Título *</label><input id="fTitle" class="inp" placeholder="Ej: Gmail personal, Bancolombia…" value="${e?esc(e.title):""}"></div>
        <div class="field"><label>Usuario / Correo / Teléfono</label><input id="fUser" class="inp" placeholder="correo@ejemplo.com  ·  +57…" value="${e?esc(e.username):""}"></div>
        <div class="field"><label>Contraseña / PIN</label>
          <div class="inp-wrap">
            <input id="fPass" class="inp pw" type="password" placeholder="••••••••" value="${e?esc(e.password):""}">
            <button class="eye" data-eye="fPass" type="button">${ICON.eyeOpen}</button>
          </div>
          <div class="gen-row">
            <button id="genBtn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg> Generar segura</button>
            <button id="copyPassBtn" type="button">${ICON.copy} Copiar</button>
          </div>
        </div>
        <div class="field"><label>Enlace / Sitio (opcional)</label><input id="fUrl" class="inp" placeholder="facebook.com" value="${e?esc(e.url):""}"></div>
        <div class="field"><label>Notas (N° de cuenta, recuperación…)</label><textarea id="fNotes" class="inp" placeholder="Información extra, segura y privada">${e?esc(e.notes):""}</textarea></div>
        <div class="field"><label>Fecha de vencimiento (opcional)</label><input id="fExpiry" class="inp" type="date" value="${e&&e.expiresAt?e.expiresAt:""}"></div>
        ${id&&e&&e.passwordHistory&&e.passwordHistory.length?`<div class="field"><label>Historial de contraseñas</label><div class="pw-history">${e.passwordHistory.map(p=>`<div class="pw-hist-row"><span class="rv dots" style="flex:1;font-size:13px">${"•".repeat(Math.min(12,p.length))}</span><button class="mini hist-restore" data-pw="${esc(p)}" title="Restaurar">${ICON.edit}</button></div>`).join("")}</div></div>`:""}
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
        <button class="btn btn-primary" id="modalSave">${id?"Guardar cambios":"Guardar cuenta"}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const cp = $("#catPick");
  cp.innerHTML = CATS.map(c=>`<button class="cat-opt ${c.id===pickedCat?'sel':''}" data-cat="${c.id}">${ICON[c.id]}<span>${c.label}</span></button>`).join("");
  cp.querySelectorAll(".cat-opt").forEach(b=>b.onclick=()=>{ pickedCat=b.dataset.cat; cp.querySelectorAll(".cat-opt").forEach(x=>x.classList.toggle("sel",x===b)); });

  document.querySelectorAll(".hist-restore").forEach(b=>b.onclick=()=>{ $("#fPass").value=b.dataset.pw; $("#fPass").type="text"; $("#fPass").parentElement.querySelector(".eye").innerHTML=ICON.eyeOff; toast("Contraseña restaurada del historial","info"); });
  $("#genBtn").onclick = ()=>{ const p=genPassword(18); $("#fPass").value=p; $("#fPass").type="text"; $("#fPass").parentElement.querySelector(".eye").innerHTML=ICON.eyeOff; toast("Contraseña generada"); };
  $("#copyPassBtn").onclick = ()=>{ const v=$("#fPass").value; v?copy(v,true):toast("Campo vacío","err"); };
  const close = ()=>ov.remove();
  $("#modalClose").onclick=close; $("#modalCancel").onclick=close;
  $("#modalSave").onclick = saveEntry;
  setTimeout(()=>$("#fTitle").focus(),100);
}
function genPassword(len){
  const sets=["abcdefghijkmnpqrstuvwxyz","ABCDEFGHJKLMNPQRSTUVWXYZ","23456789","!@#$%&*?-_+="];
  const all=sets.join(""); let out="";
  sets.forEach(s=>out+=s[crypto.getRandomValues(new Uint32Array(1))[0]%s.length]);
  for(let i=out.length;i<len;i++) out+=all[crypto.getRandomValues(new Uint32Array(1))[0]%all.length];
  return out.split("").sort(()=>crypto.getRandomValues(new Uint32Array(1))[0]-2147483648).join("");
}
async function saveEntry(){
  const title=$("#fTitle").value.trim();
  if(!title){ toast("El nombre es obligatorio","err"); $("#fTitle").focus(); return; }
  const data={
    category:pickedCat, title,
    username:$("#fUser").value.trim(), password:$("#fPass").value,
    url:$("#fUrl").value.trim(), notes:$("#fNotes").value.trim(),
    expiresAt:$("#fExpiry").value||"",
    updatedAt:Date.now()
  };
  if(editingId){
    const i=entries.findIndex(x=>x.id===editingId);
    if(i>-1){
      const old=entries[i];
      const hist=[...(old.passwordHistory||[])];
      if(data.password && data.password!==old.password && old.password) hist.unshift(old.password);
      data.passwordHistory=hist.slice(0,3);
      data.favorite=old.favorite||false;
      entries[i]={...old,...data};
    }
  } else {
    data.id="e_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    data.passwordHistory=[]; data.favorite=false;
    entries.push(data);
  }
  await persist();
  $("#modalOverlay")?.remove();
  buildChips(); render();
  toast(editingId?"Cambios guardados":"Cuenta guardada");
  editingId=null;
}

/* ===== delete confirm ===== */
function confirmDelete(id){
  const e=entries.find(x=>x.id===id); if(!e) return;
  const ov=document.createElement("div"); ov.className="overlay"; ov.id="confirmOverlay";
  ov.innerHTML=`
    <div class="modal" style="max-width:400px">
      <div class="modal-body" style="text-align:center;padding-top:30px">
        <div style="width:62px;height:62px;border-radius:18px;margin:0 auto 18px;display:grid;place-items:center;background:rgba(255,85,117,.12);color:var(--danger)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
        </div>
        <h2 style="font-family:'Syne',sans-serif;font-size:19px;margin-bottom:8px">¿Borrar esta cuenta?</h2>
        <p style="color:var(--txt-dim);font-size:14px;line-height:1.5">Vas a eliminar <b style="color:var(--txt)">${esc(e.title)}</b>. Esta acción no se puede deshacer.</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="cDelCancel">Cancelar</button>
        <button class="btn btn-danger" id="cDelOk">Sí, borrar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.querySelector("#cDelCancel").onclick=close;
  ov.addEventListener("click",ev=>{ if(ev.target===ov) close(); });
  ov.querySelector("#cDelOk").onclick=async ()=>{ entries=entries.filter(x=>x.id!==id); await persist(); close(); buildChips(); render(); toast("Cuenta eliminada"); };
}

/* ===== menu (export / import / change pw) ===== */
$("#menuBtn").onclick = (ev)=>{
  ev.stopPropagation();
  if($("#menuPop")){ $("#menuPop").remove(); return; }
  const pop=document.createElement("div"); pop.className="menu-pop"; pop.id="menuPop";
  pop.innerHTML=`
    <button id="mExport"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg> Exportar respaldo</button>
    <button id="mImport"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M8 13l4-4 4 4M5 3h14"/></svg> Importar respaldo</button>
    <hr>
    <button id="mChange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/></svg> Cambiar contraseña</button>
    <hr>
    <button class="danger" id="mLock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg> Bloquear bóveda</button>`;
  $("#app").appendChild(pop);
  $("#mLock").onclick=lock;
  $("#mExport").onclick=exportVault;
  $("#mImport").onclick=importVault;
  $("#mChange").onclick=changePassword;
};
document.addEventListener("click", e=>{ if($("#menuPop") && !e.target.closest("#menuPop") && !e.target.closest("#menuBtn")) $("#menuPop").remove(); });

function showPinModal(title, subtitle, onSuccess){
  const ov=document.createElement("div"); ov.className="overlay"; ov.id="pinOverlay";
  ov.innerHTML=`
    <div class="modal" style="max-width:400px">
      <div class="modal-head">
        <h2>${title}</h2>
        <button class="x" id="pinClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--txt-dim);margin-bottom:18px;line-height:1.5">${subtitle}</p>
        <div class="field">
          <label>Contraseña de respaldo</label>
          <div class="inp-wrap">
            <input id="pinInput" class="inp pw" type="password" placeholder="••••••••••••" autocomplete="off">
            <button class="eye" data-eye="pinInput" type="button">${ICON.eyeOpen}</button>
          </div>
          <div id="pinMsg" style="font-size:13px;margin-top:10px;color:var(--danger-soft);min-height:18px"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="pinCancel">Cancelar</button>
        <button class="btn btn-primary" id="pinOk">Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  $("#pinClose").onclick=close; $("#pinCancel").onclick=close;
  setTimeout(()=>$("#pinInput").focus(),100);
  const confirm=async()=>{
    const val=$("#pinInput").value;
    if(!val){ $("#pinMsg").textContent="Ingresa la contraseña."; return; }
    const ok=await _vp(val);
    if(!ok){ $("#pinMsg").textContent="Contraseña incorrecta."; $("#pinInput").value=""; $("#pinInput").focus(); return; }
    close(); onSuccess();
  };
  $("#pinOk").onclick=confirm;
  $("#pinInput").addEventListener("keydown",e=>{ if(e.key==="Enter") confirm(); });
}

async function exportVault(){
  $("#menuPop")?.remove();
  showPinModal(
    "Exportar respaldo",
    "Ingresa la contraseña de respaldo para autorizar la descarga.",
    async ()=>{
      const payload = { v:1, salt:Store.get(K.salt), vault:Store.get(K.vault), exportedAt:new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
      a.download="jampierdev-respaldo-"+new Date().toISOString().slice(0,10)+".json"; a.click();
      URL.revokeObjectURL(a.href);
      toast("Respaldo cifrado descargado");
    }
  );
}
function importVault(){
  $("#menuPop")?.remove();
  showPinModal(
    "Importar respaldo",
    "Ingresa la contraseña de respaldo para autorizar la importación.",
    ()=>{
      const inp=document.createElement("input"); inp.type="file"; inp.accept="application/json,.json";
      inp.onchange=async ()=>{
        const file=inp.files[0]; if(!file) return;
        try{
          const data=JSON.parse(await file.text());
          if(!data.salt||!data.vault) throw 0;
          const ok = await new Promise(res=>{
            const ov=document.createElement("div"); ov.className="overlay";
            ov.innerHTML=`<div class="modal" style="max-width:420px"><div class="modal-body"><h2 style="font-family:'Syne',sans-serif;font-size:19px;margin-bottom:10px">Importar respaldo</h2><p style="color:var(--txt-dim);font-size:14px;line-height:1.5;margin-bottom:18px">Esto reemplazará tu bóveda actual por la del archivo. Necesitarás la contraseña maestra de ESE respaldo para abrirlo.</p></div><div class="modal-foot"><button class="btn btn-ghost" id="iC">Cancelar</button><button class="btn btn-primary" id="iO">Reemplazar</button></div></div>`;
            document.body.appendChild(ov);
            ov.querySelector("#iC").onclick=()=>{ov.remove();res(false)};
            ov.querySelector("#iO").onclick=()=>{ov.remove();res(true)};
          });
          if(!ok) return;
          Store.set(K.salt, data.salt); Store.set(K.vault, data.vault);
          Store.del(K.fails); Store.del(K.lock);
          toast("Respaldo importado. Desbloquea con su contraseña.","info");
          lock();
        }catch(e){ toast("Archivo inválido","err"); }
      };
      inp.click();
    }
  );
}
function changePassword(){
  $("#menuPop")?.remove();
  const ov=document.createElement("div"); ov.className="overlay";
  ov.innerHTML=`
    <div class="modal" style="max-width:440px">
      <div class="modal-head"><h2>Cambiar contraseña</h2><button class="x" id="cpX"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="modal-body">
        <div class="field"><label>Nueva contraseña maestra</label><div class="inp-wrap"><input id="cpNew" class="inp pw" type="password" placeholder="••••••••••••"><button class="eye" data-eye="cpNew" type="button">${ICON.eyeOpen}</button></div></div>
        <div class="field"><label>Repite la nueva contraseña</label><div class="inp-wrap"><input id="cpNew2" class="inp pw" type="password" placeholder="••••••••••••"><button class="eye" data-eye="cpNew2" type="button">${ICON.eyeOpen}</button></div></div>
        <p style="font-size:12px;color:var(--txt-faint);line-height:1.5">Se volverá a cifrar toda tu bóveda con la nueva llave.</p>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" id="cpCancel">Cancelar</button><button class="btn btn-primary" id="cpSave">Cambiar</button></div>
    </div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.querySelector("#cpX").onclick=close; ov.querySelector("#cpCancel").onclick=close;
  ov.querySelector("#cpSave").onclick=async ()=>{
    const a=$("#cpNew").value, b=$("#cpNew2").value;
    if(a.length<8){ toast("Mínimo 8 caracteres","err"); return; }
    if(a!==b){ toast("No coinciden","err"); return; }
    const salt=crypto.getRandomValues(new Uint8Array(16));
    cryptoKey=await deriveKey(a,salt);
    Store.set(K.salt,b64.to(salt));
    await persist();
    close(); toast("Contraseña actualizada");
  };
}

/* ===== theme ===== */
const ICON_SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
const ICON_MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
function applyTheme(t){
  document.documentElement.setAttribute("data-theme",t);
  Store.set("nox_theme",t); currentTheme=t;
  const btn=$("#themeBtn"); if(btn) btn.innerHTML=t==="dark"?ICON_SUN:ICON_MOON;
}
function toggleTheme(){ applyTheme(currentTheme==="dark"?"light":"dark"); }

/* ===== view (grid / list) ===== */
const ICON_GRID_V='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
const ICON_LIST_V='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>';
function applyView(v){
  viewMode=v; Store.set("nox_view",v);
  const btn=$("#viewBtn"); if(btn) btn.innerHTML=v==="grid"?ICON_LIST_V:ICON_GRID_V;
  render();
}
function toggleView(){ applyView(viewMode==="grid"?"list":"grid"); }

/* ===== fullscreen ===== */
const ICON_FS_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
const ICON_FS_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
function toggleFullscreen(){
  if(!document.fullscreenElement) document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();
  else document.exitFullscreen&&document.exitFullscreen();
}
document.addEventListener("fullscreenchange",()=>{
  const btn=$("#fullscreenBtn"); if(btn) btn.innerHTML=document.fullscreenElement?ICON_FS_OFF:ICON_FS_ON;
});

/* ===== sort bar ===== */
function initSortBar(){
  const bar=$("#sortBar"); if(!bar) return;
  bar.querySelectorAll(".sort-btn").forEach(b=>{
    b.classList.toggle("active",b.dataset.sort===activeSort);
    b.onclick=()=>{ activeSort=b.dataset.sort; initSortBar(); render(); };
  });
}

/* ===== add buttons + idle autolock ===== */
["addBtnTop","addBtnEmpty","fab"].forEach(id=>{ const el=$("#"+id); if(el) el.onclick=()=>openModal(null); });
$("#lockBtn").onclick=lock;
$("#searchInput").addEventListener("input", render);
function showIdleModal(){
  const ov = document.createElement("div"); ov.className="overlay"; ov.id="idleOverlay";
  ov.innerHTML=`
    <div class="modal" style="max-width:380px">
      <div class="modal-body" style="text-align:center;padding:38px 28px 10px">
        <div class="idle-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/></svg>
        </div>
        <h2 style="font-family:'Syne',sans-serif;font-size:21px;margin:18px 0 10px">Sesión cerrada</h2>
        <p style="color:var(--txt-dim);font-size:14px;line-height:1.7;margin-bottom:0">Tu bóveda se bloqueó automáticamente<br>por <b style="color:var(--txt)">5 minutos sin actividad</b>.<br>Vuelve a iniciar sesión para acceder.</p>
      </div>
      <div class="modal-foot" style="padding-top:24px">
        <button class="btn btn-primary" id="idleBtn">Iniciar sesión</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById("idleBtn").onclick = ()=>ov.remove();
}
function resetIdle(){ clearTimeout(idleTimer); idleTimer=setTimeout(()=>{ if(cryptoKey){ lock(); showIdleModal(); } }, IDLE_MS); }
["click","keydown","mousemove","touchstart"].forEach(ev=>document.addEventListener(ev,()=>{ if(cryptoKey) resetIdle(); }, {passive:true}));
document.addEventListener("keydown", e=>{ if(e.key==="Escape") $(".overlay")?.remove(); });

$("#themeBtn").addEventListener("click", toggleTheme);
$("#viewBtn").addEventListener("click", toggleView);
$("#fullscreenBtn").addEventListener("click", toggleFullscreen);

/* ===================== go ===================== */
applyTheme(currentTheme);
initGate();
