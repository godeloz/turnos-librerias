/* =====================================================================
   RED DE LIBRERÍAS · Gestión de personal
   Operado por Libros del Fuego
   ===================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';
import { mensajes } from './mensajes.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

/* ---------------------------------------------------------------------
   Estado
   --------------------------------------------------------------------- */
const S = {
  yo: null,            // persona de la sesión
  librerias: [],
  libreriaVista: null, // la que se está mirando (puede no ser la propia)
  personas: [],
  turnosHoy: [],
  turnosRango: [],
  jornadasHoy: [],
  miJornada: null,
  avisos: [],
  feed: [],
  dia: null,           // registro de cierre/ventas de la librería vista
  vista: 'inicio',
  fecha: null,         // fecha de trabajo (hoy en Bogotá)
  cargando: false
};

/* ---------------------------------------------------------------------
   Utilidades de fecha, hora y texto
   --------------------------------------------------------------------- */
const DOW = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
             'septiembre','octubre','noviembre','diciembre'];

function hoyISO(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:CONFIG.TZ}).format(new Date());
}
function horaAhora(){
  return new Intl.DateTimeFormat('es-CO',{timeZone:CONFIG.TZ,hour:'numeric',
    minute:'2-digit',hour12:true}).format(new Date()).replace(/\s?a\.?\s?m\.?/i,' a.m.')
    .replace(/\s?p\.?\s?m\.?/i,' p.m.');
}
function minutosAhora(){
  const p = new Intl.DateTimeFormat('en-GB',{timeZone:CONFIG.TZ,hour:'2-digit',
    minute:'2-digit',hour12:false}).format(new Date()).split(':');
  return (+p[0])*60 + (+p[1]);
}
const dowDe = iso => new Date(iso+'T12:00:00Z').getUTCDay();
const fechaLarga = iso => {
  const d = new Date(iso+'T12:00:00Z');
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`;
};
const fechaCorta = iso => {
  const d = new Date(iso+'T12:00:00Z');
  return `${d.getUTCDate()} ${MES[d.getUTCMonth()].slice(0,3)}`;
};
const min = t => { if(!t) return null; const [h,m] = t.split(':'); return (+h)*60 + (+m); };
const fmt = m => {
  if(m == null) return '—';
  const h = Math.floor(m/60), mm = m%60, s = h >= 12 ? 'p.m.' : 'a.m.';
  return (h%12 || 12) + (mm ? ':'+String(mm).padStart(2,'0') : '') + ' ' + s;
};
const fmtCorto = m => { const h = Math.floor(m/60), mm = m%60;
  return (h%12||12) + (mm ? ':'+String(mm).padStart(2,'0') : ''); };
const horaDe = ts => new Intl.DateTimeFormat('es-CO',{timeZone:CONFIG.TZ,hour:'numeric',
  minute:'2-digit',hour12:true}).format(new Date(ts)).toLowerCase();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pesos = n => n == null ? '—' :
  '$' + Math.round(n).toLocaleString('es-CO');
const horas = n => (Math.round((n||0)*100)/100).toString().replace('.',',') + ' h';

/* Día del evento: 1..N, o null si no aplica. */
function diaEvento(lib, iso){
  if(!lib?.modo_fiesta || !lib.evento_inicio) return null;
  const a = Date.parse(iso+'T00:00:00Z'), b = Date.parse(lib.evento_inicio+'T00:00:00Z');
  const n = Math.floor((a-b)/86400000) + 1;
  if(lib.evento_fin && a > Date.parse(lib.evento_fin+'T00:00:00Z')) return null;
  return n >= 1 ? n : null;
}
function faltanDias(lib, iso){
  if(!lib?.modo_fiesta || !lib.evento_inicio) return null;
  const n = Math.floor((Date.parse(lib.evento_inicio+'T00:00:00Z') -
                        Date.parse(iso+'T00:00:00Z'))/86400000);
  return n > 0 ? n : null;
}

/* Avatar: si el archivo no existe cae a las iniciales sobre rosa pálido. */
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
const colorLib = id => libDe(id)?.color || 'var(--cobalto)';

/* Toast que se desvanece. */
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

/* Criatura del key visual: acompaña las pantallas vacías y la portada. */
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

/* ---------------------------------------------------------------------
   Carga de datos
   --------------------------------------------------------------------- */
async function cargarTodo(){
  S.fecha = hoyISO();
  const lib = S.libreriaVista;

  const [libs, pers, avisos, feed] = await Promise.all([
    sb.from('librerias').select('*').eq('activa', true).order('orden'),
    sb.from('personas').select('*').eq('activa', true).order('orden'),
    sb.from('avisos').select('*').order('fijado',{ascending:false}).order('creado_en',{ascending:false}),
    sb.from('publicaciones')
      .select('*, persona:personas(id,nombre,nombre_corto,avatar,avatar_v,libreria_id)')
      .order('creada_en',{ascending:false}).limit(120)
  ]);
  S.librerias = libs.data || [];
  S.personas  = pers.data || [];
  S.avisos    = (avisos.data || []).filter(a =>
                  !a.vigente_hasta || a.vigente_hasta >= S.fecha);
  S.feed      = feed.data || [];

  if(!S.libreriaVista) S.libreriaVista = S.yo?.libreria_id || S.librerias[0]?.id;
  await cargarLibreria();
}

async function cargarLibreria(){
  const ids = S.personas.filter(p => p.libreria_id === S.libreriaVista).map(p => p.id);
  const [turnos, jornadas, dia] = await Promise.all([
    ids.length ? sb.from('turnos').select('*').in('persona_id', ids).eq('fecha', S.fecha)
               : Promise.resolve({data:[]}),
    ids.length ? sb.from('jornadas').select('*').in('persona_id', ids).eq('fecha', S.fecha)
               : Promise.resolve({data:[]}),
    sb.from('dias_visible').select('*').eq('libreria_id', S.libreriaVista)
      .eq('fecha', S.fecha).maybeSingle()
  ]);
  S.turnosHoy   = turnos.data || [];
  S.jornadasHoy = jornadas.data || [];
  S.dia         = dia.data || null;
  S.miJornada   = S.jornadasHoy.find(j => j.persona_id === S.yo?.id) || null;

  // Si soy de otra librería, mi jornada vive aparte.
  if(!S.miJornada && S.yo){
    const r = await sb.from('jornadas').select('*')
      .eq('persona_id', S.yo.id).eq('fecha', S.fecha).maybeSingle();
    S.miJornada = r.data || null;
  }
}

async function cargarRango(desde, hasta){
  const ids = S.personas.filter(p => p.libreria_id === S.libreriaVista).map(p => p.id);
  if(!ids.length) return (S.turnosRango = []);
  const r = await sb.from('turnos').select('*').in('persona_id', ids)
    .gte('fecha', desde).lte('fecha', hasta).order('fecha');
  S.turnosRango = r.data || [];
}

/* Rango que muestra la parrilla: el evento si está encendido, si no la semana. */
function rangoParrilla(){
  const l = libDe(S.libreriaVista);
  if(l?.modo_fiesta && l.evento_inicio && l.evento_fin)
    return [l.evento_inicio, l.evento_fin];
  const d = new Date(S.fecha+'T12:00:00Z');
  const lunes = new Date(d); lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay()+6)%7));
  const dom = new Date(lunes); dom.setUTCDate(lunes.getUTCDate()+6);
  return [lunes.toISOString().slice(0,10), dom.toISOString().slice(0,10)];
}
function diasDe(desde, hasta){
  const out = []; let d = Date.parse(desde+'T00:00:00Z'), f = Date.parse(hasta+'T00:00:00Z');
  while(d <= f){ out.push(new Date(d).toISOString().slice(0,10)); d += 86400000; }
  return out;
}

/* ---------------------------------------------------------------------
   Estado de cada persona ahora mismo
   --------------------------------------------------------------------- */
function estadoDe(personaId){
  const t = S.turnosHoy.find(x => x.persona_id === personaId);
  const j = S.jornadasHoy.find(x => x.persona_id === personaId);
  if(!t || t.tipo === 'libre' || !t.inicio) return {clave:'libre', txt:'Libre hoy'};
  if(j?.cierre_en) return {clave:'salio', txt:'Cerró a las ' + horaDe(j.cierre_en)};
  if(j?.descanso_en) return {clave:'descanso', txt:'En descanso desde ' + horaDe(j.descanso_en)};
  if(j?.saludo_en)  return {clave:'sala', txt:'Llegó a las ' + horaDe(j.saludo_en)};
  const ahora = minutosAhora();
  if(ahora < min(t.inicio)) return {clave:'tarde', txt:'Entra a las ' + fmt(min(t.inicio))};
  return {clave:'tarde', txt:'Sin marcar el saludo'};
}
const enSala = id => ['sala','descanso'].includes(estadoDe(id).clave);

/* Cobertura por franjas de media hora. */
function cobertura(){
  const l = libDe(S.libreriaVista);
  const ini = min(l?.apertura || '09:30'), fin = min(l?.cierre || '21:00');
  const out = [];
  for(let m = ini; m < fin; m += 30){
    let n = 0;
    for(const t of S.turnosHoy){
      if(!t.inicio || t.tipo === 'libre') continue;
      const a = min(t.inicio), b = min(t.fin);
      if(m < a || m >= b) continue;
      if(t.descanso_inicio){
        const d = min(t.descanso_inicio);
        if(m >= d && m < d + t.descanso_min) continue;
      }
      n++;
    }
    out.push({m, n});
  }
  return out;
}
const minimoHoy = () => {
  const l = libDe(S.libreriaVista), d = dowDe(S.fecha);
  return (d === 0 || d === 6) ? (l?.minimo_finde ?? 4) : (l?.minimo_semana ?? 3);
};

/* =====================================================================
   PANTALLA DE INGRESO
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

  let h = `<div class="portada">
    ${criatura(88)}
    <h2>Salón de Editoriales<br>Independientes</h2>`;
  if(dn) h += `<div class="diagrande">${dn}</div>
      <div class="lbl">día de la fiesta</div>`;
  else if(faltan) h += `<div class="diagrande">${faltan}</div>
      <div class="lbl">${faltan === 1 ? 'día para empezar' : 'días para empezar'}</div>`;
  h += `<div class="fecha">${fechaLarga(hoy)} · ${horaAhora()}</div></div>`;

  if(!G.length){
    h += `<div class="bloque"><h3>Ingreso</h3>
      <p class="nota">Todavía no hay equipo publicado, o el listado no es visible sin sesión.
      Entra con tu correo y contraseña.</p>
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
      h += `<div class="grupo-lib"><span class="lbl" style="color:${esc(l.color)}">
        ${esc(l.nombre)}</span><div class="caras">` +
        suyos.map(p => `<button class="cara" data-persona="${p.id}"
            data-correo="${esc(p.correo)}" data-nombre="${esc(p.nombre_corto)}">
            ${avatar(p, 44)}<b>${esc(p.nombre_corto)}</b></button>`).join('') +
        `</div></div>`;
    }
    if(msg) h += `<div class="err" style="margin-top:16px">${esc(msg)}</div>`;
  }

  document.getElementById('app').innerHTML = h;

  document.querySelectorAll('[data-persona]').forEach(b => {
    b.onclick = () => pedirClave(b.dataset.correo, b.dataset.nombre);
  });
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
  const v = modal(`
    <h3>Hola, ${esc(nombre)}</h3>
    <label class="campo" for="mclave">Tu contraseña</label>
    <input type="password" id="mclave" autocomplete="current-password">
    <div class="err" id="mErr"></div>
    <div class="btn-fila">
      <button class="btn" id="mEntrar" style="flex:1">Entrar</button>
      <button class="btn sec" id="mCancelar">Cancelar</button>
    </div>
    <div class="btn-fila"><button class="btn sec mini" id="mOlvide">Olvidé mi contraseña</button></div>`);
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
  v.querySelector('#mOlvide').onclick = async () => {
    await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.href });
    v.querySelector('#mErr').textContent = '';
    v.remove();
    brindis('Te enviamos un correo para restablecerla');
  };
}

function traducirError(m){
  if(/Invalid login/i.test(m)) return 'Contraseña incorrecta.';
  if(/Email not confirmed/i.test(m)) return 'La cuenta aún no está confirmada. Habla con la coordinación.';
  if(/rate limit|Too many/i.test(m)) return 'Demasiados intentos. Espera un minuto.';
  return m;
}

/* =====================================================================
   CABECERA
   ===================================================================== */
function pintarCabecera(){
  const l = libDe(S.libreriaVista);
  const dn = diaEvento(l, S.fecha);
  const propia = S.yo?.libreria_id === S.libreriaVista;
  document.getElementById('cabeceraIn').innerHTML = `
    <div>
      <h1>${esc(l?.nombre || 'Librería')}</h1>
      <div class="meta">${fechaLarga(S.fecha)} · <span id="relojTop">${horaAhora()}</span></div>
      ${!propia ? `<span class="pill-lib" style="background:${esc(l?.color)}">
          viendo otra librería</span>` : ''}
    </div>
    ${dn ? `<div class="dia-n"><b>${dn}</b><span>día de la fiesta</span></div>` : ''}`;
}

/* =====================================================================
   INICIO
   ===================================================================== */
function vistaInicio(){
  const l = libDe(S.libreriaVista);
  const propia = S.yo.libreria_id === S.libreriaVista;
  const cerrado = !!S.dia?.cerrado;
  let h = '';

  /* --- acciones, solo en la propia librería --- */
  if(propia){
    const j = S.miJornada;
    const saludado = !!j?.saludo_en, descansado = !!j?.descanso_en, cerrada = !!j?.cierre_en;
    const m = minutosAhora();
    const etiquetaDescanso = m < 720 ? 'Desayuno en Tiffany\'s'
                           : m < 1080 ? 'Almuerzo sobre la hierba'
                           : 'Comer, beber, amar';
    h += `<div class="acciones">`;
    h += `<button class="accion ${saludado ? '' : 'principal'}" id="btnSaludar"
        ${saludado || cerrado ? 'disabled' : ''}>
        <span class="emo">${saludado ? '✅' : '👋'}</span>
        <span>${saludado ? 'Ya saludaste hoy' : 'Saludar'}
        <span class="sub">${cerrado ? 'El día está cerrado'
          : saludado ? 'Llegaste a las ' + horaDe(j.saludo_en)
          : 'Marca el inicio de tu jornada'}</span></span></button>`;
    h += `<button class="accion" id="btnDescanso"
        ${!saludado || descansado || cerrada || cerrado ? 'disabled' : ''}>
        <span class="emo">${descansado ? '☕' : '🍽️'}</span>
        <span>${etiquetaDescanso}
        <span class="sub">${descansado ? 'Descansaste a las ' + horaDe(j.descanso_en)
          : 'Marca tu hora de descanso'}</span></span></button>`;
    h += `<button class="accion ${saludado && !cerrada && !cerrado ? 'cierre' : ''}" id="btnCerrar"
        ${!saludado || cerrada || cerrado ? 'disabled' : ''}>
        <span class="emo">${cerrada ? '🏁' : '📕'}</span>
        <span>${cerrada ? 'Misión cumplida' : 'Misión cumplida'}
        <span class="sub">${cerrada ? 'Cerraste a las ' + horaDe(j.cierre_en)
          : 'Marca tu salida'}</span></span></button>`;
    h += `</div>`;
    if(j?.mision_reto){
      h += `<div class="bloque" style="border-left:4px solid var(--rosa)">
        <span class="lbl">tu misión de hoy</span>
        <p style="font-size:.92rem;font-weight:600;line-height:1.4">${esc(j.mision_reto)}</p>
      </div>`;
    }
  }

  /* --- libreros en sala --- */
  const dentro = S.personas.filter(p => p.libreria_id === S.libreriaVista && enSala(p.id));
  const nombreCard = l?.nombre?.includes('Salón') ? 'Libreros en el Salón' : 'En ' + (l?.nombre || 'sala');
  h += `<div class="bloque">
    <span class="lbl">${esc(nombreCard)}</span>
    ${dentro.length ? `<div class="en-sala">` + dentro.map(p => {
        const e = estadoDe(p.id);
        return `<div class="uno">${avatar(p, 44, e.clave)}<span>${esc(p.nombre_corto)}</span></div>`;
      }).join('') + `</div>
      <p class="nota" style="margin-top:10px">${dentro.length}
        ${dentro.length === 1 ? 'persona' : 'personas'} con jornada abierta.</p>`
    : `<p class="vacio">Nadie ha marcado su saludo todavía.</p>`}
  </div>`;

  /* --- parrilla del día --- */
  h += bloqueParrillaDia();

  /* --- destacados del tablero --- */
  const fij = S.avisos.filter(a => a.fijado).slice(0,2);
  if(fij.length){
    h += `<div class="bloque"><span class="lbl">del tablero</span>` +
      fij.map(pintarAviso).join('') + `</div>`;
  }

  /* --- ventas del día, si la librería las muestra --- */
  if(S.dia && (S.dia.ejemplares != null || S.dia.ingresos != null)){
    h += bloqueVentas();
  }

  /* --- navegación entre librerías --- */
  if(S.librerias.length > 1){
    h += `<div class="bloque"><span class="lbl">la red</span>
      <div class="btn-fila" style="margin-top:0">` +
      S.librerias.map(x => `<button class="btn ${x.id === S.libreriaVista ? '' : 'sec'} mini"
        data-ir-lib="${x.id}" ${x.id === S.libreriaVista
          ? `style="background:${esc(x.color)};border-color:${esc(x.color)}"` : ''}>
        ${esc(x.nombre)}</button>`).join('') + `</div></div>`;
  }
  return h;
}

function bloqueVentas(){
  const l = libDe(S.libreriaVista);
  const ej = S.dia?.ejemplares, ing = S.dia?.ingresos;
  const meta = l?.meta_ejemplares;
  let comp = '';
  if(ej != null && meta){
    const pct = Math.round((ej/meta - 1)*100);
    comp = pct >= 0 ? `${pct}% sobre el promedio de 2025 (${meta}/día)`
                    : `${Math.abs(pct)}% por debajo del promedio de 2025 (${meta}/día)`;
  }
  return `<div class="bloque"><span class="lbl">cierre de caja de hoy</span>
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      ${ej != null ? `<div><div style="font-size:2rem;font-weight:800;letter-spacing:-.04em">${ej}</div>
        <div class="lbl">ejemplares</div></div>` : ''}
      ${ing != null ? `<div><div style="font-size:2rem;font-weight:800;letter-spacing:-.04em">${pesos(ing)}</div>
        <div class="lbl">en ventas</div></div>` : ''}
    </div>
    ${comp ? `<p class="nota" style="margin-top:10px">${esc(comp)}</p>` : ''}
    ${ej && ing ? `<p class="nota">Ticket promedio ${pesos(ing/ej)}.</p>` : ''}
  </div>`;
}

function bloqueParrillaDia(){
  const l = libDe(S.libreriaVista);
  const ini = min(l?.apertura || '09:30'), fin = min(l?.cierre || '21:00');
  const span = fin - ini;
  const pct = m => ((m - ini)/span*100);
  const gente = S.personas.filter(p => p.libreria_id === S.libreriaVista);
  const ahora = minutosAhora();
  const hoyEs = S.fecha === hoyISO() && ahora >= ini - 30 && ahora <= fin;
  const marcas = []; for(let m = Math.ceil(ini/120)*120; m < fin; m += 120) marcas.push(m);

  let h = `<div class="bloque"><span class="lbl">turnos de hoy · ${esc(fechaLarga(S.fecha))}</span>
    <div class="escala">${marcas.map(m =>
      `<span style="left:${pct(m)}%">${fmtCorto(m)}</span>`).join('')}</div>`;

  for(const p of gente){
    const t = S.turnosHoy.find(x => x.persona_id === p.id);
    h += `<div class="fila"><div class="quien">${esc(p.nombre_corto)}</div><div class="pista">` +
      marcas.map(m => `<div class="g" style="left:${pct(m)}%"></div>`).join('');
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
    if(hoyEs) h += `<div class="ahora-linea" style="left:${pct(Math.max(ini,Math.min(fin,ahora)))}%"></div>`;
    h += `</div></div>`;
  }

  const cob = cobertura(), mn = minimoHoy();
  h += `<div class="cob">` + cob.map(c => {
    const bg = c.n < mn-1 ? 'var(--coral)' : c.n < mn ? '#E2A03F'
             : c.n >= mn+3 ? 'var(--tinta)' : 'var(--suave)';
    return `<i style="background:${bg}" title="${fmt(c.m)}: ${c.n}">${c.n}</i>`;
  }).join('') + `</div>
  <div class="leyenda">
    <span>personas en sala · mínimo ${mn}</span>
    <span><i style="background:var(--amarillo)"></i>mañana</span>
    <span><i style="background:var(--cobalto)"></i>tarde</span>
    <span><i style="background:var(--coral)"></i>completa</span>
    <span><i style="background:var(--lima)"></i>compensación</span>
  </div></div>`;
  return h;
}

/* =====================================================================
   FEED
   ===================================================================== */
function vistaFeed(){
  let h = '';
  if(S.yo){
    h += `<div class="compositor">
      ${avatar(S.yo, 36)}
      <textarea id="nuevoPost" placeholder="Cuenta algo al equipo: una novedad, un dato, algo que pasó en sala…"
        maxlength="800"></textarea>
    </div>
    <div class="btn-fila" style="margin:0 0 6px;justify-content:flex-end">
      <button class="btn mini" id="publicar">Publicar</button>
    </div>`;
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
    const dia = new Intl.DateTimeFormat('en-CA',{timeZone:CONFIG.TZ}).format(new Date(p.creada_en));
    if(dia !== ultimo){
      ultimo = dia;
      h += `<div class="sep-dia"><span class="lbl">${dia === S.fecha ? 'hoy' : esc(fechaCorta(dia))}</span>
        <span class="cenefa"></span></div>`;
    }
    h += pintarPost(p);
  }
  return h;
}

function pintarPost(p){
  const per = p.persona || {nombre_corto:'—'};
  const mio = S.yo && per.id === S.yo.id;
  const sistema = p.tipo !== 'usuario';
  const lib = libDe(per.libreria_id);
  if(p.retirada_en){
    return `<div class="post retirada">${avatar(per,36)}
      <div class="cuerpo"><div class="cab"><b>${esc(per.nombre_corto)}</b></div>
      <div class="txt">Publicación retirada por la coordinación.</div></div></div>`;
  }
  return `<div class="post ${sistema ? 'sistema' : ''}">
    ${avatar(per, 36)}
    <div class="cuerpo">
      <div class="cab">
        <b>${esc(per.nombre_corto)}</b>
        ${lib ? `<span class="marca" style="background:${esc(lib.color)}">${esc(lib.nombre.split(' ')[0])}</span>` : ''}
        <time>${horaDe(p.creada_en)}</time>
        ${p.editada_en ? '<time>· editado</time>' : ''}
      </div>
      <div class="txt">${sistema ? esc(per.nombre_corto) + ' ' : ''}${esc(p.texto)}</div>
      ${(mio && !sistema) || (S.yo?.es_admin && !sistema) ? `<div class="acc">
        ${mio ? `<button data-editar="${p.id}">Editar</button>
                 <button data-borrar="${p.id}">Borrar</button>` : ''}
        ${!mio && S.yo?.es_admin ? `<button data-retirar="${p.id}">Retirar</button>` : ''}
      </div>` : ''}
    </div></div>`;
}

/* =====================================================================
   PARRILLA (rango completo)
   ===================================================================== */
function vistaParrilla(){
  const [desde, hasta] = rangoParrilla();
  const dias = diasDe(desde, hasta);
  const gente = S.personas.filter(p => p.libreria_id === S.libreriaVista);
  const letra = {manana:'M', tarde:'T', completa:'C', compensacion:'✳', personalizado:'•', libre:'·'};

  let h = `<div class="bloque"><span class="lbl">parrilla · ${esc(fechaCorta(desde))} a ${esc(fechaCorta(hasta))}</span>
    <div style="overflow-x:auto;margin:0 -16px;padding:0 16px">
    <table style="border-collapse:separate;border-spacing:2px;font-size:.6rem">
    <thead><tr><th style="position:sticky;left:0;background:var(--superficie);z-index:2"></th>` +
    dias.map(d => `<th style="font-family:var(--mono);font-size:.55rem;color:var(--tenue);
      padding:2px">${DOW[dowDe(d)].slice(0,2)}<br>${new Date(d+'T12:00:00Z').getUTCDate()}</th>`).join('') +
    `</tr></thead><tbody>`;

  for(const p of gente){
    h += `<tr><td style="position:sticky;left:0;background:var(--superficie);z-index:2;
      font-size:.68rem;font-weight:500;padding-right:8px;white-space:nowrap">${esc(p.nombre_corto)}</td>`;
    for(const d of dias){
      const t = S.turnosRango.find(x => x.persona_id === p.id && x.fecha === d);
      if(!t || t.tipo === 'libre' || !t.inicio){
        h += `<td><div style="width:28px;height:24px;border-radius:5px;background:#F2F1EC;
          display:grid;place-items:center;color:var(--linea-fuerte)">·</div></td>`;
      } else {
        h += `<td><div class="barra ${esc(t.tipo)}" style="position:static;width:28px;height:24px;
          display:grid;place-items:center;padding:0;font-size:.6rem"
          title="${esc(p.nombre_corto)} ${fmt(min(t.inicio))}–${fmt(min(t.fin))}">
          ${letra[t.tipo] || '•'}</div></td>`;
      }
    }
    h += `</tr>`;
  }
  h += `</tbody></table></div>
    <div class="leyenda" style="margin-left:0">
      <span><i style="background:var(--amarillo)"></i>M mañana</span>
      <span><i style="background:var(--cobalto)"></i>T tarde</span>
      <span><i style="background:var(--coral)"></i>C completa</span>
      <span><i style="background:var(--lima)"></i>✳ compensación</span>
    </div></div>`;

  /* horas pactadas de cada quien en el rango */
  h += `<div class="bloque"><span class="lbl">horas pactadas en el período</span><ul class="lista">` +
    gente.map(p => {
      const hs = S.turnosRango.filter(t => t.persona_id === p.id).reduce((s,t) => {
        if(!t.inicio || !t.fin) return s;
        return s + (min(t.fin) - min(t.inicio) - (t.descanso_min||0))/60;
      }, 0);
      return `<li>${avatar(p,36)}<div class="info"><b>${esc(p.nombre)}</b>
        <span>${S.turnosRango.filter(t => t.persona_id === p.id && t.inicio).length} jornadas</span></div>
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
    <div class="cab">
      <span class="lbl">${nom[a.tipo] || 'Aviso'}${a.fijado ? ' · fijado' : ''}</span>
      <span class="chip" style="background:${l ? esc(l.color) : 'var(--linea-fuerte)'};
        ${l ? '' : 'color:var(--tinta)'}">${l ? esc(l.nombre.split(' ')[0]) : 'toda la red'}</span>
    </div>
    <b>${esc(a.titulo)}</b>
    ${a.cifra ? `<div class="cifra">${esc(a.cifra)}</div>` : ''}
    ${a.texto ? `<p>${esc(a.texto)}</p>` : ''}
  </div>`;
}

function vistaTablero(){
  let h = '';
  if(!S.avisos.length){
    h += `<div class="bloque" style="text-align:center;padding:32px 16px">
      ${criatura(72,'var(--coral)','var(--amarillo)')}
      <p class="nota" style="margin-top:12px">El tablero está vacío.
      La coordinación puede publicar avisos, cifras y recomendaciones.</p></div>`;
  } else {
    h += `<div class="bloque"><span class="lbl">tablero de la red</span>` +
      S.avisos.map(pintarAviso).join('') + `</div>`;
  }
  return h;
}

/* =====================================================================
   PERFIL
   ===================================================================== */
async function vistaPerfil(){
  const p = S.yo;
  const [j, l] = await Promise.all([
    sb.from('jornadas').select('*').eq('persona_id', p.id).order('fecha',{ascending:false}).limit(60),
    sb.from('liquidaciones').select('*').eq('persona_id', p.id).order('creada_en',{ascending:false})
  ]);
  const J = j.data || [], LQ = l.data || [];
  const totalPact = J.reduce((s,x) => s + (+x.horas_pactadas || 0), 0);
  const totalExtra = J.reduce((s,x) => s + (+x.extra_aprobada || 0), 0);
  const pendiente = J.filter(x => x.extra_estado === 'pendiente')
                     .reduce((s,x) => s + (+x.extra_calculada || 0), 0);

  let h = `<div class="bloque" style="text-align:center">
    ${avatar(p, 56, enSala(p.id) ? 'sala' : null)}
    <h3 style="margin-top:10px">${esc(p.nombre)}</h3>
    <p class="nota">${esc(libDe(p.libreria_id)?.nombre || '')}${p.es_admin ? ' · coordinación' : ''}</p>
  </div>`;

  h += `<div class="bloque"><span class="lbl">mis horas</span>
    <div style="display:flex;gap:26px;flex-wrap:wrap">
      <div><div style="font-size:1.9rem;font-weight:800;letter-spacing:-.04em">${horas(totalPact+totalExtra)}</div>
        <div class="lbl">acumuladas</div></div>
      <div><div style="font-size:1.9rem;font-weight:800;letter-spacing:-.04em">${horas(totalExtra)}</div>
        <div class="lbl">extra aprobadas</div></div>
    </div>
    ${pendiente > 0 ? `<p class="nota" style="margin-top:10px">Tienes ${horas(pendiente)}
      esperando aprobación de la coordinación.</p>` : ''}
  </div>`;

  h += `<div class="bloque"><span class="lbl">mis misiones</span><ul class="lista">` +
    (J.filter(x => x.mision_reto).slice(0,20).map(x => `<li>
      <div class="info"><b>${esc(fechaCorta(x.fecha))}</b>
      <span>${esc(x.mision_reto)}</span></div>
      <div class="dato">${x.cierre_en ? '✓' : '·'}</div></li>`).join('')
      || `<li><div class="info"><span>Todavía no tienes misiones. Salen al saludar.</span></div></li>`) +
    `</ul></div>`;

  h += `<div class="bloque"><span class="lbl">mis jornadas</span><ul class="lista">` +
    (J.slice(0,20).map(x => `<li><div class="info">
      <b>${esc(fechaLarga(x.fecha))}</b>
      <span>${x.saludo_en ? horaDe(x.saludo_en) : '—'} a ${x.cierre_en ? horaDe(x.cierre_en) : '—'}
      ${x.cierre_estimado ? ' · cierre estimado' : ''}
      ${x.extra_aprobada > 0 ? ' · ' + horas(x.extra_aprobada) + ' extra' : ''}</span></div>
      <div class="dato">${horas((+x.horas_pactadas||0) + (+x.extra_aprobada||0))}</div></li>`).join('')
      || `<li><div class="info"><span>Sin jornadas registradas.</span></div></li>`) +
    `</ul></div>`;

  if(LQ.length){
    h += `<div class="bloque"><span class="lbl">mis liquidaciones</span><ul class="lista">` +
      LQ.map(x => `<li><div class="info"><b>${esc(fechaCorta(x.desde))} a ${esc(fechaCorta(x.hasta))}</b>
        <span>${horas(+x.horas_pactadas + +x.horas_extra)} · ${esc(x.estado)}</span></div>
        <div class="dato">${pesos(x.total)}</div></li>`).join('') + `</ul></div>`;
  }

  h += `<div class="bloque"><div class="btn-fila" style="margin-top:0">
    <button class="btn sec" id="cambiarClave">Cambiar mi contraseña</button>
    <button class="btn sec" id="salir">Cerrar sesión</button>
  </div></div>`;
  return h;
}

/* =====================================================================
   ACCIONES DE JORNADA
   ===================================================================== */
async function accionSaludar(){
  const m = mensajes.mision(S.yo, S.fecha);
  const saludo = mensajes.saludo(S.yo, S.fecha);
  const bien = mensajes.bienvenida(S.yo, S.fecha);
  const b = document.getElementById('btnSaludar'); if(b) b.disabled = true;

  const { data, error } = await sb.rpc('saludar', {
    p_mision_reto: m.reto, p_mision_cumplida: m.cumplida, p_saludo: saludo });
  if(error){ brindis(error.message); if(b) b.disabled = false; return; }

  const emojis = ['📚','🌻','🐙','✨','🦋','🕯️','🎭','🧭','🪄','🐚','🌙','🎈'];
  brindis('¡Buen día, ' + S.yo.nombre_corto + '!');
  const v = modal(`
    <div class="emo-grande">${emojis[Math.floor(Math.random()*emojis.length)]}</div>
    <h3>${esc(bien)}</h3>
    <div class="mision">
      <span class="lbl">tu misión del día</span>
      <p>${esc(m.reto)}</p>
    </div>
    <div class="btn-fila"><button class="btn" style="flex:1" id="cerrarModal">A trabajar</button></div>
    <p class="nota" style="text-align:center;margin-top:10px">La vuelves a ver en tu perfil.</p>`);
  v.querySelector('#cerrarModal').onclick = () => v.remove();

  await cargarTodo(); await cargarFeed(); render();
}

async function accionDescanso(){
  const { error } = await sb.rpc('marcar_descanso');
  if(error) return brindis(error.message);
  brindis('Buen provecho. Descanso marcado.');
  await cargarLibreria(); render();
}

async function accionCerrar(){
  const m = S.miJornada?.mision_cumplida || 'sostener el salón un día más';
  const v = modal(`
    <div class="emo-grande">🏁</div>
    <h3>¿Cerramos tu jornada?</h3>
    <p class="nota" style="text-align:center;margin-top:8px">
      En el feed va a quedar que cumpliste la misión de ${esc(m)}.</p>
    <div class="btn-fila">
      <button class="btn" style="flex:1" id="siCerrar">Misión cumplida</button>
      <button class="btn sec" id="noCerrar">Todavía no</button>
    </div>`);
  v.querySelector('#noCerrar').onclick = () => v.remove();
  v.querySelector('#siCerrar').onclick = async () => {
    v.querySelector('#siCerrar').disabled = true;
    const { error } = await sb.rpc('cerrar_jornada');
    v.remove();
    if(error) return brindis(error.message);
    brindis('Hasta mañana. Jornada cerrada.');
    await cargarTodo(); await cargarFeed(); render();
  };
}

async function cargarFeed(){
  const r = await sb.from('publicaciones')
    .select('*, persona:personas(id,nombre,nombre_corto,avatar,avatar_v,libreria_id)')
    .order('creada_en',{ascending:false}).limit(120);
  S.feed = r.data || [];
}

/* =====================================================================
   PANEL DE GESTIÓN
   ===================================================================== */
async function vistaAdmin(){
  const l = libDe(S.libreriaVista);
  const gente = S.personas.filter(p => p.libreria_id === S.libreriaVista);
  const cerrado = !!S.dia?.cerrado;

  let h = `<div class="bloque">
    <span class="lbl">gestionando</span>
    <select id="admLib">${S.librerias.map(x =>
      `<option value="${x.id}"${x.id===S.libreriaVista?' selected':''}>${esc(x.nombre)}</option>`).join('')}</select>
    <div class="btn-fila"><button class="btn sec mini" id="nuevaLib">Crear librería</button>
      <button class="btn sec mini" id="editarLib">Configurar esta</button></div>
  </div>`;

  /* --- advertencias de cobertura --- */
  const cob = cobertura(), mn = minimoHoy();
  const flojas = [];
  let act = null;
  for(const c of cob){
    if(c.n < mn){ if(act && act.fin === c.m) act.fin = c.m+30;
                  else { act = {ini:c.m, fin:c.m+30, n:c.n}; flojas.push(act); }
                  act.n = Math.min(act.n, c.n); }
    else act = null;
  }
  h += `<div class="bloque"><span class="lbl">cobertura de hoy</span>` +
    (flojas.length
      ? flojas.map(f => `<div class="alerta"><b>${fmt(f.ini)} a ${fmt(f.fin)}</b>
          <p>Solo ${f.n} en sala, por debajo del mínimo de ${mn}.</p></div>`).join('')
      : `<div class="bien">Todas las franjas de hoy cumplen el mínimo de ${mn}.</div>`) +
    `</div>`;

  /* --- cierre del día y caja --- */
  h += `<div class="bloque">
    <span class="lbl">cierre del día · ${esc(fechaLarga(S.fecha))}</span>
    <h3>${cerrado ? 'Día cerrado' : 'Día abierto'}</h3>
    <p class="nota">${cerrado
      ? 'Los botones de marcar están apagados para todo el equipo hasta las '
        + (l?.reactivar_a?.slice(0,5) || '08:00') + ' de mañana.'
      : 'Al cerrar se apagan los botones de marcar de todo el equipo.'}</p>`;
  const abiertas = gente.filter(p => {
    const j = S.jornadasHoy.find(x => x.persona_id === p.id);
    return j?.saludo_en && !j.cierre_en; });
  if(!cerrado && abiertas.length){
    h += `<div class="alerta" style="margin-top:10px"><b>${abiertas.length}
      ${abiertas.length===1?'jornada abierta':'jornadas abiertas'}</b>
      <p>${abiertas.map(p => esc(p.nombre_corto)).join(', ')} no
      ${abiertas.length===1?'ha marcado':'han marcado'} Misión cumplida.
      Si cierras ahora, ${abiertas.length===1?'su jornada queda marcada':'sus jornadas quedan marcadas'}
      como estimada.</p></div>`;
  }
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
    <div class="btn-fila">
      <button class="btn sec" id="guardarVentas">Guardar cifras</button>
      ${cerrado ? `<button class="btn peligro" id="reabrirDia">Reabrir el día</button>`
                : `<button class="btn" id="cerrarDia">Cerrar el día</button>`}
    </div></div>`;

  /* --- horas extra pendientes --- */
  const pend = S.jornadasHoy.filter(j => j.extra_estado === 'pendiente');
  h += `<div class="bloque"><span class="lbl">horas extra de hoy</span>`;
  if(!pend.length) h += `<div class="bien">Nadie pasó de su turno hoy.</div>`;
  else h += pend.map(j => {
    const p = S.personas.find(x => x.id === j.persona_id);
    return `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;
      border-bottom:1px solid var(--linea)">
      ${avatar(p,36)}
      <div style="flex:1;min-width:0"><b style="font-size:.84rem">${esc(p?.nombre_corto)}</b>
        <div class="nota">Cerró a las ${horaDe(j.cierre_en)} · calculadas ${horas(j.extra_calculada)}</div>
        <div class="pasos" style="margin-top:6px">
          <button data-menos="${j.id}">−</button>
          <span class="val" id="ex-${j.id}">${(+j.extra_calculada).toFixed(2).replace('.',',')}</span>
          <button data-mas="${j.id}">+</button>
        </div>
      </div>
      <div style="display:grid;gap:5px">
        <button class="btn mini" data-aprobar="${j.id}">Aprobar</button>
        <button class="btn sec mini" data-rechazar="${j.id}">Rechazar</button>
      </div></div>`;
  }).join('');
  h += `</div>`;

  /* --- personal --- */
  h += `<div class="bloque"><span class="lbl">personal de ${esc(l?.nombre)}</span><ul class="lista">` +
    gente.map(p => {
      const e = estadoDe(p.id);
      return `<li>${avatar(p,36,e.clave)}
        <div class="info"><b>${esc(p.nombre)}${p.es_admin?' · coordinación':''}</b>
        <span>${esc(e.txt)}${p.correo?'':' · sin correo, no puede entrar'}</span></div>
        <button class="btn sec mini" data-editar-persona="${p.id}">Editar</button></li>`;
    }).join('') + `</ul>
    <div class="btn-fila"><button class="btn" id="nuevaPersona">Agregar persona</button>
      <button class="btn sec" id="verHorarios">Administrar horarios</button>
      <button class="btn sec" id="verLiquidacion">Liquidar honorarios</button></div></div>`;

  /* --- tablero --- */
  h += `<div class="bloque"><span class="lbl">publicar en el tablero</span>
    <label class="campo" for="avTipo">Tipo</label>
    <select id="avTipo">
      <option value="meta">Cifra</option><option value="libro">Recomendación de venta</option>
      <option value="aviso">Aviso operativo</option><option value="animo">Para el equipo</option>
    </select>
    <label class="campo" for="avLib">Asociado a</label>
    <select id="avLib"><option value="">Toda la red</option>${S.librerias.map(x =>
      `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select>
    <label class="campo" for="avTit">Título</label><input type="text" id="avTit">
    <label class="campo" for="avCif">Número destacado (opcional)</label><input type="text" id="avCif">
    <label class="campo" for="avTex">Texto</label><textarea id="avTex"></textarea>
    <label class="campo" for="avHasta">Vigente hasta (opcional)</label><input type="date" id="avHasta">
    <div class="btn-fila">
      <button class="btn" id="avPublicar">Publicar</button>
      <label style="display:flex;align-items:center;gap:6px;font-size:.78rem">
        <input type="checkbox" id="avFijar"> Fijar arriba</label>
    </div>`;
  if(S.avisos.length){
    h += `<div style="margin-top:18px"><span class="lbl">publicados</span></div>` +
      S.avisos.map(a => `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;
        border-bottom:1px solid var(--linea)">
        <div style="flex:1"><b style="font-size:.8rem">${esc(a.titulo)}</b>
        <div class="nota">${esc((a.texto||'').slice(0,70))}${(a.texto||'').length>70?'…':''}</div></div>
        <button class="btn sec mini" data-fijar="${a.id}">${a.fijado?'Soltar':'Fijar'}</button>
        <button class="btn peligro mini" data-quitar-aviso="${a.id}">Quitar</button></div>`).join('');
  }
  h += `</div>`;
  return h;
}

/* ---- formularios del panel ---- */
function formPersona(p){
  const nuevo = !p;
  const v = modal(`
    <h3>${nuevo ? 'Agregar al equipo' : esc(p.nombre)}</h3>
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
    <div style="display:flex;gap:5px;flex-wrap:wrap">${
      ['D','L','M','X','J','V','S'].map((d,i) => {
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
      <button class="btn sec" id="fCancelar">Cancelar</button>
    </div>
    ${!nuevo ? `<div class="btn-fila">
      <button class="btn peligro mini" id="fDesactivar">Retirar del equipo</button></div>
      <p class="nota" style="margin-top:8px">Retirar no borra: conserva sus horas,
      sus publicaciones y sus liquidaciones.</p>` : ''}`);

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
    if(tar) await sb.from('tarifas').insert({ persona_id: r.data.id, valor_hora: +tar,
      vigente_desde: datos.fecha_ingreso, creada_por: S.yo.id });

    v.remove();
    await cargarTodo();
    if(!p) sugerirTurnos(r.data); else render();
  };
  const des = v.querySelector('#fDesactivar');
  if(des) des.onclick = async () => {
    if(!confirm('¿Retirar a ' + p.nombre + ' del equipo activo?')) return;
    await sb.from('personas').update({ activa:false, fecha_salida:S.fecha }).eq('id', p.id);
    v.remove(); await cargarTodo(); render();
  };
}

/* Turnos sugeridos para quien entra a mitad de camino: arranca al día
   siguiente en la mañana y alterna, como el resto. El admin desliza y aprueba. */
function sugerirTurnos(persona){
  const l = libDe(persona.libreria_id);
  const [d0, d1] = (l?.modo_fiesta && l.evento_inicio && l.evento_fin)
    ? [l.evento_inicio, l.evento_fin] : rangoParrilla();
  const manana = new Date(Date.parse(S.fecha+'T00:00:00Z') + 86400000).toISOString().slice(0,10);
  const desde = manana > d0 ? manana : d0;
  const dias = diasDe(desde, d1).filter(d => (persona.dias_trabajo||[0,1,2,3,4,5,6]).includes(dowDe(d)));
  const dur = +persona.horas_dia || 8;
  const apertura = min(l?.apertura || '09:30'), cierre = min(l?.cierre || '21:00');
  const descanso = l?.descanso_min ?? 60;

  const prop = dias.map((d,i) => ({
    fecha: d,
    tipo: i % 2 === 0 ? 'manana' : 'tarde',
    inicio: i % 2 === 0 ? apertura : Math.max(apertura, cierre - dur*60 - descanso)
  }));

  const pintar = () => prop.map((t,i) => {
    const fin = t.inicio + dur*60 + descanso;
    return `<div style="padding:10px 0;border-bottom:1px solid var(--linea)">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <b style="font-size:.8rem">${esc(fechaLarga(t.fecha))}</b>
        <span class="dato">${fmt(t.inicio)} – ${fmt(fin)}</span></div>
      <input type="range" min="${apertura}" max="${cierre - dur*60 - descanso}" step="30"
        value="${t.inicio}" data-slider="${i}" style="width:100%;padding:0;border:none;margin-top:6px">
    </div>`;
  }).join('');

  const v = modal(`
    <h3>Turnos sugeridos</h3>
    <p class="nota" style="margin-top:6px">${esc(persona.nombre)} · ${dur} h por día.
    Desliza cada jornada para mover la hora de entrada. Al aprobar se incrusta en la
    parrilla sin tocar los turnos de los demás.</p>
    <div id="listaProp" style="margin-top:12px;max-height:46vh;overflow-y:auto">${pintar()}</div>
    <div class="err" id="pErr"></div>
    <div class="btn-fila">
      <button class="btn" style="flex:1" id="pAprobar">Aprobar los ${prop.length} turnos</button>
      <button class="btn sec" id="pCancelar">Después</button>
    </div>`);

  const enlazarSliders = () => v.querySelectorAll('[data-slider]').forEach(s => {
    s.oninput = () => {
      prop[+s.dataset.slider].inicio = +s.value;
      const cont = v.querySelector('#listaProp');
      const scroll = cont.scrollTop;
      cont.innerHTML = pintar(); enlazarSliders(); cont.scrollTop = scroll;
    };
  });
  enlazarSliders();

  v.querySelector('#pCancelar').onclick = () => { v.remove(); render(); };
  v.querySelector('#pAprobar').onclick = async () => {
    const filas = prop.map(t => ({
      persona_id: persona.id, fecha: t.fecha, tipo: t.tipo,
      inicio: String(Math.floor(t.inicio/60)).padStart(2,'0')+':'+String(t.inicio%60).padStart(2,'0'),
      fin: (() => { const f = t.inicio + dur*60 + descanso;
        return String(Math.floor(f/60)).padStart(2,'0')+':'+String(f%60).padStart(2,'0'); })(),
      descanso_inicio: (() => { const c = t.inicio + Math.round(dur*60/2);
        return String(Math.floor(c/60)).padStart(2,'0')+':'+String(c%60).padStart(2,'0'); })(),
      descanso_min: descanso, fijo: true, aprobado: true, actualizado_por: S.yo.id
    }));
    const r = await sb.from('turnos').upsert(filas, { onConflict:'persona_id,fecha' });
    if(r.error) return v.querySelector('#pErr').textContent = r.error.message;
    v.remove(); brindis('Turnos incrustados en la parrilla');
    await cargarTodo(); render();
  };
}

async function panelHorarios(){
  const [d0, d1] = rangoParrilla();
  await cargarRango(d0, d1);
  const gente = S.personas.filter(p => p.libreria_id === S.libreriaVista);
  const l = libDe(S.libreriaVista);
  const apertura = min(l?.apertura||'09:30'), cierre = min(l?.cierre||'21:00');

  const v = modal(`
    <h3>Administrar horarios</h3>
    <p class="nota" style="margin-top:6px">Elige una jornada y deslízala.
    La app avisa si se desequilibra la sala, pero nunca te lo impide.</p>
    <label class="campo" for="hDia">Día</label>
    <select id="hDia">${diasDe(d0,d1).map(d =>
      `<option value="${d}"${d===S.fecha?' selected':''}>${esc(fechaLarga(d))}</option>`).join('')}</select>
    <div id="hLista" style="margin-top:14px;max-height:46vh;overflow-y:auto"></div>
    <div id="hAviso"></div>
    <div class="btn-fila"><button class="btn" style="flex:1" id="hCerrar">Listo</button></div>`);

  const dibujar = () => {
    const dia = v.querySelector('#hDia').value;
    v.querySelector('#hLista').innerHTML = gente.map(p => {
      const t = S.turnosRango.find(x => x.persona_id === p.id && x.fecha === dia);
      const ini = t?.inicio ? min(t.inicio) : apertura;
      const dur = t ? (min(t.fin) - min(t.inicio)) : (+p.horas_dia*60 + 60);
      return `<div style="padding:11px 0;border-bottom:1px solid var(--linea)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <b style="font-size:.8rem">${esc(p.nombre_corto)}</b>
          <span class="dato" id="hr-${p.id}">${t?.inicio ? fmt(ini)+' – '+fmt(ini+dur) : 'Libre'}</span>
        </div>
        <input type="range" min="${apertura}" max="${Math.max(apertura, cierre-dur)}" step="30"
          value="${ini}" data-mover="${p.id}" data-dur="${dur}"
          style="width:100%;padding:0;border:none;margin-top:6px" ${t?.inicio?'':'disabled'}>
      </div>`;
    }).join('');

    v.querySelectorAll('[data-mover]').forEach(s => {
      s.oninput = () => {
        const ini = +s.value, dur = +s.dataset.dur;
        v.querySelector('#hr-'+s.dataset.mover).textContent = fmt(ini)+' – '+fmt(ini+dur);
      };
      s.onchange = async () => {
        const ini = +s.value, dur = +s.dataset.dur, dia = v.querySelector('#hDia').value;
        const hhmm = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
        const t = S.turnosRango.find(x => x.persona_id === s.dataset.mover && x.fecha === dia);
        const desp = t?.descanso_inicio ? min(t.descanso_inicio) - min(t.inicio) : Math.round(dur/2);
        await sb.from('turnos').update({
          inicio: hhmm(ini), fin: hhmm(ini+dur),
          descanso_inicio: hhmm(ini+desp), fijo: true, actualizado_por: S.yo.id
        }).eq('persona_id', s.dataset.mover).eq('fecha', dia);
        await cargarRango(d0, d1);
        if(dia === S.fecha) await cargarLibreria();
        avisar();
      };
    });
    avisar();
  };

  const avisar = () => {
    const dia = v.querySelector('#hDia').value;
    const turnos = S.turnosRango.filter(t => t.fecha === dia && t.inicio);
    const mn = (dowDe(dia) === 0 || dowDe(dia) === 6)
             ? (l?.minimo_finde ?? 4) : (l?.minimo_semana ?? 3);
    const flojas = [];
    for(let m = apertura; m < cierre; m += 30){
      let n = 0;
      for(const t of turnos){
        const a = min(t.inicio), b = min(t.fin);
        if(m < a || m >= b) continue;
        if(t.descanso_inicio){ const d = min(t.descanso_inicio);
          if(m >= d && m < d + t.descanso_min) continue; }
        n++;
      }
      if(n < mn) flojas.push({m, n});
    }
    v.querySelector('#hAviso').innerHTML = flojas.length
      ? `<div class="alerta"><b>${flojas.length} franjas por debajo del mínimo</b>
         <p>La más floja: ${fmt(flojas.reduce((a,b)=>b.n<a.n?b:a).m)} con
         ${Math.min(...flojas.map(f=>f.n))} en sala. El mínimo de este día es ${mn}.
         Puedes dejarlo así si es lo que necesitas.</p></div>`
      : `<div class="bien">La cobertura de este día cumple el mínimo de ${mn}.</div>`;
  };

  v.querySelector('#hDia').onchange = dibujar;
  v.querySelector('#hCerrar').onclick = async () => { v.remove(); await cargarTodo(); render(); };
  dibujar();
}

async function panelLiquidacion(){
  const gente = S.personas.filter(p => p.libreria_id === S.libreriaVista);
  const [d0, d1] = rangoParrilla();
  const v = modal(`
    <h3>Liquidar honorarios</h3>
    <label class="campo" for="lqP">Persona</label>
    <select id="lqP">${gente.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select>
    <label class="campo" for="lqD">Desde</label><input type="date" id="lqD" value="${d0}">
    <label class="campo" for="lqH">Hasta</label><input type="date" id="lqH" value="${d1}">
    <div class="btn-fila"><button class="btn sec" id="lqVer">Previsualizar</button></div>
    <div id="lqRes" style="margin-top:14px"></div>
    <div class="err" id="lqErr"></div>
    <div class="btn-fila"><button class="btn sec" id="lqCerrar">Cerrar</button></div>`);

  v.querySelector('#lqCerrar').onclick = () => v.remove();
  v.querySelector('#lqVer').onclick = async () => {
    const args = { p_persona: v.querySelector('#lqP').value,
      p_desde: v.querySelector('#lqD').value, p_hasta: v.querySelector('#lqH').value };
    const { data, error } = await sb.rpc('previsualizar_liquidacion', args);
    if(error) return v.querySelector('#lqErr').textContent = error.message;
    if(!data?.length) return v.querySelector('#lqRes').innerHTML =
      `<div class="bien">No hay jornadas pendientes de liquidar en ese rango.</div>`;
    const tot = data.reduce((s,x) => s + (+x.subtotal), 0);
    const th = data.reduce((s,x) => s + (+x.horas) + (+x.extra) - (+x.descuento), 0);
    v.querySelector('#lqRes').innerHTML = `<ul class="lista">` +
      data.map(x => `<li><div class="info"><b>${esc(fechaCorta(x.fecha))}</b>
        <span>${horas(+x.horas)}${+x.extra ? ' + '+horas(+x.extra)+' extra' : ''}
        ${+x.descuento ? ' − '+horas(+x.descuento) : ''} × ${pesos(x.tarifa)}</span></div>
        <div class="dato">${pesos(x.subtotal)}</div></li>`).join('') +
      `</ul>
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
  const v = modal(`
    <h3>${l ? 'Configurar ' + esc(l.nombre) : 'Nueva librería'}</h3>
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
    <label class="campo" for="cTar">Valor hora base</label>
    <input type="number" id="cTar" step="500" placeholder="15000">
    <label class="campo" style="display:flex;align-items:center;gap:7px;text-transform:none;
      letter-spacing:0;font-size:.86rem;font-family:'Archivo'">
      <input type="checkbox" id="cFiesta"${l?.modo_fiesta?' checked':''}> Modo evento encendido</label>
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
    <div class="btn-fila">
      <button class="btn" style="flex:1" id="cGuardar">Guardar</button>
      <button class="btn sec" id="cCancelar">Cancelar</button>
    </div>`);
  v.querySelector('#cFiesta').onchange = e =>
    v.querySelector('#cEvento').classList.toggle('oculto', !e.target.checked);
  v.querySelector('#cCancelar').onclick = () => v.remove();
  v.querySelector('#cGuardar').onclick = async () => {
    const d = {
      nombre: v.querySelector('#cNom').value.trim(),
      slug: v.querySelector('#cSlug').value.trim().toLowerCase().replace(/\s+/g,'-'),
      color: v.querySelector('#cCol').value,
      apertura: v.querySelector('#cAp').value, cierre: v.querySelector('#cCi').value,
      descanso_min: +v.querySelector('#cDes').value,
      minimo_semana: +v.querySelector('#cMs').value, minimo_finde: +v.querySelector('#cMf').value,
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
    if(tar) await sb.from('tarifas').insert({ libreria_id: r.data.id, valor_hora:+tar,
      vigente_desde: S.fecha, creada_por: S.yo.id });
    v.remove(); S.libreriaVista = r.data.id; await cargarTodo(); render();
  };
}

/* =====================================================================
   RENDER Y EVENTOS
   ===================================================================== */
async function render(){
  const app = document.getElementById('app');
  document.getElementById('tabs').classList.remove('oculto');
  document.getElementById('cabecera').classList.remove('oculto');
  document.getElementById('tabAdmin').classList.toggle('oculto', !S.yo?.es_admin);
  document.querySelectorAll('nav.tabs button').forEach(b =>
    b.classList.toggle('act', b.dataset.v === S.vista));
  pintarCabecera();

  if(S.vista === 'parrilla'){ const [a,b] = rangoParrilla(); await cargarRango(a,b); }

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
    S.libreriaVista = b.dataset.irLib; await cargarLibreria(); render();
  });

  /* feed */
  on('publicar', async () => {
    const t = el('nuevoPost').value.trim(); if(!t) return;
    el('publicar').disabled = true;
    const r = await sb.from('publicaciones').insert({ persona_id: S.yo.id,
      libreria_id: S.yo.libreria_id, tipo:'usuario', texto: t });
    if(r.error) { brindis(r.error.message); el('publicar').disabled = false; return; }
    await cargarFeed(); render();
  });
  document.querySelectorAll('[data-borrar]').forEach(b => b.onclick = async () => {
    if(!confirm('¿Borrar tu publicación?')) return;
    await sb.from('publicaciones').delete().eq('id', b.dataset.borrar);
    await cargarFeed(); render();
  });
  document.querySelectorAll('[data-retirar]').forEach(b => b.onclick = async () => {
    if(!confirm('¿Retirar esta publicación? Queda la huella, no desaparece.')) return;
    await sb.from('publicaciones').update({ retirada_en:new Date().toISOString(),
      retirada_por: S.yo.id }).eq('id', b.dataset.retirar);
    await cargarFeed(); render();
  });
  document.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => {
    const p = S.feed.find(x => x.id === b.dataset.editar);
    const v = modal(`<h3>Editar publicación</h3>
      <textarea id="edTxt">${esc(p.texto)}</textarea>
      <div class="btn-fila"><button class="btn" style="flex:1" id="edOk">Guardar</button>
      <button class="btn sec" id="edNo">Cancelar</button></div>`);
    v.querySelector('#edNo').onclick = () => v.remove();
    v.querySelector('#edOk').onclick = async () => {
      await sb.from('publicaciones').update({ texto: v.querySelector('#edTxt').value.trim(),
        editada_en: new Date().toISOString() }).eq('id', p.id);
      v.remove(); await cargarFeed(); render();
    };
  });

  /* perfil */
  on('salir', async () => { await sb.auth.signOut(); location.reload(); });
  on('cambiarClave', () => {
    const v = modal(`<h3>Cambiar contraseña</h3>
      <label class="campo" for="nc">Nueva contraseña</label>
      <input type="password" id="nc" autocomplete="new-password">
      <div class="err" id="ncErr"></div>
      <div class="btn-fila"><button class="btn" style="flex:1" id="ncOk">Guardar</button>
      <button class="btn sec" id="ncNo">Cancelar</button></div>`);
    v.querySelector('#ncNo').onclick = () => v.remove();
    v.querySelector('#ncOk').onclick = async () => {
      const p = v.querySelector('#nc').value;
      if(p.length < 8) return v.querySelector('#ncErr').textContent = 'Mínimo 8 caracteres.';
      const r = await sb.auth.updateUser({ password: p });
      if(r.error) return v.querySelector('#ncErr').textContent = r.error.message;
      v.remove(); brindis('Contraseña actualizada');
    };
  });

  /* ---- panel de gestión ---- */
  const sl = el('admLib');
  if(sl) sl.onchange = async () => { S.libreriaVista = sl.value; await cargarLibreria(); render(); };
  on('nuevaLib', () => formLibreria(null));
  on('editarLib', () => formLibreria(libDe(S.libreriaVista)));
  on('nuevaPersona', () => formPersona(null));
  on('verHorarios', panelHorarios);
  on('verLiquidacion', panelLiquidacion);
  document.querySelectorAll('[data-editar-persona]').forEach(b => b.onclick = () =>
    formPersona(S.personas.find(p => p.id === b.dataset.editarPersona)));

  on('guardarVentas', async () => {
    const ej = el('vEj').value, ing = el('vIn').value;
    await sb.from('dias').upsert({ libreria_id:S.libreriaVista, fecha:S.fecha,
      ejemplares: ej === '' ? null : +ej, ingresos: ing === '' ? null : +ing,
      actualizado_por:S.yo.id, actualizado_en:new Date().toISOString()
    }, { onConflict:'libreria_id,fecha' });
    await sb.from('librerias').update({ ventas_visibles: el('vVis').value }).eq('id', S.libreriaVista);
    brindis('Cifras guardadas'); await cargarTodo(); render();
  });
  on('cerrarDia', async () => {
    if(!confirm('Al cerrar, los botones de marcar quedan apagados para todo el equipo. ¿Cerramos?')) return;
    const r = await sb.rpc('cerrar_dia', { p_libreria:S.libreriaVista, p_fecha:S.fecha });
    if(r.error) return brindis(r.error.message);
    brindis('Día cerrado'); await cargarTodo(); render();
  });
  on('reabrirDia', async () => {
    const r = await sb.rpc('reabrir_dia', { p_libreria:S.libreriaVista, p_fecha:S.fecha });
    if(r.error) return brindis(r.error.message);
    brindis('Día reabierto'); await cargarTodo(); render();
  });

  const paso = (id, d) => {
    const e = el('ex-'+id); if(!e) return;
    const n = Math.max(0, Math.round((parseFloat(e.textContent.replace(',','.')) + d)*4)/4);
    e.textContent = n.toFixed(2).replace('.',',');
  };
  document.querySelectorAll('[data-mas]').forEach(b => b.onclick = () => paso(b.dataset.mas, .25));
  document.querySelectorAll('[data-menos]').forEach(b => b.onclick = () => paso(b.dataset.menos, -.25));
  document.querySelectorAll('[data-aprobar]').forEach(b => b.onclick = async () => {
    const id = b.dataset.aprobar;
    const val = parseFloat(el('ex-'+id).textContent.replace(',','.')) || 0;
    await sb.from('jornadas').update({ extra_aprobada: val, extra_estado:'aprobada',
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
    const r = await sb.from('avisos').insert({
      libreria_id: el('avLib').value || null, tipo: el('avTipo').value, titulo: t,
      cifra: el('avCif').value.trim() || null, texto: el('avTex').value.trim() || null,
      vigente_hasta: el('avHasta').value || null, fijado: el('avFijar').checked,
      creado_por: S.yo.id });
    if(r.error) return brindis(r.error.message);
    brindis('Publicado en el tablero'); await cargarTodo(); render();
  });
  document.querySelectorAll('[data-quitar-aviso]').forEach(b => b.onclick = async () => {
    await sb.from('avisos').delete().eq('id', b.dataset.quitarAviso);
    await cargarTodo(); render();
  });
  document.querySelectorAll('[data-fijar]').forEach(b => b.onclick = async () => {
    const a = S.avisos.find(x => x.id === b.dataset.fijar);
    await sb.from('avisos').update({ fijado: !a.fijado }).eq('id', a.id);
    await cargarTodo(); render();
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
  await cargarTodo();
  render();
}

document.querySelectorAll('nav.tabs button').forEach(b =>
  b.onclick = () => { S.vista = b.dataset.v; render(); });

/* El reloj de la cabecera y el estado de sala se refrescan solos. */
setInterval(() => {
  const r = document.getElementById('relojTop');
  if(r) r.textContent = horaAhora();
}, 30000);
setInterval(async () => {
  if(S.yo && document.visibilityState === 'visible' && S.vista === 'inicio'){
    await cargarLibreria(); render();
  }
}, 120000);

arrancar();
