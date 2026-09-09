/* =====================================================================
   RED DE LIBRERÍAS · Gestión de personal
   Operado por Libros del Fuego
   ===================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';
import { mensajes } from './mensajes.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const EMOJIS = ['👏','🔥','❤️','😂','📚','💪','🙌','😮'];

/* ---------------------------------------------------------------------
   Estado
   --------------------------------------------------------------------- */
const S = {
  yo: null,
  librerias: [],
  personas: [],          // todas, incluidas las inactivas: el feed las necesita
  libreriaVista: null,
  fecha: null,           // hoy en Bogotá
  fechaVista: null,      // el día que se está mirando
  rango: [null, null],
  turnos: [],            // del rango completo, de la librería vista
  jornadas: [],          // del día visto
  miJornada: null,
  dia: null,
  avisos: [],
  feed: [],
  reacciones: [],
  vista: 'inicio',
  error: null
};

/* ---------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------- */
const DOW = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DOW3 = ['dom','lun','mar','mié','jue','vie','sáb'];
const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
             'septiembre','octubre','noviembre','diciembre'];

const hoyISO = () => new Intl.DateTimeFormat('en-CA',{timeZone:CONFIG.TZ}).format(new Date());
const horaAhora = () => new Intl.DateTimeFormat('es-CO',{timeZone:CONFIG.TZ,
  hour:'numeric',minute:'2-digit',hour12:true}).format(new Date());
function minutosAhora(){
  const p = new Intl.DateTimeFormat('en-GB',{timeZone:CONFIG.TZ,hour:'2-digit',
    minute:'2-digit',hour12:false}).format(new Date()).split(':');
  return (+p[0])*60 + (+p[1]);
}
const dowDe = iso => new Date(iso+'T12:00:00Z').getUTCDay();
const diaNum = iso => new Date(iso+'T12:00:00Z').getUTCDate();
const fechaLarga = iso => { const d = new Date(iso+'T12:00:00Z');
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`; };
const fechaCorta = iso => { const d = new Date(iso+'T12:00:00Z');
  return `${d.getUTCDate()} ${MES[d.getUTCMonth()].slice(0,3)}`; };
const min = t => { if(!t) return null; const [h,m] = t.split(':'); return (+h)*60 + (+m); };
const hhmm = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.round(m)%60).padStart(2,'0');
const fmt = m => { if(m == null) return '—';
  const h = Math.floor(m/60), mm = m%60;
  return (h%12 || 12) + (mm ? ':'+String(mm).padStart(2,'0') : '') + (h >= 12 ? ' p.m.' : ' a.m.'); };
const fmtCorto = m => { const h = Math.floor(m/60), mm = m%60;
  return (h%12||12) + (mm ? ':'+String(mm).padStart(2,'0') : ''); };
const horaDe = ts => new Intl.DateTimeFormat('es-CO',{timeZone:CONFIG.TZ,
  hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(ts));
const diaDe = ts => new Intl.DateTimeFormat('en-CA',{timeZone:CONFIG.TZ}).format(new Date(ts));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pesos = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-CO');
const horas = n => (Math.round((n||0)*100)/100).toString().replace('.',',') + ' h';

function diaEvento(lib, iso){
  if(!lib?.modo_fiesta || !lib.evento_inicio || !iso) return null;
  const a = Date.parse(iso+'T00:00:00Z'), b = Date.parse(lib.evento_inicio+'T00:00:00Z');
  if(lib.evento_fin && a > Date.parse(lib.evento_fin+'T00:00:00Z')) return null;
  const n = Math.floor((a-b)/86400000) + 1;
  return n >= 1 ? n : null;
}
function faltanDias(lib, iso){
  if(!lib?.modo_fiesta || !lib.evento_inicio) return null;
  const n = Math.floor((Date.parse(lib.evento_inicio+'T00:00:00Z') -
                        Date.parse(iso+'T00:00:00Z'))/86400000);
  return n > 0 ? n : null;
}
function diasDe(desde, hasta){
  const out = []; let d = Date.parse(desde+'T00:00:00Z');
  const f = Date.parse(hasta+'T00:00:00Z');
  while(d <= f){ out.push(new Date(d).toISOString().slice(0,10)); d += 86400000; }
  return out;
}
const masDias = (iso, n) =>
  new Date(Date.parse(iso+'T00:00:00Z') + n*86400000).toISOString().slice(0,10);

function avatar(p, tam = 36, anillo = null){
  const ini = (p?.nombre_corto || p?.nombre || '?').trim()[0].toUpperCase();
  const src = p?.avatar ? `${CONFIG.IMG_BASE}${p.avatar}${CONFIG.IMG_EXT}?v=${p.avatar_v||1}` : null;
  const cuerpo = src
    ? `<img src="${esc(src)}" alt="" loading="lazy"
         onerror="this.replaceWith(Object.assign(document.createElement('span'),
                  {className:'ini',textContent:'${ini}'}))">`
    : `<span class="ini">${ini}</span>`;
  const av = `<span class="av av-${tam}">${cuerpo}</span>`;
  return anillo ? `<span class="av-ring ${anillo}">${av}</span>` : av;
}
const libDe = id => S.librerias.find(l => l.id === id);
const perDe = id => S.personas.find(p => p.id === id);
const equipoDe = id => S.personas.filter(p => p.libreria_id === id && p.activa);

function brindis(txt){
  document.querySelectorAll('.brindis').forEach(e => e.remove());
  const d = document.createElement('div');
  d.className = 'brindis'; d.textContent = txt;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}
function modal(html){
  const v = document.createElement('div');
  v.className = 'velo';
  v.innerHTML = `<div class="modal">${html}</div>`;
  v.addEventListener('click', e => { if(e.target === v) v.remove(); });
  document.body.appendChild(v);
  return v;
}
function criatura(w = 96, c1 = 'var(--cobalto)', c2 = 'var(--rosa)'){
  return `<svg class="criatura" width="${w}" height="${w*1.25}" viewBox="0 0 80 100"
    fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M40 8c-10 0-17 8-17 18 0 8 4 12 4 18 0 7-7 9-7 17 0 9 8 16 20 16s20-7 20-16
             c0-8-7-10-7-17 0-6 4-10 4-18 0-10-7-18-17-18z" fill="${c2}"/>
    <circle cx="33" cy="26" r="3" fill="${c1}"/><circle cx="47" cy="26" r="3" fill="${c1}"/>
    <circle cx="40" cy="40" r="5" stroke="${c1}" stroke-width="2"/>
    <circle cx="40" cy="49" r="5" stroke="${c1}" stroke-width="2"/>
    <path d="M25 78c-6 4-9 10-8 18M55 78c6 4 9 10 8 18M31 80c-3 6-3 12 0 18M49 80c3 6 3 12 0 18"
      stroke="${c1}" stroke-width="2" stroke-linecap="round"/>
    <path d="M40 8V2M32 10 24 4M48 10 56 4" stroke="${c1}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

/* =====================================================================
   CARGA DE DATOS
   Sin joins anidados: `publicaciones` y `jornadas` tienen dos llaves
   apuntando a `personas` (persona_id y retirada_por / aprobada_por), y
   PostgREST no sabe cuál usar, así que la consulta entera fallaba.
   Los nombres y fotos se resuelven con el listado que ya está en memoria.
   ===================================================================== */
async function cargarBase(){
  S.fecha = hoyISO();
  if(!S.fechaVista) S.fechaVista = S.fecha;

  const [libs, pers, avisos] = await Promise.all([
    sb.from('librerias').select('*').eq('activa', true).order('orden'),
    sb.from('personas').select('*').order('orden'),
    sb.from('avisos').select('*').order('fijado',{ascending:false})
      .order('creado_en',{ascending:false})
  ]);
  if(libs.error || pers.error) S.error = (libs.error || pers.error).message;
  S.librerias = libs.data || [];
  S.personas  = pers.data || [];
  S.avisos    = (avisos.data || []).filter(a => !a.vigente_hasta || a.vigente_hasta >= S.fecha);

  if(!S.libreriaVista) S.libreriaVista = S.yo?.libreria_id || S.librerias[0]?.id;
  calcularRango();
  await cargarLibreria();
}

/* Rango de la parrilla: el evento si el modo fiesta está encendido;
   si no, la semana en curso. */
function calcularRango(){
  const l = libDe(S.libreriaVista);
  if(l?.modo_fiesta && l.evento_inicio && l.evento_fin){
    S.rango = [l.evento_inicio, l.evento_fin];
  } else {
    const d = new Date(S.fechaVista+'T12:00:00Z');
    const lun = masDias(S.fechaVista, -((d.getUTCDay()+6)%7));
    S.rango = [lun, masDias(lun, 6)];
  }
  if(S.fechaVista < S.rango[0] || S.fechaVista > S.rango[1]){
    S.fechaVista = (S.fecha >= S.rango[0] && S.fecha <= S.rango[1]) ? S.fecha : S.rango[0];
  }
}

async function cargarLibreria(){
  const ids = S.personas.filter(p => p.libreria_id === S.libreriaVista).map(p => p.id);
  const vacio = Promise.resolve({data:[]});
  const [turnos, jornadas, dia] = await Promise.all([
    ids.length ? sb.from('turnos').select('*').in('persona_id', ids)
                   .gte('fecha', S.rango[0]).lte('fecha', S.rango[1]).order('fecha') : vacio,
    ids.length ? sb.from('jornadas').select('*').in('persona_id', ids)
                   .eq('fecha', S.fechaVista) : vacio,
    sb.from('dias_visible').select('*').eq('libreria_id', S.libreriaVista)
      .eq('fecha', S.fechaVista).maybeSingle()
  ]);
  S.turnos   = turnos.data || [];
  S.jornadas = jornadas.data || [];
  S.dia      = dia.data || null;

  if(S.yo){
    const r = await sb.from('jornadas').select('*')
      .eq('persona_id', S.yo.id).eq('fecha', S.fecha).maybeSingle();
    S.miJornada = r.data || null;
  }
}

async function cargarFeed(){
  const [pub, rea] = await Promise.all([
    sb.from('publicaciones').select('*').order('creada_en',{ascending:false}).limit(150),
    sb.from('reacciones').select('*')
  ]);
  if(pub.error){ S.error = 'No se pudo cargar el feed: ' + pub.error.message; S.feed = []; }
  else { S.error = null; S.feed = pub.data || []; }
  S.reacciones = rea.error ? [] : (rea.data || []);
}

const turnoDe = (personaId, fecha) =>
  S.turnos.find(t => t.persona_id === personaId && t.fecha === fecha) || null;
const jornadaDe = personaId => S.jornadas.find(j => j.persona_id === personaId) || null;

/* La jornada manda sobre la parrilla: quien ya saludó está en sala
   aunque ese día no tuviera turno asignado. */
function estadoDe(personaId){
  const j = jornadaDe(personaId), t = turnoDe(personaId, S.fechaVista);
  if(j?.cierre_en)   return {clave:'salio',    txt:'Cerró a las ' + horaDe(j.cierre_en)};
  if(j?.descanso_en) return {clave:'descanso', txt:'En descanso desde ' + horaDe(j.descanso_en)};
  if(j?.saludo_en)   return {clave:'sala',     txt:'Llegó a las ' + horaDe(j.saludo_en)};
  if(!t || t.tipo === 'libre' || !t.inicio) return {clave:'libre', txt:'Sin turno este día'};
  if(S.fechaVista !== S.fecha) return {clave:'tarde', txt:fmt(min(t.inicio))+' a '+fmt(min(t.fin))};
  if(minutosAhora() < min(t.inicio)) return {clave:'tarde', txt:'Entra a las ' + fmt(min(t.inicio))};
  return {clave:'tarde', txt:'Sin marcar el saludo'};
}
const enSala = id => ['sala','descanso'].includes(estadoDe(id).clave);

function cobertura(fecha){
  const l = libDe(S.libreriaVista);
  const ini = min(l?.apertura || '09:30'), fin = min(l?.cierre || '21:00');
  const out = [];
  for(let m = ini; m < fin; m += 30){
    let n = 0;
    for(const t of S.turnos){
      if(t.fecha !== fecha || !t.inicio || t.tipo === 'libre') continue;
      const a = min(t.inicio), b = min(t.fin);
      if(m < a || m >= b) continue;
      if(t.descanso_inicio){ const d = min(t.descanso_inicio);
        if(m >= d && m < d + t.descanso_min) continue; }
      n++;
    }
    out.push({m, n});
  }
  return out;
}
const minimoDe = fecha => {
  const l = libDe(S.libreriaVista), d = dowDe(fecha);
  return (d === 0 || d === 6) ? (l?.minimo_finde ?? 4) : (l?.minimo_semana ?? 3);
};
const horasTurno = t => (!t || !t.inicio) ? 0
  : (min(t.fin) - min(t.inicio) - (t.descanso_min||0))/60;

/* =====================================================================
   INGRESO
   ===================================================================== */
async function pintarIngreso(msg){
  document.getElementById('tabs').classList.add('oculto');
  document.getElementById('cabecera').classList.add('oculto');

  const [libs, gente] = await Promise.all([
    sb.from('librerias_login').select('*').order('orden'),
    sb.from('personas_login').select('*').order('orden')
  ]);
  const L = libs.data || [], G = gente.data || [];
  const hoy = hoyISO();
  const principal = L.find(l => l.modo_fiesta) || L[0];
  const dn = diaEvento(principal, hoy), faltan = faltanDias(principal, hoy);

  let h = `<div class="portada">${criatura(88)}
    <h2>Salón de Editoriales<br>Independientes</h2>`;
  if(dn)          h += `<div class="diagrande">${dn}</div><div class="lbl">día de la fiesta</div>`;
  else if(faltan) h += `<div class="diagrande">${faltan}</div>
                        <div class="lbl">${faltan===1?'día para empezar':'días para empezar'}</div>`;
  h += `<div class="fecha">${fechaLarga(hoy)} · ${horaAhora()}</div></div>`;

  if(!G.length){
    h += `<div class="bloque"><h3>Ingreso</h3>
      <p class="nota">Entra con tu correo y contraseña.</p>
      <label class="campo" for="ecorreo">Correo</label>
      <input type="email" id="ecorreo" autocomplete="username">
      <label class="campo" for="eclave">Contraseña</label>
      <input type="password" id="eclave" autocomplete="current-password">
      <div class="btn-fila"><button class="btn" id="entrarCorreo">Entrar</button></div>
      <div class="err" id="errIngreso">${msg ? esc(msg) : ''}</div></div>`;
  } else {
    for(const l of L){
      const suyos = G.filter(p => p.libreria_id === l.id);
      if(!suyos.length) continue;
      h += `<div class="grupo-lib"><span class="lbl" style="color:${esc(l.color)}">${esc(l.nombre)}</span>
        <div class="caras">` + suyos.map(p => `<button class="cara" data-correo="${esc(p.correo)}"
          data-nombre="${esc(p.nombre_corto)}">${avatar(p,44)}<b>${esc(p.nombre_corto)}</b></button>`).join('')
        + `</div></div>`;
    }
    if(msg) h += `<div class="err" style="margin-top:16px">${esc(msg)}</div>`;
  }
  document.getElementById('app').innerHTML = h;

  document.querySelectorAll('[data-correo]').forEach(b =>
    b.onclick = () => pedirClave(b.dataset.correo, b.dataset.nombre));
  const bc = document.getElementById('entrarCorreo');
  if(bc) bc.onclick = async () => {
    const r = await sb.auth.signInWithPassword({
      email: document.getElementById('ecorreo').value.trim().toLowerCase(),
      password: document.getElementById('eclave').value });
    if(r.error) document.getElementById('errIngreso').textContent = traducirError(r.error.message);
    else arrancar();
  };
}

function pedirClave(correo, nombre){
  const v = modal(`<h3>Hola, ${esc(nombre)}</h3>
    <label class="campo" for="mclave">Tu contraseña</label>
    <input type="password" id="mclave" autocomplete="current-password">
    <div class="err" id="mErr"></div>
    <div class="btn-fila">
      <button class="btn" id="mEntrar" style="flex:1">Entrar</button>
      <button class="btn sec" id="mCancelar">Cancelar</button></div>
    <p class="nota" style="text-align:center;margin-top:12px">
      ¿Olvidaste tu contraseña? Pídesela a la coordinación.</p>`);
  const inp = v.querySelector('#mclave'); inp.focus();
  const entrar = async () => {
    v.querySelector('#mEntrar').disabled = true;
    const r = await sb.auth.signInWithPassword({ email: correo, password: inp.value });
    if(r.error){
      v.querySelector('#mErr').textContent = traducirError(r.error.message);
      v.querySelector('#mEntrar').disabled = false;
    } else { v.remove(); arrancar(); }
  };
  v.querySelector('#mEntrar').onclick = entrar;
  inp.onkeydown = e => { if(e.key === 'Enter') entrar(); };
  v.querySelector('#mCancelar').onclick = () => v.remove();
}

function traducirError(m){
  if(/Invalid login/i.test(m)) return 'Contraseña incorrecta.';
  if(/Email not confirmed/i.test(m)) return 'La cuenta no está confirmada. Habla con la coordinación.';
  if(/rate limit|Too many/i.test(m)) return 'Demasiados intentos. Espera un minuto.';
  return m;
}

/* =====================================================================
   CABECERA, DÍAS Y LIBRERÍAS
   ===================================================================== */
function pintarCabecera(){
  const l = libDe(S.libreriaVista);
  const dn = diaEvento(l, S.fechaVista);
  const propia = S.yo?.libreria_id === S.libreriaVista;
  document.getElementById('cabeceraIn').innerHTML = `
    <div>
      <h1>${esc(l?.nombre || 'Librería')}</h1>
      <div class="meta">${fechaLarga(S.fecha)} · <span id="relojTop">${horaAhora()}</span></div>
      ${!propia ? `<span class="pill-lib" style="background:${esc(l?.color)}">viendo otra librería</span>` : ''}
    </div>
    ${dn ? `<div class="dia-n"><b>${dn}</b><span>día de la fiesta</span></div>` : ''}`;
}

function navegadorDias(){
  const l = libDe(S.libreriaVista);
  return `<div class="dias-nav">` + diasDe(S.rango[0], S.rango[1]).map(d => {
    const dn = diaEvento(l, d);
    return `<button class="dia-chip${d===S.fechaVista?' sel':''}${d===S.fecha?' hoy':''}"
      data-dia="${d}"><i>${DOW3[dowDe(d)]}</i><b>${diaNum(d)}</b>
      ${dn ? `<span class="dn">día ${dn}</span>` : ''}</button>`;
  }).join('') + `</div>`;
}

function selectorLibrerias(){
  if(S.librerias.length < 2) return '';
  return `<div class="sel-lib">` + S.librerias.map(x =>
    `<button data-ir-lib="${x.id}" class="${x.id===S.libreriaVista?'act':''}"
      ${x.id===S.libreriaVista ? `style="background:${esc(x.color)};border-color:${esc(x.color)}"` : ''}>
      ${esc(x.nombre)}</button>`).join('') + `</div>`;
}

/* =====================================================================
   INICIO
   ===================================================================== */
function vistaInicio(){
  const l = libDe(S.libreriaVista);
  const propia = S.yo.libreria_id === S.libreriaVista;
  const cerrado = !!S.dia?.cerrado;
  const esHoy = S.fechaVista === S.fecha;
  let h = '';

  if(propia && esHoy){
    const j = S.miJornada;
    const saludado = !!j?.saludo_en, descansado = !!j?.descanso_en, cerrada = !!j?.cierre_en;
    const m = minutosAhora();
    const etiquetaDescanso = m < 720 ? "Desayuno en Tiffany's"
                           : m < 1080 ? 'Almuerzo sobre la hierba' : 'Comer, beber, amar';
    h += `<div class="acciones">
      <button class="accion ${saludado ? '' : 'principal'}" id="btnSaludar"
        ${saludado || cerrado ? 'disabled' : ''}>
        <span class="emo">${saludado ? '✅' : '👋'}</span>
        <span>${saludado ? 'Ya saludaste hoy' : 'Saludar'}
        <span class="sub">${cerrado ? 'El día está cerrado'
          : saludado ? 'Llegaste a las ' + horaDe(j.saludo_en)
          : 'Marca el inicio de tu jornada'}</span></span></button>
      <button class="accion" id="btnDescanso"
        ${!saludado || descansado || cerrada || cerrado ? 'disabled' : ''}>
        <span class="emo">${descansado ? '☕' : '🍽️'}</span>
        <span>${etiquetaDescanso}
        <span class="sub">${descansado ? 'Descansaste a las ' + horaDe(j.descanso_en)
          : 'Marca tu hora de descanso'}</span></span></button>
      <button class="accion ${saludado && !cerrada && !cerrado ? 'cierre' : ''}" id="btnCerrar"
        ${!saludado || cerrada || cerrado ? 'disabled' : ''}>
        <span class="emo">${cerrada ? '🏁' : '📕'}</span>
        <span>Misión cumplida
        <span class="sub">${cerrada ? 'Cerraste a las ' + horaDe(j.cierre_en)
          : 'Marca tu salida'}</span></span></button></div>`;
    if(j?.mision_reto){
      h += `<div class="bloque" style="border-left:4px solid var(--rosa)">
        <span class="lbl">tu misión de hoy</span>
        <p style="font-size:.92rem;font-weight:600;line-height:1.4">${esc(j.mision_reto)}</p></div>`;
    }
  }

  h += selectorLibrerias();

  const dentro = equipoDe(S.libreriaVista).filter(p => enSala(p.id));
  const titulo = l?.nombre?.includes('Salón') ? 'Libreros en el Salón' : 'En ' + (l?.nombre || 'sala');
  h += `<div class="bloque">
    <span class="lbl">${esc(titulo)}${esHoy?'':' · '+esc(fechaCorta(S.fechaVista))}</span>
    ${dentro.length ? `<div class="en-sala">` + dentro.map(p =>
        `<div class="uno">${avatar(p,44,estadoDe(p.id).clave)}<span>${esc(p.nombre_corto)}</span></div>`
      ).join('') + `</div><p class="nota" style="margin-top:10px">${dentro.length}
      ${dentro.length===1?'persona':'personas'} con jornada abierta.</p>`
    : `<p class="vacio">${esHoy ? 'Nadie ha marcado su saludo todavía.'
        : 'Sin jornadas registradas ese día.'}</p>`}</div>`;

  h += navegadorDias();
  h += bloqueParrillaDia(S.fechaVista);

  const fij = S.avisos.filter(a => a.fijado).slice(0,2);
  if(fij.length) h += `<div class="bloque"><span class="lbl">del tablero</span>`
    + fij.map(pintarAviso).join('') + `</div>`;

  if(S.dia && (S.dia.ejemplares != null || S.dia.ingresos != null)) h += bloqueVentas();
  return h;
}

function bloqueVentas(){
  const l = libDe(S.libreriaVista);
  const ej = S.dia?.ejemplares, ing = S.dia?.ingresos, meta = l?.meta_ejemplares;
  let comp = '';
  if(ej != null && meta){
    const pct = Math.round((ej/meta - 1)*100);
    comp = pct >= 0 ? `${pct}% sobre el promedio de 2025 (${meta}/día)`
                    : `${Math.abs(pct)}% por debajo del promedio de 2025 (${meta}/día)`;
  }
  return `<div class="bloque"><span class="lbl">cierre de caja · ${esc(fechaCorta(S.fechaVista))}</span>
    <div style="display:flex;gap:26px;flex-wrap:wrap">
      ${ej != null ? `<div><div style="font-size:2rem;font-weight:800;letter-spacing:-.04em">${ej}</div>
        <div class="lbl">ejemplares</div></div>` : ''}
      ${ing != null ? `<div><div style="font-size:2rem;font-weight:800;letter-spacing:-.04em">${pesos(ing)}</div>
        <div class="lbl">en ventas</div></div>` : ''}
    </div>
    ${comp ? `<p class="nota" style="margin-top:10px">${esc(comp)}</p>` : ''}
    ${ej && ing ? `<p class="nota">Ticket promedio ${pesos(ing/ej)}.</p>` : ''}</div>`;
}

function bloqueParrillaDia(fecha){
  const l = libDe(S.libreriaVista);
  const ini = min(l?.apertura || '09:30'), fin = min(l?.cierre || '21:00');
  const span = fin - ini, pct = m => ((m - ini)/span*100);
  const gente = equipoDe(S.libreriaVista);
  const ahora = minutosAhora();
  const vivo = fecha === S.fecha && ahora >= ini - 30 && ahora <= fin;
  const marcas = []; for(let m = Math.ceil(ini/120)*120; m < fin; m += 120) marcas.push(m);
  const dn = diaEvento(l, fecha);

  let h = `<div class="bloque">
    <span class="lbl">turnos · ${esc(fechaLarga(fecha))}${dn ? ' · día '+dn+' de la fiesta' : ''}</span>
    <div class="escala">${marcas.map(m => `<span style="left:${pct(m)}%">${fmtCorto(m)}</span>`).join('')}</div>`;

  for(const p of gente){
    const t = turnoDe(p.id, fecha);
    h += `<div class="fila tocable" data-ver-persona="${p.id}">
      <div class="quien">${esc(p.nombre_corto)}</div><div class="pista">`
      + marcas.map(m => `<div class="g" style="left:${pct(m)}%"></div>`).join('');
    if(!t || !t.inicio || t.tipo === 'libre'){
      h += `<div style="position:absolute;inset:0;display:flex;align-items:center;
        padding-left:9px;font-size:.65rem;color:var(--tenue)">Libre</div>`;
    } else {
      const a = min(t.inicio), b = min(t.fin);
      h += `<div class="barra ${esc(t.tipo)}" style="left:${pct(a)}%;width:${pct(b)-pct(a)}%">
        ${fmtCorto(a)}–${fmtCorto(b)}</div>`;
      if(t.descanso_inicio && t.descanso_min){
        const d = min(t.descanso_inicio);
        h += `<div class="descanso" style="left:${pct(d)}%;width:${pct(d+t.descanso_min)-pct(d)}%"></div>`;
      }
    }
    if(vivo) h += `<div class="ahora-linea" style="left:${pct(Math.max(ini,Math.min(fin,ahora)))}%"></div>`;
    h += `</div></div>`;
  }

  const cob = cobertura(fecha), mn = minimoDe(fecha);
  h += `<div class="cob">` + cob.map(c => {
    const bg = c.n < mn-1 ? 'var(--coral)' : c.n < mn ? '#E2A03F'
             : c.n >= mn+3 ? 'var(--tinta)' : 'var(--suave)';
    return `<i style="background:${bg}" title="${fmt(c.m)}: ${c.n}">${c.n}</i>`;
  }).join('') + `</div>
  <div class="leyenda">
    <span>en sala · mínimo ${mn}</span>
    <span><i style="background:var(--amarillo)"></i>mañana</span>
    <span><i style="background:var(--cobalto)"></i>tarde</span>
    <span><i style="background:var(--coral)"></i>completa</span>
    <span><i style="background:var(--lima)"></i>compensación</span></div>
  <p class="nota" style="margin-top:10px">Toca a alguien para ver todas sus jornadas.</p></div>`;
  return h;
}

function fichaPersona(id){
  const p = perDe(id); if(!p) return;
  const dias = diasDe(S.rango[0], S.rango[1]);
  const l = libDe(p.libreria_id);
  const total = dias.reduce((s,d) => s + horasTurno(turnoDe(id,d)), 0);
  const v = modal(`
    <div style="text-align:center">${avatar(p,56)}
      <h3 style="margin-top:10px">${esc(p.nombre)}</h3>
      <p class="nota">${esc(l?.nombre||'')}${p.es_admin?' · coordinación':''}</p></div>
    <div class="bloque" style="margin-top:14px;background:var(--fondo)">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="lbl">horas pactadas en el período</span>
        <span style="font-size:1.4rem;font-weight:800;letter-spacing:-.04em">${horas(total)}</span>
      </div></div>
    <ul class="lista" style="max-height:46vh;overflow-y:auto">` +
    dias.map(d => {
      const t = turnoDe(id,d), dn = diaEvento(l,d);
      return `<li><div class="info">
        <b>${esc(fechaLarga(d))}${dn?` · día ${dn}`:''}</b>
        <span>${t && t.inicio ? fmt(min(t.inicio))+' a '+fmt(min(t.fin)) +
          (t.descanso_min ? ' · descanso '+fmtCorto(min(t.descanso_inicio)) : ' · sin descanso')
          : 'Libre'}</span></div>
        <div class="dato">${t && t.inicio ? horas(horasTurno(t)) : '—'}</div></li>`;
    }).join('') + `</ul>
    <div class="btn-fila"><button class="btn" style="flex:1" id="fpCerrar">Cerrar</button></div>`);
  v.querySelector('#fpCerrar').onclick = () => v.remove();
}

/* =====================================================================
   FEED
   ===================================================================== */
function vistaFeed(){
  let h = `<div style="display:flex;justify-content:space-between;align-items:center;
    gap:10px;margin-bottom:12px">
    <span class="lbl">memoria del equipo</span>
    <button class="btn sec mini" id="refrescarFeed">Actualizar</button></div>`;

  if(S.error) h += `<div class="alerta"><b>No se pudo cargar</b><p>${esc(S.error)}</p></div>`;

  if(S.yo){
    h += `<div class="compositor">${avatar(S.yo,36)}
      <textarea id="nuevoPost" maxlength="800"
        placeholder="Cuenta algo al equipo: una novedad, un dato, algo que pasó en sala…"></textarea></div>
      <div class="btn-fila" style="margin:0 0 6px;justify-content:flex-end">
        <button class="btn mini" id="publicar">Publicar</button></div>`;
  }
  if(!S.feed.length){
    h += `<div class="bloque" style="text-align:center;padding:32px 16px">
      ${criatura(72,'var(--cobalto)','var(--azul-claro)')}
      <p class="nota" style="margin-top:12px">Todavía no hay nada.
      El primero que salude abre la memoria del salón.</p></div>`;
    return h;
  }
  let ultimo = null;
  for(const p of S.feed){
    const d = diaDe(p.creada_en);
    if(d !== ultimo){
      ultimo = d;
      h += `<div class="sep-dia"><span class="lbl">${d===S.fecha?'hoy':esc(fechaCorta(d))}</span>
        <span class="cenefa"></span></div>`;
    }
    h += pintarPost(p);
  }
  return h;
}

function pintarPost(p){
  const per = perDe(p.persona_id) || {nombre_corto:'—'};
  const mio = S.yo && p.persona_id === S.yo.id;
  const sistema = p.tipo !== 'usuario';
  const l = libDe(per.libreria_id);

  if(p.retirada_en){
    return `<div class="post retirada">${avatar(per,36)}<div class="cuerpo">
      <div class="cab"><b>${esc(per.nombre_corto)}</b></div>
      <div class="txt">Publicación retirada por la coordinación.</div></div></div>`;
  }

  const mias = new Set(), cuenta = {};
  for(const r of S.reacciones){
    if(r.publicacion_id !== p.id) continue;
    cuenta[r.emoji] = (cuenta[r.emoji] || 0) + 1;
    if(S.yo && r.persona_id === S.yo.id) mias.add(r.emoji);
  }
  const reacs = Object.entries(cuenta).sort((a,b) => b[1]-a[1])
    .map(([e,n]) => `<button class="reac ${mias.has(e)?'mia':''}"
       data-reac="${p.id}" data-emoji="${e}">${e}<b>${n}</b></button>`).join('');

  return `<div class="post ${sistema?'sistema':''}">
    ${avatar(per,36)}
    <div class="cuerpo">
      <div class="cab">
        <b>${esc(per.nombre_corto)}</b>
        ${l ? `<span class="marca" style="background:${esc(l.color)}">${esc(l.nombre.split(' ')[0])}</span>` : ''}
        <time>${horaDe(p.creada_en)}</time>
        ${p.editada_en ? '<time>· editado</time>' : ''}
      </div>
      <div class="txt">${sistema ? esc(per.nombre_corto)+' ' : ''}${esc(p.texto)}</div>
      <div class="reacs">${reacs}
        <button class="reac-mas" data-paleta="${p.id}">＋ reaccionar</button></div>
      <div class="paleta oculto" id="pal-${p.id}">
        ${EMOJIS.map(e => `<button data-reac="${p.id}" data-emoji="${e}">${e}</button>`).join('')}
      </div>
      ${(mio && !sistema) || (S.yo?.es_admin && !mio && !sistema) ? `<div class="acc">
        ${mio ? `<button data-editar="${p.id}">Editar</button>
                 <button data-borrar="${p.id}">Borrar</button>` : ''}
        ${!mio && S.yo?.es_admin ? `<button data-retirar="${p.id}">Retirar</button>` : ''}
      </div>` : ''}
    </div></div>`;
}

/* =====================================================================
   PARRILLA
   ===================================================================== */
function vistaParrilla(){
  const l = libDe(S.libreriaVista);
  const dias = diasDe(S.rango[0], S.rango[1]);
  const gente = equipoDe(S.libreriaVista);
  const letra = {manana:'M', tarde:'T', completa:'C', compensacion:'✳', personalizado:'•', libre:'·'};
  const dnHoy = diaEvento(l, S.fechaVista);

  let h = selectorLibrerias();

  h += `<div class="bloque">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <div><span class="lbl">${esc(l?.nombre || '')}</span>
        <h3 style="margin-top:3px">${esc(fechaCorta(S.rango[0]))} a ${esc(fechaCorta(S.rango[1]))}</h3></div>
      ${dnHoy ? `<div class="dia-n"><b>${dnHoy}</b><span>día de la fiesta</span></div>` : ''}
    </div>
    <p class="nota" style="margin-top:4px">
      ${l?.modo_fiesta && l.evento_nombre ? esc(l.evento_nombre) : 'Semana en curso'}.
      Toca a alguien para ver sus jornadas.</p>
    <div style="overflow-x:auto;margin:14px -16px 0;padding:0 16px">
    <table style="border-collapse:separate;border-spacing:2px;font-size:.6rem">
    <thead><tr><th style="position:sticky;left:0;background:var(--superficie);z-index:2"></th>` +
    dias.map(d => { const dn = diaEvento(l,d);
      return `<th style="font-family:var(--mono);font-size:.55rem;padding:2px;
        color:${d===S.fechaVista?'var(--cobalto)':'var(--tenue)'}">
        ${DOW3[dowDe(d)]}<br><span style="font-size:.75rem;font-weight:700">${diaNum(d)}</span>
        ${dn ? `<br>d${dn}` : ''}</th>`; }).join('') + `</tr></thead><tbody>`;

  for(const p of gente){
    h += `<tr class="tocable" data-ver-persona="${p.id}">
      <td style="position:sticky;left:0;background:var(--superficie);z-index:2;font-size:.68rem;
        font-weight:500;padding-right:8px;white-space:nowrap">${esc(p.nombre_corto)}</td>`;
    for(const d of dias){
      const t = turnoDe(p.id, d);
      if(!t || t.tipo === 'libre' || !t.inicio){
        h += `<td><div style="width:28px;height:24px;border-radius:5px;background:#F2F1EC;
          display:grid;place-items:center;color:var(--linea-fuerte)">·</div></td>`;
      } else {
        h += `<td><div class="barra ${esc(t.tipo)}" style="position:static;width:28px;height:24px;
          display:grid;place-items:center;padding:0;font-size:.6rem"
          title="${esc(p.nombre_corto)} ${fmt(min(t.inicio))}–${fmt(min(t.fin))}">
          ${letra[t.tipo]||'•'}</div></td>`;
      }
    }
    h += `</tr>`;
  }
  h += `</tbody></table></div>
    <div class="leyenda" style="margin-left:0">
      <span><i style="background:var(--amarillo)"></i>M mañana</span>
      <span><i style="background:var(--cobalto)"></i>T tarde</span>
      <span><i style="background:var(--coral)"></i>C completa</span>
      <span><i style="background:var(--lima)"></i>✳ compensación</span></div></div>`;

  h += navegadorDias();
  h += bloqueParrillaDia(S.fechaVista);

  h += `<div class="bloque"><span class="lbl">horas pactadas en el período</span><ul class="lista">` +
    gente.map(p => {
      const hs = dias.reduce((s,d) => s + horasTurno(turnoDe(p.id,d)), 0);
      const n  = dias.filter(d => { const t = turnoDe(p.id,d); return t && t.inicio; }).length;
      return `<li class="tocable" data-ver-persona="${p.id}">${avatar(p,36)}
        <div class="info"><b>${esc(p.nombre)}</b><span>${n} jornadas</span></div>
        <div class="dato">${horas(hs)}</div></li>`;
    }).join('') + `</ul></div>`;
  return h;
}

/* =====================================================================
   TABLERO
   ===================================================================== */
function pintarAviso(a){
  const col = {meta:'var(--tinta)', libro:'var(--rosa)', aviso:'var(--coral)', animo:'var(--lima)'}[a.tipo];
  const nom = {meta:'Cifra', libro:'Recomendación de venta', aviso:'Aviso operativo', animo:'Para el equipo'};
  const l = a.libreria_id ? libDe(a.libreria_id) : null;
  return `<div class="aviso" style="border-left-color:${col}">
    <div class="cab"><span class="lbl">${nom[a.tipo]||'Aviso'}${a.fijado?' · fijado':''}</span>
      <span class="chip" style="background:${l?esc(l.color):'var(--linea-fuerte)'};
        ${l?'':'color:var(--tinta)'}">${l?esc(l.nombre.split(' ')[0]):'toda la red'}</span></div>
    <b>${esc(a.titulo)}</b>
    ${a.cifra ? `<div class="cifra">${esc(a.cifra)}</div>` : ''}
    ${a.texto ? `<p>${esc(a.texto)}</p>` : ''}</div>`;
}

function vistaTablero(){
  if(!S.avisos.length) return `<div class="bloque" style="text-align:center;padding:32px 16px">
    ${criatura(72,'var(--coral)','var(--amarillo)')}
    <p class="nota" style="margin-top:12px">El tablero está vacío.</p></div>`;
  return `<div class="bloque"><span class="lbl">tablero de la red</span>`
    + S.avisos.map(pintarAviso).join('') + `</div>`;
}

/* =====================================================================
   PERFIL
   ===================================================================== */
async function vistaPerfil(){
  const p = S.yo;
  const [jr, lq] = await Promise.all([
    sb.from('jornadas').select('*').eq('persona_id', p.id).order('fecha',{ascending:false}).limit(60),
    sb.from('liquidaciones').select('*').eq('persona_id', p.id).order('creada_en',{ascending:false})
  ]);
  const J = jr.data || [], LQ = lq.data || [];
  const pact = J.reduce((s,x) => s + (+x.horas_pactadas||0), 0);
  const extra = J.reduce((s,x) => s + (+x.extra_aprobada||0), 0);
  const pend = J.filter(x => x.extra_estado === 'pendiente')
                .reduce((s,x) => s + (+x.extra_calculada||0), 0);

  let h = `<div class="bloque" style="text-align:center">
    ${avatar(p,56, enSala(p.id) ? 'sala' : null)}
    <h3 style="margin-top:10px">${esc(p.nombre)}</h3>
    <p class="nota">${esc(libDe(p.libreria_id)?.nombre||'')}${p.es_admin?' · coordinación':''}</p></div>`;

  h += `<div class="bloque"><span class="lbl">mis horas</span>
    <div style="display:flex;gap:26px;flex-wrap:wrap">
      <div><div style="font-size:1.9rem;font-weight:800;letter-spacing:-.04em">${horas(pact+extra)}</div>
        <div class="lbl">acumuladas</div></div>
      <div><div style="font-size:1.9rem;font-weight:800;letter-spacing:-.04em">${horas(extra)}</div>
        <div class="lbl">extra aprobadas</div></div></div>
    ${pend > 0 ? `<p class="nota" style="margin-top:10px">Tienes ${horas(pend)}
      esperando aprobación de la coordinación.</p>` : ''}</div>`;

  h += `<div class="bloque"><span class="lbl">mis misiones</span><ul class="lista">` +
    (J.filter(x => x.mision_reto).slice(0,20).map(x => `<li><div class="info">
      <b>${esc(fechaCorta(x.fecha))}</b><span>${esc(x.mision_reto)}</span></div>
      <div class="dato">${x.cierre_en?'✓':'·'}</div></li>`).join('')
      || `<li><div class="info"><span>Todavía no tienes misiones. Salen al saludar.</span></div></li>`)
    + `</ul></div>`;

  h += `<div class="bloque"><span class="lbl">mis jornadas</span><ul class="lista">` +
    (J.slice(0,20).map(x => `<li><div class="info"><b>${esc(fechaLarga(x.fecha))}</b>
      <span>${x.saludo_en?horaDe(x.saludo_en):'—'} a ${x.cierre_en?horaDe(x.cierre_en):'—'}
      ${x.cierre_estimado?' · cierre estimado':''}
      ${x.extra_aprobada>0?' · '+horas(x.extra_aprobada)+' extra':''}</span></div>
      <div class="dato">${horas((+x.horas_pactadas||0)+(+x.extra_aprobada||0))}</div></li>`).join('')
      || `<li><div class="info"><span>Sin jornadas registradas.</span></div></li>`) + `</ul></div>`;

  if(LQ.length) h += `<div class="bloque"><span class="lbl">mis liquidaciones</span><ul class="lista">`
    + LQ.map(x => `<li><div class="info"><b>${esc(fechaCorta(x.desde))} a ${esc(fechaCorta(x.hasta))}</b>
      <span>${horas(+x.horas_pactadas + +x.horas_extra)} · ${esc(x.estado)}</span></div>
      <div class="dato">${pesos(x.total)}</div></li>`).join('') + `</ul></div>`;

  h += `<div class="bloque">
    <p class="nota">La contraseña la administra la coordinación. Si necesitas cambiarla, pídeselo.</p>
    <div class="btn-fila"><button class="btn sec" id="salir">Cerrar sesión</button></div></div>`;
  return h;
}

/* =====================================================================
   ACCIONES DE JORNADA
   ===================================================================== */
async function accionSaludar(){
  const m = mensajes.mision(S.yo, S.fecha);
  const b = document.getElementById('btnSaludar'); if(b) b.disabled = true;

  const { error } = await sb.rpc('saludar', { p_mision_reto:m.reto,
    p_mision_cumplida:m.cumplida, p_saludo: mensajes.saludo(S.yo, S.fecha) });
  if(error){ brindis(error.message); if(b) b.disabled = false; return; }

  const emo = ['📚','🌻','🐙','✨','🦋','🕯️','🎭','🧭','🪄','🐚','🌙','🎈'];
  brindis('¡Buen día, ' + S.yo.nombre_corto + '!');
  const v = modal(`<div class="emo-grande">${emo[Math.floor(Math.random()*emo.length)]}</div>
    <h3>${esc(mensajes.bienvenida(S.yo, S.fecha))}</h3>
    <div class="mision"><span class="lbl">tu misión del día</span><p>${esc(m.reto)}</p></div>
    <div class="btn-fila"><button class="btn" style="flex:1" id="cerrarModal">A trabajar</button></div>
    <p class="nota" style="text-align:center;margin-top:10px">La vuelves a ver en tu perfil.</p>`);
  v.querySelector('#cerrarModal').onclick = () => v.remove();

  await cargarLibreria(); await cargarFeed(); render();
}

async function accionDescanso(){
  const { error } = await sb.rpc('marcar_descanso');
  if(error) return brindis(error.message);
  brindis('Buen provecho. Descanso marcado.');
  await cargarLibreria(); render();
}

async function accionCerrar(){
  const m = S.miJornada?.mision_cumplida || 'sostener el salón un día más';
  const v = modal(`<div class="emo-grande">🏁</div>
    <h3>¿Cerramos tu jornada?</h3>
    <p class="nota" style="text-align:center;margin-top:8px">
      En el feed va a quedar que cumpliste la misión de ${esc(m)}.</p>
    <div class="btn-fila"><button class="btn" style="flex:1" id="siCerrar">Misión cumplida</button>
      <button class="btn sec" id="noCerrar">Todavía no</button></div>`);
  v.querySelector('#noCerrar').onclick = () => v.remove();
  v.querySelector('#siCerrar').onclick = async () => {
    v.querySelector('#siCerrar').disabled = true;
    const { error } = await sb.rpc('cerrar_jornada');
    v.remove();
    if(error) return brindis(error.message);
    brindis('Hasta mañana. Jornada cerrada.');
    await cargarLibreria(); await cargarFeed(); render();
  };
}

async function alternarReaccion(pubId, emoji){
  if(!S.yo) return;
  const mia = S.reacciones.find(r => r.publicacion_id === pubId
    && r.persona_id === S.yo.id && r.emoji === emoji);
  if(mia){
    await sb.from('reacciones').delete().eq('id', mia.id);
    S.reacciones = S.reacciones.filter(r => r.id !== mia.id);
  } else {
    const r = await sb.from('reacciones').insert({ publicacion_id:pubId,
      persona_id:S.yo.id, emoji }).select().single();
    if(r.error) return brindis(r.error.message);
    S.reacciones.push(r.data);
  }
  render();
}

/* =====================================================================
   DOBLE DESLIZADOR DE JORNADA · 7 a.m. a 10 p.m.
   ===================================================================== */
const TOPE_INI = 7*60, TOPE_FIN = 22*60, PASO = 15;

function deslizador(id, ini, fin, descanso){
  const pct = m => ((m - TOPE_INI)/(TOPE_FIN - TOPE_INI)*100);
  return `<div class="rango-cab">
      <span class="franja" id="fr-${id}">${fmt(ini)} – ${fmt(fin)}</span>
      <span class="cuantas" id="hr-${id}">${horas((fin-ini-descanso)/60)} de trabajo</span></div>
    <div class="rango">
      <div class="via"></div>
      <div class="activo" id="ac-${id}" style="left:${pct(ini)}%;width:${pct(fin)-pct(ini)}%"></div>
      <input type="range" min="${TOPE_INI}" max="${TOPE_FIN}" step="${PASO}" value="${ini}"
        data-tope="ini" data-de="${id}" aria-label="Hora de entrada">
      <input type="range" min="${TOPE_INI}" max="${TOPE_FIN}" step="${PASO}" value="${fin}"
        data-tope="fin" data-de="${id}" aria-label="Hora de salida">
    </div>
    <div class="rango-topes"><span>7 a.m.</span><span>10 p.m.</span></div>`;
}

function enlazarDeslizador(cont, id, descanso, alSoltar){
  const pct = m => ((m - TOPE_INI)/(TOPE_FIN - TOPE_INI)*100);
  const a = cont.querySelector(`[data-de="${id}"][data-tope="ini"]`);
  const b = cont.querySelector(`[data-de="${id}"][data-tope="fin"]`);
  if(!a || !b) return;
  const pinta = () => {
    let x = +a.value, y = +b.value;
    if(x > y - 60){ if(document.activeElement === a) x = y - 60; else y = x + 60; }
    x = Math.max(TOPE_INI, x); y = Math.min(TOPE_FIN, y);
    a.value = x; b.value = y;
    const ac = cont.querySelector('#ac-'+id);
    ac.style.left = pct(x)+'%'; ac.style.width = (pct(y)-pct(x))+'%';
    cont.querySelector('#fr-'+id).textContent = fmt(x)+' – '+fmt(y);
    cont.querySelector('#hr-'+id).textContent = horas((y-x-descanso)/60) + ' de trabajo';
    return [x,y];
  };
  [a,b].forEach(s => {
    s.oninput = pinta;
    s.onchange = () => { const [x,y] = pinta(); alSoltar(x,y); };
  });
}

/* =====================================================================
   PANEL DE GESTIÓN
   ===================================================================== */
async function vistaAdmin(){
  const l = libDe(S.libreriaVista);
  const gente = equipoDe(S.libreriaVista);
  const cerrado = !!S.dia?.cerrado;

  let h = `<div class="bloque">
    <span class="lbl">gestionando</span>
    <select id="admLib">${S.librerias.map(x =>
      `<option value="${x.id}"${x.id===S.libreriaVista?' selected':''}>${esc(x.nombre)}</option>`).join('')}</select>
    <label class="campo" style="display:flex;align-items:center;gap:8px;text-transform:none;
      letter-spacing:0;font-size:.86rem;font-family:'Archivo';font-weight:600">
      <input type="checkbox" id="togFiesta"${l?.modo_fiesta?' checked':''}> Modo fiesta encendido</label>
    <p class="nota">${l?.modo_fiesta
      ? `La cabecera cuenta los días de ${esc(l.evento_nombre || 'el evento')}.
         Apágalo y solo se verá la fecha.`
      : 'Apagado: la cabecera muestra solo la fecha. Enciéndelo para contar los días de un evento.'}</p>
    <div class="btn-fila">
      <button class="btn sec mini" id="editarLib">Configurar esta librería</button>
      <button class="btn sec mini" id="nuevaLib">Crear librería</button></div></div>`;

  h += navegadorDias();

  const cob = cobertura(S.fechaVista), mn = minimoDe(S.fechaVista);
  const flojas = []; let act = null;
  for(const c of cob){
    if(c.n < mn){
      if(act && act.fin === c.m) act.fin = c.m+30;
      else { act = {ini:c.m, fin:c.m+30, n:c.n}; flojas.push(act); }
      act.n = Math.min(act.n, c.n);
    } else act = null;
  }
  h += `<div class="bloque"><span class="lbl">cobertura · ${esc(fechaLarga(S.fechaVista))}</span>`
    + (flojas.length ? flojas.map(f => `<div class="alerta"><b>${fmt(f.ini)} a ${fmt(f.fin)}</b>
        <p>Solo ${f.n} en sala, por debajo del mínimo de ${mn}.</p></div>`).join('')
      : `<div class="bien">Todas las franjas cumplen el mínimo de ${mn}.</div>`) + `</div>`;

  h += `<div class="bloque"><span class="lbl">cierre del día · ${esc(fechaLarga(S.fechaVista))}</span>
    <h3>${cerrado ? 'Día cerrado' : 'Día abierto'}</h3>
    <p class="nota">${cerrado
      ? 'Los botones de marcar están apagados hasta las '
        + (l?.reactivar_a?.slice(0,5) || '08:00') + ' de mañana.'
      : 'Al cerrar se apagan los botones de marcar de todo el equipo.'}</p>`;
  const abiertas = gente.filter(p => { const j = jornadaDe(p.id); return j?.saludo_en && !j.cierre_en; });
  if(!cerrado && abiertas.length)
    h += `<div class="alerta" style="margin-top:10px"><b>${abiertas.length}
      ${abiertas.length===1?'jornada abierta':'jornadas abiertas'}</b>
      <p>${abiertas.map(p => esc(p.nombre_corto)).join(', ')} sin marcar Misión cumplida.
      Si cierras ahora, ${abiertas.length===1?'queda':'quedan'} como estimada.</p></div>`;
  h += `<label class="campo" for="vEj">Ejemplares vendidos</label>
    <input type="number" id="vEj" min="0" value="${S.dia?.ejemplares ?? ''}" placeholder="opcional">
    <label class="campo" for="vIn">Ingresos del día</label>
    <input type="number" id="vIn" min="0" step="1000" value="${S.dia?.ingresos ?? ''}" placeholder="opcional">
    <label class="campo" for="vVis">Qué ve el equipo</label>
    <select id="vVis">
      <option value="oculto"${l?.ventas_visibles==='oculto'?' selected':''}>Nada</option>
      <option value="ejemplares"${l?.ventas_visibles==='ejemplares'?' selected':''}>Solo ejemplares</option>
      <option value="completo"${l?.ventas_visibles==='completo'?' selected':''}>Ejemplares e ingresos</option>
    </select>
    <div class="btn-fila"><button class="btn sec" id="guardarVentas">Guardar cifras</button>
      ${cerrado ? `<button class="btn peligro" id="reabrirDia">Reabrir el día</button>`
                : `<button class="btn" id="cerrarDia">Cerrar el día</button>`}</div></div>`;

  const pend = S.jornadas.filter(j => j.extra_estado === 'pendiente');
  h += `<div class="bloque"><span class="lbl">horas extra del día</span>`;
  if(!pend.length) h += `<div class="bien">Nadie pasó de su turno.</div>`;
  else h += pend.map(j => {
    const p = perDe(j.persona_id);
    return `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;
      border-bottom:1px solid var(--linea)">${avatar(p,36)}
      <div style="flex:1;min-width:0"><b style="font-size:.84rem">${esc(p?.nombre_corto)}</b>
        <div class="nota">Cerró a las ${horaDe(j.cierre_en)} · calculadas ${horas(j.extra_calculada)}</div>
        <div class="pasos" style="margin-top:6px"><button data-menos="${j.id}">−</button>
          <span class="val" id="ex-${j.id}">${(+j.extra_calculada).toFixed(2).replace('.',',')}</span>
          <button data-mas="${j.id}">+</button></div></div>
      <div style="display:grid;gap:5px">
        <button class="btn mini" data-aprobar="${j.id}">Aprobar</button>
        <button class="btn sec mini" data-rechazar="${j.id}">Rechazar</button></div></div>`;
  }).join('');
  h += `</div>`;

  h += `<div class="bloque"><span class="lbl">personal de ${esc(l?.nombre)}</span><ul class="lista">` +
    gente.map(p => {
      const e = estadoDe(p.id), j = jornadaDe(p.id);
      return `<li>${avatar(p,36,e.clave)}
        <div class="info"><b>${esc(p.nombre)}${p.es_admin?' · coordinación':''}</b>
        <span>${esc(e.txt)}${p.correo?'':' · sin correo, no puede entrar'}</span>
        ${j ? `<div class="btn-fila" style="margin-top:6px;gap:6px">
          ${j.cierre_en ? `<button class="btn sec mini" data-reabrir-j="${p.id}">Reabrir salida</button>` : ''}
          <button class="btn peligro mini" data-reiniciar="${p.id}">Reiniciar marcas</button></div>` : ''}
        </div>
        <button class="btn sec mini" data-editar-persona="${p.id}">Editar</button></li>`;
    }).join('') + `</ul>
    <div class="btn-fila"><button class="btn" id="nuevaPersona">Agregar persona</button>
      <button class="btn sec" id="verHorarios">Administrar horarios</button>
      <button class="btn sec" id="verLiquidacion">Liquidar honorarios</button></div></div>`;

  h += `<div class="bloque"><span class="lbl">publicar en el tablero</span>
    <label class="campo" for="avTipo">Tipo</label>
    <select id="avTipo"><option value="meta">Cifra</option>
      <option value="libro">Recomendación de venta</option>
      <option value="aviso">Aviso operativo</option><option value="animo">Para el equipo</option></select>
    <label class="campo" for="avLib">Asociado a</label>
    <select id="avLib"><option value="">Toda la red</option>${S.librerias.map(x =>
      `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select>
    <label class="campo" for="avTit">Título</label><input type="text" id="avTit">
    <label class="campo" for="avCif">Número destacado (opcional)</label><input type="text" id="avCif">
    <label class="campo" for="avTex">Texto</label><textarea id="avTex"></textarea>
    <label class="campo" for="avHasta">Vigente hasta (opcional)</label><input type="date" id="avHasta">
    <div class="btn-fila"><button class="btn" id="avPublicar">Publicar</button>
      <label style="display:flex;align-items:center;gap:6px;font-size:.78rem">
        <input type="checkbox" id="avFijar"> Fijar arriba</label></div>`;
  if(S.avisos.length){
    h += `<div style="margin-top:18px"><span class="lbl">publicados</span></div>` +
      S.avisos.map(a => `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;
        border-bottom:1px solid var(--linea)"><div style="flex:1">
        <b style="font-size:.8rem">${esc(a.titulo)}</b>
        <div class="nota">${esc((a.texto||'').slice(0,70))}${(a.texto||'').length>70?'…':''}</div></div>
        <button class="btn sec mini" data-fijar="${a.id}">${a.fijado?'Soltar':'Fijar'}</button>
        <button class="btn peligro mini" data-quitar-aviso="${a.id}">Quitar</button></div>`).join('');
  }
  h += `</div>`;
  return h;
}

async function panelHorarios(){
  const l = libDe(S.libreriaVista);
  const gente = equipoDe(S.libreriaVista);
  const descPorDefecto = l?.descanso_min ?? 60;

  const v = modal(`<h3>Administrar horarios</h3>
    <p class="nota" style="margin-top:6px">Elige cualquier día del calendario y mueve los dos
    topes de cada jornada. La app avisa si la sala queda floja, pero nunca te lo impide.</p>
    <label class="campo" for="hDia">Día</label>
    <input type="date" id="hDia" value="${S.fechaVista}">
    <div id="hLista" style="margin-top:8px;max-height:46vh;overflow-y:auto"></div>
    <div id="hAviso" style="margin-top:10px"></div>
    <div class="btn-fila"><button class="btn" style="flex:1" id="hCerrar">Listo</button></div>`);

  let turnosDia = [];

  const traer = async () => {
    const dia = v.querySelector('#hDia').value;
    const ids = gente.map(p => p.id);
    const r = ids.length
      ? await sb.from('turnos').select('*').in('persona_id', ids).eq('fecha', dia)
      : {data:[]};
    turnosDia = r.data || [];
  };

  const guardar = async (personaId, dia, a, b, desc) => {
    const t = turnosDia.find(x => x.persona_id === personaId);
    const desfase = (t?.descanso_inicio && t?.inicio)
      ? min(t.descanso_inicio) - min(t.inicio)
      : Math.round((b - a)/2 - desc/2);
    const fila = {
      persona_id: personaId, fecha: dia,
      tipo: (t?.tipo && t.tipo !== 'libre') ? t.tipo : 'personalizado',
      inicio: hhmm(a), fin: hhmm(b),
      descanso_inicio: desc ? hhmm(Math.min(b - desc, a + Math.max(0, desfase))) : null,
      descanso_min: desc, fijo: true, aprobado: true, actualizado_por: S.yo.id
    };
    const r = await sb.from('turnos').upsert(fila, { onConflict:'persona_id,fecha' })
      .select().single();
    if(r.error) return brindis(r.error.message);
    const i = turnosDia.findIndex(x => x.persona_id === personaId);
    if(i >= 0) turnosDia[i] = r.data; else turnosDia.push(r.data);
    avisar();
  };

  const dibujar = () => {
    const dia = v.querySelector('#hDia').value;
    v.querySelector('#hLista').innerHTML = gente.map(p => {
      const t = turnosDia.find(x => x.persona_id === p.id);
      const tiene = t && t.inicio && t.tipo !== 'libre';
      const a = tiene ? min(t.inicio) : min(l?.apertura || '09:30');
      const b = tiene ? min(t.fin)
                      : Math.min(TOPE_FIN, a + (+p.horas_dia)*60 + descPorDefecto);
      const desc = tiene ? (t.descanso_min ?? 0) : descPorDefecto;
      return `<div class="persona-fila">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:2px">
          ${avatar(p,28)}<b style="font-size:.82rem;flex:1">${esc(p.nombre_corto)}</b>
          ${tiene ? `<button class="btn sec mini" data-librar="${p.id}">Dejar libre</button>`
                  : `<button class="btn sec mini" data-asignar="${p.id}">Asignar turno</button>`}
        </div>
        ${tiene ? deslizador(p.id, a, b, desc) : `<p class="nota">Sin turno este día.</p>`}
      </div>`;
    }).join('');

    gente.forEach(p => {
      const t = turnosDia.find(x => x.persona_id === p.id);
      if(!t || !t.inicio || t.tipo === 'libre') return;
      enlazarDeslizador(v, p.id, t.descanso_min ?? 0,
        (a,b) => guardar(p.id, dia, a, b, t.descanso_min ?? 0));
    });

    v.querySelectorAll('[data-asignar]').forEach(btn => btn.onclick = async () => {
      const p = gente.find(x => x.id === btn.dataset.asignar);
      const ini = min(l?.apertura || '09:30');
      await guardar(p.id, dia, ini,
        Math.min(TOPE_FIN, ini + (+p.horas_dia)*60 + descPorDefecto), descPorDefecto);
      dibujar();
    });
    v.querySelectorAll('[data-librar]').forEach(btn => btn.onclick = async () => {
      await sb.from('turnos').upsert({ persona_id:btn.dataset.librar, fecha:dia, tipo:'libre',
        inicio:null, fin:null, descanso_inicio:null, descanso_min:0, fijo:true,
        actualizado_por:S.yo.id }, { onConflict:'persona_id,fecha' });
      await traer(); dibujar();
    });
    avisar();
  };

  const avisar = () => {
    const dia = v.querySelector('#hDia').value;
    const mn = (dowDe(dia)===0||dowDe(dia)===6) ? (l?.minimo_finde ?? 4) : (l?.minimo_semana ?? 3);
    const ap = min(l?.apertura||'09:30'), ci = min(l?.cierre||'21:00');
    const flojas = [];
    for(let m = ap; m < ci; m += 30){
      let n = 0;
      for(const t of turnosDia){
        if(!t.inicio || t.tipo === 'libre') continue;
        const a = min(t.inicio), b = min(t.fin);
        if(m < a || m >= b) continue;
        if(t.descanso_inicio){ const d = min(t.descanso_inicio);
          if(m >= d && m < d + t.descanso_min) continue; }
        n++;
      }
      if(n < mn) flojas.push({m,n});
    }
    v.querySelector('#hAviso').innerHTML = flojas.length
      ? `<div class="alerta"><b>${flojas.length} franjas por debajo del mínimo</b>
         <p>La más floja: ${fmt(flojas.reduce((a,b)=>b.n<a.n?b:a).m)} con
         ${Math.min(...flojas.map(f=>f.n))} en sala, sobre un mínimo de ${mn}.
         Puedes dejarlo así si es lo que necesitas.</p></div>`
      : `<div class="bien">La cobertura de este día cumple el mínimo de ${mn}.</div>`;
  };

  v.querySelector('#hDia').onchange = async () => { await traer(); dibujar(); };
  v.querySelector('#hCerrar').onclick = async () => {
    v.remove(); await cargarLibreria(); render(); };
  await traer(); dibujar();
}

function formPersona(p){
  const nuevo = !p;
  const v = modal(`<h3>${nuevo ? 'Agregar al equipo' : esc(p.nombre)}</h3>
    <label class="campo" for="fNom">Nombres completos</label>
    <input type="text" id="fNom" value="${esc(p?.nombre||'')}">
    <label class="campo" for="fCorto">Cómo lo llamamos</label>
    <input type="text" id="fCorto" value="${esc(p?.nombre_corto||'')}">
    <label class="campo" for="fCorreo">Correo (el mismo de su cuenta)</label>
    <input type="email" id="fCorreo" value="${esc(p?.correo||'')}">
    <label class="campo" for="fAv">Archivo de la foto</label>
    <input type="text" id="fAv" value="${esc(p?.avatar||'')}" placeholder="avatar-nombre">
    <label class="campo" for="fLib">Librería asignada</label>
    <select id="fLib">${S.librerias.map(x =>
      `<option value="${x.id}"${x.id===(p?.libreria_id||S.libreriaVista)?' selected':''}>${esc(x.nombre)}</option>`).join('')}</select>
    <label class="campo" for="fIng">Fecha de ingreso</label>
    <input type="date" id="fIng" value="${p?.fecha_ingreso || S.fecha}">
    <label class="campo" for="fHoras">Horas por día</label>
    <input type="number" id="fHoras" step="0.5" min="1" max="14" value="${p?.horas_dia ?? 8}">
    <label class="campo">Días que trabaja</label>
    <div style="display:flex;gap:5px;flex-wrap:wrap">${['D','L','M','X','J','V','S'].map((d,i) => {
      const on = (p?.dias_trabajo ?? [0,1,2,3,4,5,6]).includes(i);
      return `<label style="display:flex;align-items:center;gap:4px;font-size:.78rem;
        border:1px solid var(--linea-fuerte);border-radius:8px;padding:6px 9px">
        <input type="checkbox" class="fDia" value="${i}"${on?' checked':''}> ${d}</label>`;
    }).join('')}</div>
    <label class="campo" style="display:flex;align-items:center;gap:7px;text-transform:none;
      letter-spacing:0;font-size:.82rem;font-family:'Archivo'">
      <input type="checkbox" id="fAdmin"${p?.es_admin?' checked':''}> Es coordinación</label>
    <label class="campo" for="fTarifa">Valor hora (vacío = el de la librería)</label>
    <input type="number" id="fTarifa" step="500" placeholder="15000">
    <div class="err" id="fErr"></div>
    <div class="btn-fila">
      <button class="btn" style="flex:1" id="fGuardar">${nuevo?'Agregar y sugerir turnos':'Guardar'}</button>
      <button class="btn sec" id="fCancelar">Cancelar</button></div>
    ${!nuevo ? `<div class="btn-fila">
      <button class="btn peligro mini" id="fDesactivar">Retirar del equipo</button></div>
      <p class="nota" style="margin-top:8px">Retirar no borra: conserva sus horas,
      publicaciones y liquidaciones.</p>` : ''}`);

  v.querySelector('#fCancelar').onclick = () => v.remove();
  v.querySelector('#fGuardar').onclick = async () => {
    const dias = [...v.querySelectorAll('.fDia:checked')].map(x => +x.value);
    const datos = {
      nombre: v.querySelector('#fNom').value.trim(),
      nombre_corto: v.querySelector('#fCorto').value.trim()
                    || v.querySelector('#fNom').value.trim().split(' ')[0],
      correo: v.querySelector('#fCorreo').value.trim() || null,
      avatar: v.querySelector('#fAv').value.trim() || null,
      libreria_id: v.querySelector('#fLib').value,
      fecha_ingreso: v.querySelector('#fIng').value,
      horas_dia: +v.querySelector('#fHoras').value || 8,
      dias_trabajo: dias.length ? dias : [0,1,2,3,4,5,6],
      es_admin: v.querySelector('#fAdmin').checked
    };
    if(!datos.nombre) return v.querySelector('#fErr').textContent = 'Falta el nombre.';
    const r = p ? await sb.from('personas').update(datos).eq('id', p.id).select().single()
                : await sb.from('personas').insert(datos).select().single();
    if(r.error) return v.querySelector('#fErr').textContent = r.error.message;

    const tar = v.querySelector('#fTarifa').value;
    if(tar) await sb.from('tarifas').insert({ persona_id:r.data.id, valor_hora:+tar,
      vigente_desde: datos.fecha_ingreso, creada_por: S.yo.id });

    v.remove(); await cargarBase();
    if(!p) sugerirTurnos(r.data); else render();
  };
  const des = v.querySelector('#fDesactivar');
  if(des) des.onclick = async () => {
    if(!confirm('¿Retirar a ' + p.nombre + ' del equipo activo?')) return;
    await sb.from('personas').update({ activa:false, fecha_salida:S.fecha }).eq('id', p.id);
    v.remove(); await cargarBase(); render();
  };
}

/* Quien entra a mitad de camino arranca al día siguiente en la mañana y
   alterna, como el resto. La coordinación mueve los topes y aprueba. */
function sugerirTurnos(persona){
  const l = libDe(persona.libreria_id);
  const [d0,d1] = (l?.modo_fiesta && l.evento_inicio && l.evento_fin)
    ? [l.evento_inicio, l.evento_fin] : S.rango;
  const manana = masDias(S.fecha, 1);
  const desde = manana > d0 ? manana : d0;
  if(desde > d1){ render(); return; }
  const dias = diasDe(desde, d1)
    .filter(d => (persona.dias_trabajo||[0,1,2,3,4,5,6]).includes(dowDe(d)));
  if(!dias.length){ render(); return; }

  const dur = (+persona.horas_dia || 8)*60;
  const desc = l?.descanso_min ?? 60;
  const ap = min(l?.apertura||'09:30'), ci = min(l?.cierre||'21:00');
  const prop = dias.map((d,i) => i % 2 === 0
    ? {fecha:d, tipo:'manana', ini:ap, fin:Math.min(TOPE_FIN, ap+dur+desc)}
    : {fecha:d, tipo:'tarde',  ini:Math.max(TOPE_INI, ci-dur-desc), fin:ci});

  const v = modal(`<h3>Turnos sugeridos</h3>
    <p class="nota" style="margin-top:6px">${esc(persona.nombre)} ·
    ${persona.horas_dia} h por día. Mueve los topes de cada jornada.
    Al aprobar se incrusta en la parrilla sin tocar los turnos de los demás.</p>
    <div style="margin-top:12px;max-height:46vh;overflow-y:auto">` +
    prop.map((t,i) => `<div class="persona-fila">
      <b style="font-size:.8rem">${esc(fechaLarga(t.fecha))}</b>
      ${deslizador('p'+i, t.ini, t.fin, desc)}</div>`).join('') + `</div>
    <div class="err" id="pErr"></div>
    <div class="btn-fila">
      <button class="btn" style="flex:1" id="pAprobar">Aprobar los ${prop.length} turnos</button>
      <button class="btn sec" id="pCancelar">Después</button></div>`);

  prop.forEach((t,i) => enlazarDeslizador(v, 'p'+i, desc, (a,b) => { t.ini = a; t.fin = b; }));

  v.querySelector('#pCancelar').onclick = () => { v.remove(); render(); };
  v.querySelector('#pAprobar').onclick = async () => {
    const filas = prop.map(t => ({
      persona_id: persona.id, fecha: t.fecha, tipo: t.tipo,
      inicio: hhmm(t.ini), fin: hhmm(t.fin),
      descanso_inicio: hhmm(Math.min(t.fin - desc,
        t.ini + Math.round((t.fin - t.ini)/2 - desc/2))),
      descanso_min: desc, fijo: true, aprobado: true, actualizado_por: S.yo.id
    }));
    const r = await sb.from('turnos').upsert(filas, { onConflict:'persona_id,fecha' });
    if(r.error) return v.querySelector('#pErr').textContent = r.error.message;
    v.remove(); brindis('Turnos incrustados en la parrilla');
    await cargarBase(); render();
  };
}

async function panelLiquidacion(){
  const gente = equipoDe(S.libreriaVista);
  const v = modal(`<h3>Liquidar honorarios</h3>
    <label class="campo" for="lqP">Persona</label>
    <select id="lqP">${gente.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select>
    <label class="campo" for="lqD">Desde</label><input type="date" id="lqD" value="${S.rango[0]}">
    <label class="campo" for="lqH">Hasta</label><input type="date" id="lqH" value="${S.rango[1]}">
    <div class="btn-fila"><button class="btn sec" id="lqVer">Previsualizar</button></div>
    <div id="lqRes" style="margin-top:14px"></div>
    <div class="err" id="lqErr"></div>
    <div class="btn-fila"><button class="btn sec" id="lqCerrar">Cerrar</button></div>`);
  v.querySelector('#lqCerrar').onclick = () => v.remove();
  v.querySelector('#lqVer').onclick = async () => {
    const args = { p_persona:v.querySelector('#lqP').value,
      p_desde:v.querySelector('#lqD').value, p_hasta:v.querySelector('#lqH').value };
    const { data, error } = await sb.rpc('previsualizar_liquidacion', args);
    if(error) return v.querySelector('#lqErr').textContent = error.message;
    if(!data?.length) return v.querySelector('#lqRes').innerHTML =
      `<div class="bien">No hay jornadas pendientes de liquidar en ese rango.</div>`;
    const tot = data.reduce((s,x) => s + (+x.subtotal), 0);
    const th  = data.reduce((s,x) => s + (+x.horas) + (+x.extra) - (+x.descuento), 0);
    v.querySelector('#lqRes').innerHTML = `<ul class="lista">` + data.map(x =>
      `<li><div class="info"><b>${esc(fechaCorta(x.fecha))}</b>
        <span>${horas(+x.horas)}${+x.extra?' + '+horas(+x.extra)+' extra':''}
        ${+x.descuento?' − '+horas(+x.descuento):''} × ${pesos(x.tarifa)}</span></div>
        <div class="dato">${pesos(x.subtotal)}</div></li>`).join('') + `</ul>
      <div class="bloque" style="margin-top:10px;background:var(--fondo)">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span class="lbl">${horas(th)} a pagar</span>
          <span style="font-size:1.6rem;font-weight:800;letter-spacing:-.04em">${pesos(tot)}</span>
        </div></div>
      <div class="btn-fila"><button class="btn" style="flex:1" id="lqHacer">
        Liquidar y bloquear estos días</button></div>`;
    v.querySelector('#lqHacer').onclick = async () => {
      if(!confirm('Al liquidar, esos días quedan bloqueados. ¿Seguimos?')) return;
      const r = await sb.rpc('liquidar', args);
      if(r.error) return v.querySelector('#lqErr').textContent = r.error.message;
      v.remove(); brindis('Liquidación creada por ' + pesos(r.data.total));
    };
  };
}

function formLibreria(l){
  const v = modal(`<h3>${l ? 'Configurar ' + esc(l.nombre) : 'Nueva librería'}</h3>
    <label class="campo" for="cNom">Nombre</label>
    <input type="text" id="cNom" value="${esc(l?.nombre||'')}">
    <label class="campo" for="cSlug">Identificador corto</label>
    <input type="text" id="cSlug" value="${esc(l?.slug||'')}" placeholder="itaca">
    <label class="campo" for="cCol">Color</label>
    <select id="cCol">${[['#1E6DB4','Cobalto'],['#EF6C5A','Coral'],['#92C64F','Lima'],
      ['#EF70A5','Rosa'],['#FBDD1D','Amarillo'],['#87BEE4','Azul claro']].map(([c,n]) => {
      const usado = S.librerias.some(x => x.color === c && x.id !== l?.id);
      return `<option value="${c}"${l?.color===c?' selected':''}>${n}${usado?' (en uso)':''}</option>`;
    }).join('')}</select>
    <label class="campo" for="cAp">Apertura</label>
    <input type="time" id="cAp" value="${l?.apertura?.slice(0,5)||'10:00'}">
    <label class="campo" for="cCi">Cierre</label>
    <input type="time" id="cCi" value="${l?.cierre?.slice(0,5)||'20:00'}">
    <label class="campo" for="cDes">Descanso en minutos</label>
    <input type="number" id="cDes" value="${l?.descanso_min ?? 60}" step="15">
    <label class="campo" for="cMs">Mínimo en sala entre semana</label>
    <input type="number" id="cMs" value="${l?.minimo_semana ?? 2}">
    <label class="campo" for="cMf">Mínimo en sala fines de semana</label>
    <input type="number" id="cMf" value="${l?.minimo_finde ?? 3}">
    <label class="campo" for="cMeta">Meta diaria de ejemplares (opcional)</label>
    <input type="number" id="cMeta" value="${l?.meta_ejemplares ?? ''}">
    <label class="campo" for="cTar">Valor hora base</label>
    <input type="number" id="cTar" step="500" placeholder="15000">
    <label class="campo" style="display:flex;align-items:center;gap:7px;text-transform:none;
      letter-spacing:0;font-size:.86rem;font-family:'Archivo'">
      <input type="checkbox" id="cFiesta"${l?.modo_fiesta?' checked':''}> Modo fiesta encendido</label>
    <div id="cEvento" class="${l?.modo_fiesta?'':'oculto'}">
      <label class="campo" for="cEvN">Nombre del evento</label>
      <input type="text" id="cEvN" value="${esc(l?.evento_nombre||'')}"
        placeholder="Fiesta del Libro y la Cultura de Medellín 2026">
      <label class="campo" for="cEvI">Empieza</label>
      <input type="date" id="cEvI" value="${l?.evento_inicio||''}">
      <label class="campo" for="cEvF">Termina</label>
      <input type="date" id="cEvF" value="${l?.evento_fin||''}">
    </div>
    <div class="err" id="cErr"></div>
    <div class="btn-fila"><button class="btn" style="flex:1" id="cGuardar">Guardar</button>
      <button class="btn sec" id="cCancelar">Cancelar</button></div>`);
  v.querySelector('#cFiesta').onchange = e =>
    v.querySelector('#cEvento').classList.toggle('oculto', !e.target.checked);
  v.querySelector('#cCancelar').onclick = () => v.remove();
  v.querySelector('#cGuardar').onclick = async () => {
    const meta = v.querySelector('#cMeta').value;
    const d = {
      nombre: v.querySelector('#cNom').value.trim(),
      slug: v.querySelector('#cSlug').value.trim().toLowerCase().replace(/\s+/g,'-'),
      color: v.querySelector('#cCol').value,
      apertura: v.querySelector('#cAp').value, cierre: v.querySelector('#cCi').value,
      descanso_min: +v.querySelector('#cDes').value,
      minimo_semana: +v.querySelector('#cMs').value, minimo_finde: +v.querySelector('#cMf').value,
      meta_ejemplares: meta === '' ? null : +meta,
      modo_fiesta: v.querySelector('#cFiesta').checked,
      evento_nombre: v.querySelector('#cEvN')?.value.trim() || null,
      evento_inicio: v.querySelector('#cEvI')?.value || null,
      evento_fin: v.querySelector('#cEvF')?.value || null,
      orden: l?.orden ?? S.librerias.length + 1
    };
    if(!d.nombre || !d.slug) return v.querySelector('#cErr').textContent = 'Falta nombre o identificador.';
    const r = l ? await sb.from('librerias').update(d).eq('id', l.id).select().single()
                : await sb.from('librerias').insert(d).select().single();
    if(r.error) return v.querySelector('#cErr').textContent = r.error.message;
    const tar = v.querySelector('#cTar').value;
    if(tar) await sb.from('tarifas').insert({ libreria_id:r.data.id, valor_hora:+tar,
      vigente_desde: S.fecha, creada_por: S.yo.id });
    v.remove(); S.libreriaVista = r.data.id; await cargarBase(); render();
  };
}

/* =====================================================================
   RENDER
   ===================================================================== */
async function render(){
  document.getElementById('tabs').classList.remove('oculto');
  document.getElementById('cabecera').classList.remove('oculto');
  document.getElementById('tabAdmin').classList.toggle('oculto', !S.yo?.es_admin);
  document.querySelectorAll('nav.tabs button').forEach(b =>
    b.classList.toggle('act', b.dataset.v === S.vista));
  pintarCabecera();

  const app = document.getElementById('app');
  app.innerHTML = S.vista === 'inicio'   ? vistaInicio()
                : S.vista === 'feed'     ? vistaFeed()
                : S.vista === 'parrilla' ? vistaParrilla()
                : S.vista === 'tablero'  ? vistaTablero()
                : S.vista === 'perfil'   ? await vistaPerfil()
                : await vistaAdmin();
  enlazar();
  window.scrollTo({top:0});
}

function enlazar(){
  const el = id => document.getElementById(id);
  const on = (id, fn) => { const e = el(id); if(e) e.onclick = fn; };

  on('btnSaludar', accionSaludar);
  on('btnDescanso', accionDescanso);
  on('btnCerrar', accionCerrar);

  document.querySelectorAll('[data-ir-lib]').forEach(b => b.onclick = async () => {
    S.libreriaVista = b.dataset.irLib; calcularRango(); await cargarLibreria(); render();
  });
  document.querySelectorAll('[data-dia]').forEach(b => b.onclick = async () => {
    S.fechaVista = b.dataset.dia; await cargarLibreria(); render();
  });
  document.querySelectorAll('[data-ver-persona]').forEach(b => b.onclick = e => {
    const btn = e.target.closest('button');
    if(btn && btn !== b) return;              // no abrir la ficha al tocar un botón interno
    fichaPersona(b.dataset.verPersona);
  });

  on('refrescarFeed', async () => {
    const b = el('refrescarFeed'); b.disabled = true; b.textContent = 'Actualizando…';
    await cargarBase(); await cargarFeed(); render();
  });
  on('publicar', async () => {
    const t = el('nuevoPost').value.trim(); if(!t) return;
    el('publicar').disabled = true;
    const r = await sb.from('publicaciones').insert({ persona_id:S.yo.id,
      libreria_id:S.yo.libreria_id, tipo:'usuario', texto:t });
    if(r.error){ brindis(r.error.message); el('publicar').disabled = false; return; }
    await cargarFeed(); render();
  });
  document.querySelectorAll('[data-paleta]').forEach(b => b.onclick = () => {
    const p = el('pal-'+b.dataset.paleta); if(p) p.classList.toggle('oculto');
  });
  document.querySelectorAll('[data-reac]').forEach(b => b.onclick = () =>
    alternarReaccion(b.dataset.reac, b.dataset.emoji));
  document.querySelectorAll('[data-borrar]').forEach(b => b.onclick = async () => {
    if(!confirm('¿Borrar tu publicación?')) return;
    await sb.from('publicaciones').delete().eq('id', b.dataset.borrar);
    await cargarFeed(); render();
  });
  document.querySelectorAll('[data-retirar]').forEach(b => b.onclick = async () => {
    if(!confirm('¿Retirar esta publicación? Queda la huella, no desaparece.')) return;
    await sb.from('publicaciones').update({ retirada_en:new Date().toISOString(),
      retirada_por:S.yo.id }).eq('id', b.dataset.retirar);
    await cargarFeed(); render();
  });
  document.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => {
    const p = S.feed.find(x => x.id === b.dataset.editar);
    const v = modal(`<h3>Editar publicación</h3><textarea id="edTxt">${esc(p.texto)}</textarea>
      <div class="btn-fila"><button class="btn" style="flex:1" id="edOk">Guardar</button>
      <button class="btn sec" id="edNo">Cancelar</button></div>`);
    v.querySelector('#edNo').onclick = () => v.remove();
    v.querySelector('#edOk').onclick = async () => {
      await sb.from('publicaciones').update({ texto:v.querySelector('#edTxt').value.trim(),
        editada_en:new Date().toISOString() }).eq('id', p.id);
      v.remove(); await cargarFeed(); render();
    };
  });

  on('salir', async () => { await sb.auth.signOut(); location.reload(); });

  const sl = el('admLib');
  if(sl) sl.onchange = async () => { S.libreriaVista = sl.value; calcularRango();
    await cargarLibreria(); render(); };
  const tf = el('togFiesta');
  if(tf) tf.onchange = async () => {
    const l = libDe(S.libreriaVista);
    if(tf.checked && !l.evento_inicio){
      tf.checked = false;
      brindis('Primero define el evento y sus fechas');
      return formLibreria(l);
    }
    await sb.from('librerias').update({ modo_fiesta: tf.checked }).eq('id', S.libreriaVista);
    brindis(tf.checked ? 'Modo fiesta encendido' : 'Modo fiesta apagado');
    await cargarBase(); render();
  };
  on('nuevaLib', () => formLibreria(null));
  on('editarLib', () => formLibreria(libDe(S.libreriaVista)));
  on('nuevaPersona', () => formPersona(null));
  on('verHorarios', panelHorarios);
  on('verLiquidacion', panelLiquidacion);
  document.querySelectorAll('[data-editar-persona]').forEach(b => b.onclick = () =>
    formPersona(perDe(b.dataset.editarPersona)));

  document.querySelectorAll('[data-reiniciar]').forEach(b => b.onclick = async () => {
    const p = perDe(b.dataset.reiniciar);
    if(!confirm('¿Borrar las marcas de ' + p.nombre + ' de este día? '
      + 'Se van también su saludo y su misión cumplida del feed.')) return;
    const r = await sb.rpc('reiniciar_jornada', { p_persona:p.id, p_fecha:S.fechaVista });
    if(r.error) return brindis(r.error.message);
    brindis('Marcas reiniciadas'); await cargarLibreria(); await cargarFeed(); render();
  });
  document.querySelectorAll('[data-reabrir-j]').forEach(b => b.onclick = async () => {
    const r = await sb.rpc('reabrir_jornada', { p_persona:b.dataset.reabrirJ, p_fecha:S.fechaVista });
    if(r.error) return brindis(r.error.message);
    brindis('Salida reabierta'); await cargarLibreria(); await cargarFeed(); render();
  });

  on('guardarVentas', async () => {
    const ej = el('vEj').value, ing = el('vIn').value;
    await sb.from('dias').upsert({ libreria_id:S.libreriaVista, fecha:S.fechaVista,
      ejemplares: ej === '' ? null : +ej, ingresos: ing === '' ? null : +ing,
      actualizado_por:S.yo.id, actualizado_en:new Date().toISOString()
    }, { onConflict:'libreria_id,fecha' });
    await sb.from('librerias').update({ ventas_visibles: el('vVis').value }).eq('id', S.libreriaVista);
    brindis('Cifras guardadas'); await cargarBase(); render();
  });
  on('cerrarDia', async () => {
    if(!confirm('Al cerrar, los botones de marcar quedan apagados para todo el equipo. ¿Cerramos?')) return;
    const r = await sb.rpc('cerrar_dia', { p_libreria:S.libreriaVista, p_fecha:S.fechaVista });
    if(r.error) return brindis(r.error.message);
    brindis('Día cerrado'); await cargarLibreria(); render();
  });
  on('reabrirDia', async () => {
    const r = await sb.rpc('reabrir_dia', { p_libreria:S.libreriaVista, p_fecha:S.fechaVista });
    if(r.error) return brindis(r.error.message);
    brindis('Día reabierto'); await cargarLibreria(); render();
  });

  const paso = (id,d) => {
    const e = el('ex-'+id); if(!e) return;
    const n = Math.max(0, Math.round((parseFloat(e.textContent.replace(',','.')) + d)*4)/4);
    e.textContent = n.toFixed(2).replace('.',',');
  };
  document.querySelectorAll('[data-mas]').forEach(b => b.onclick = () => paso(b.dataset.mas, .25));
  document.querySelectorAll('[data-menos]').forEach(b => b.onclick = () => paso(b.dataset.menos, -.25));
  document.querySelectorAll('[data-aprobar]').forEach(b => b.onclick = async () => {
    const id = b.dataset.aprobar;
    const val = parseFloat(el('ex-'+id).textContent.replace(',','.')) || 0;
    await sb.from('jornadas').update({ extra_aprobada:val, extra_estado:'aprobada',
      aprobada_por:S.yo.id, aprobada_en:new Date().toISOString() }).eq('id', id);
    brindis('Extra aprobada: ' + horas(val)); await cargarLibreria(); render();
  });
  document.querySelectorAll('[data-rechazar]').forEach(b => b.onclick = async () => {
    await sb.from('jornadas').update({ extra_aprobada:0, extra_estado:'rechazada',
      aprobada_por:S.yo.id, aprobada_en:new Date().toISOString() }).eq('id', b.dataset.rechazar);
    await cargarLibreria(); render();
  });

  on('avPublicar', async () => {
    const t = el('avTit').value.trim(); if(!t) return el('avTit').focus();
    const r = await sb.from('avisos').insert({ libreria_id: el('avLib').value || null,
      tipo: el('avTipo').value, titulo:t, cifra: el('avCif').value.trim() || null,
      texto: el('avTex').value.trim() || null, vigente_hasta: el('avHasta').value || null,
      fijado: el('avFijar').checked, creado_por: S.yo.id });
    if(r.error) return brindis(r.error.message);
    brindis('Publicado en el tablero'); await cargarBase(); render();
  });
  document.querySelectorAll('[data-quitar-aviso]').forEach(b => b.onclick = async () => {
    await sb.from('avisos').delete().eq('id', b.dataset.quitarAviso);
    await cargarBase(); render();
  });
  document.querySelectorAll('[data-fijar]').forEach(b => b.onclick = async () => {
    const a = S.avisos.find(x => x.id === b.dataset.fijar);
    await sb.from('avisos').update({ fijado: !a.fijado }).eq('id', a.id);
    await cargarBase(); render();
  });
}

/* =====================================================================
   ARRANQUE
   ===================================================================== */
async function arrancar(){
  const { data:{ session } } = await sb.auth.getSession();
  if(!session) return pintarIngreso();

  const { data:persona, error } = await sb.rpc('vincular_cuenta');
  if(error || !persona){
    await sb.auth.signOut();
    return pintarIngreso('Tu cuenta todavía no está asociada a nadie del equipo. '
      + 'Habla con la coordinación para que registre tu correo.');
  }
  S.yo = persona;
  S.libreriaVista = persona.libreria_id;
  await cargarBase();
  await cargarFeed();
  render();
}

document.querySelectorAll('nav.tabs button').forEach(b =>
  b.onclick = () => { S.vista = b.dataset.v; render(); });

setInterval(() => {
  const r = document.getElementById('relojTop');
  if(r) r.textContent = horaAhora();
}, 30000);
setInterval(async () => {
  if(S.yo && document.visibilityState === 'visible'
     && ['inicio','feed'].includes(S.vista) && !document.querySelector('.velo')){
    await cargarLibreria();
    if(S.vista === 'feed') await cargarFeed();
    render();
  }
}, 120000);

arrancar();
