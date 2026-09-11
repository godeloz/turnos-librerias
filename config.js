/* =====================================================================
   CONFIGURACIÓN — el único archivo que tienes que editar
   ===================================================================== */

export const CONFIG = {

  // Supabase → Project Settings → API
  SUPABASE_URL:      'https://prrzlahfkhbamkudmwuc.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_JZg8ewpsj22IvuNc1o11Qg_Xt6-3Orj',

  // Carpeta de avatares, relativa a index.html.
  // 'avatar-diego' se convierte en 'img/avatar-diego.png'
  IMG_BASE: 'img/',
  IMG_EXT:  '.png',

  // Zona horaria de toda la operación
  TZ: 'America/Bogota',

  // Sube este número en cada publicación. Cambia la ruta de los archivos y
  // obliga a los navegadores a descargar la versión nueva en vez de la suya.
  VERSION: '7'
};
