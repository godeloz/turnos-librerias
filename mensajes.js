/* =====================================================================
   MENSAJES — Salón de Editoriales Independientes / red de librerías
   Tres mazos independientes. Cada persona recibe una baraja distinta,
   sembrada con su id + la fecha, y saca la carta del día.
   Con 50 cartas por mazo y eventos de 10 días, nadie repite.

   Reglas de redacción usadas:
   · BIENVENIDAS  → llevan {nombre}.
   · MISIONES     → pares. `reto` es lo que ve la persona en su ventana;
                    `cumplida` se inserta en "X cumplió la misión de ___".
                    Tienen que ser la misma frase o el feed no cuadra.
   · SALUDOS      → se anteponen al nombre: "Mariana " + saludo.
                    Sin participios ni adjetivos con género: así sirven
                    para cualquier integrante sin duplicar el mazo.
   ===================================================================== */

export const BIENVENIDAS = [
  "Bienvenida, {nombre}. Ojalá hoy los libros te hagan alucinar como al Quijote lo llevaron a pelear con molinos.",
  "Buen día, {nombre}. Que el salón te reciba con la abundancia de mariposas que perseguía a Mauricio Babilonia.",
  "Llegaste, {nombre}. Que hoy ninguna pregunta te encuentre sin respuesta, ni siquiera las de la Esfinge.",
  "Hola, {nombre}. Ojalá tu jornada tenga la paciencia de Penélope y ninguno de sus pretendientes.",
  "Buenos días, {nombre}. Que hoy encuentres el libro que alguien lleva años buscando sin saberlo.",
  "Bienvenida al día, {nombre}. Que el tiempo aquí pase como en la montaña mágica: sin que lo sientas.",
  "Aquí estás, {nombre}. Que el salón te resulte tan infinito como la biblioteca que imaginó Borges, pero mejor organizado.",
  "Buen día, {nombre}. Ojalá hoy no te toque ningún cliente con la terquedad del capitán Ahab.",
  "Hola, {nombre}. Que la jornada te sepa a la magdalena de Proust y no a las once horas que dura.",
  "Bienvenida, {nombre}. Que hoy prefieras hacerlo, al contrario de Bartleby.",
  "Buenos días, {nombre}. Que el salón te trate con la hospitalidad que Comala le negó a Juan Preciado.",
  "Llegaste, {nombre}. Ojalá hoy alguien te pregunte por un libro que amas y tengas quince minutos para contárselo.",
  "Buen día, {nombre}. Que ninguna metamorfosis te sorprenda antes del primer café.",
  "Hola, {nombre}. Que hoy el salón sea tu Macondo: fundado desde cero cada mañana.",
  "Bienvenida, {nombre}. Ojalá hoy vendas un libro que le cambie el año a alguien.",
  "Buenos días, {nombre}. Que tu jornada tenga más de Rayuela que de manual de instrucciones.",
  "Aquí estás, {nombre}. Que hoy la ballena sea de otros y a ti te toque el mar en calma.",
  "Buen día, {nombre}. Ojalá encuentres hoy una editorial que no conocías y te la lleves a casa.",
  "Hola, {nombre}. Que la fiesta te deje con el asombro intacto de quien vio el hielo por primera vez.",
  "Bienvenida, {nombre}. Que el día se te haga corto como un cuento de Chéjov y no largo como una novela rusa.",
  "Buenos días, {nombre}. Ojalá hoy no tengas que esperar a nadie, y mucho menos a Godot.",
  "Llegaste, {nombre}. Que el salón te devuelva más de lo que le pones, que es mucho.",
  "Buen día, {nombre}. Que ninguna carta que escribas hoy termine como las del coronel.",
  "Hola, {nombre}. Ojalá encuentres a alguien que se lleve poesía sin haberla venido a buscar.",
  "Bienvenida, {nombre}. Que hoy sepas moverte por el salón con la astucia con que Ulises volvió a casa.",
  "Buenos días, {nombre}. Que la jornada tenga la luz de una mañana de Lispector y ninguna de sus vértigos.",
  "Aquí estás, {nombre}. Ojalá hoy alguien te agradezca una recomendación y no lo olvides en un año.",
  "Buen día, {nombre}. Que ninguna puerta del salón se te cierre como la de la ley que custodiaba Kafka.",
  "Hola, {nombre}. Que la fiesta te sorprenda como a Alicia la sorprendió el otro lado del espejo.",
  "Bienvenida, {nombre}. Ojalá hoy te toque el cliente que sabe exactamente lo que quiere.",
  "Buenos días, {nombre}. Que el salón huela como la casa de Tomás González: a madera, a lluvia y a cosa viva.",
  "Llegaste, {nombre}. Que tu día tenga la ternura de Andrés Caicedo y ninguno de sus finales.",
  "Buen día, {nombre}. Ojalá vendas hoy tres libros de una editorial que nadie conoce todavía.",
  "Hola, {nombre}. Que la jornada te resulte tan habitable como la primera línea de una buena novela.",
  "Bienvenida, {nombre}. Que hoy nadie te robe el sombrero ni la paciencia.",
  "Buenos días, {nombre}. Ojalá encuentres en la mesa un libro que no sabías que existía.",
  "Aquí estás, {nombre}. Que el salón te trate como Dublín trató a Bloom: caminándolo entero en un solo día.",
  "Buen día, {nombre}. Que hoy no haya fantasmas, ni siquiera los que rondan la casa de los Buendía.",
  "Hola, {nombre}. Ojalá hoy alguien llore con un libro y tú hayas tenido algo que ver.",
  "Bienvenida, {nombre}. Que la fiesta te salga tan bien contada como una crónica de Kapuściński.",
  "Buenos días, {nombre}. Que ningún espejo te devuelva hoy la cara de Dorian Gray.",
  "Llegaste, {nombre}. Ojalá te toque hoy la conversación que vas a recordar en diciembre.",
  "Buen día, {nombre}. Que el salón sea tu isla y no la de Robinson: aquí hay gente.",
  "Hola, {nombre}. Que hoy tengas la calma de Piedad Bonnett para decir las cosas difíciles.",
  "Bienvenida, {nombre}. Ojalá hoy alguien pregunte por terror y tú tengas cinco títulos en la punta de la lengua.",
  "Buenos días, {nombre}. Que la jornada avance como los mejores libros: sin que quieras que termine.",
  "Aquí estás, {nombre}. Que hoy ninguna tormenta te alcance, ni la de Shakespeare ni la de septiembre.",
  "Buen día, {nombre}. Ojalá te lleves de aquí una frase que no habías escuchado nunca.",
  "Hola, {nombre}. Que el salón te dé hoy lo que Rulfo le negó a Comala: ruido, gente, vida.",
  "Bienvenida, {nombre}. Que hoy hagas algo que valga la pena contar en el feed."
];

export const MISIONES = [
  { reto: "Enamorarte de un verso inesperado en el séptimo poemario que hojees hoy.",
    cumplida: "enamorarse de un verso inesperado" },
  { reto: "Convencer a alguien de llevarse un libro de terror latinoamericano.",
    cumplida: "convencer a alguien de leer terror latinoamericano" },
  { reto: "Recomendar una editorial que el visitante no haya oído nombrar nunca.",
    cumplida: "recomendar una editorial desconocida" },
  { reto: "Leer en voz alta la primera línea de un libro a quien dude en comprarlo.",
    cumplida: "leer una primera línea en voz alta" },
  { reto: "Vender un libro solo con la portada, sin decir de qué trata.",
    cumplida: "vender un libro solo por su portada" },
  { reto: "Averiguar qué está leyendo la persona que atiende la mesa de al lado.",
    cumplida: "averiguar qué lee la mesa vecina" },
  { reto: "Encontrar en el salón un libro publicado hace más de cincuenta años.",
    cumplida: "encontrar un libro de hace más de medio siglo" },
  { reto: "Poner un libro de poesía en las manos de alguien que vino por narrativa.",
    cumplida: "poner poesía en manos de un lector de narrativa" },
  { reto: "Preguntarle a un visitante por el último libro que lo hizo llorar.",
    cumplida: "preguntar por el último libro que hizo llorar a alguien" },
  { reto: "Descubrir cuál es el libro más caro de la mesa y por qué lo vale.",
    cumplida: "descubrir por qué el libro más caro lo vale" },
  { reto: "Recomendarle un libro a alguien que no se parezca en nada a ti.",
    cumplida: "recomendarle un libro a alguien muy distinto" },
  { reto: "Aprenderte de memoria el nombre de tres autoras colombianas que no conocías.",
    cumplida: "aprender tres autoras colombianas nuevas" },
  { reto: "Encontrar el libro más raro del salón y defenderlo ante quien pregunte.",
    cumplida: "defender el libro más raro del salón" },
  { reto: "Convencer a un niño de que un libro sin dibujos también puede ser bueno.",
    cumplida: "convencer a un niño con un libro sin dibujos" },
  { reto: "Hacer que alguien se lleve un libro que no venía a buscar.",
    cumplida: "hacer que alguien se lleve lo que no buscaba" },
  { reto: "Descubrir qué editorial tiene la tipografía más bonita del salón.",
    cumplida: "descubrir la tipografía más bonita del salón" },
  { reto: "Preguntarle a un editor por el libro del que está más orgulloso.",
    cumplida: "preguntarle a un editor por su libro más querido" },
  { reto: "Recomendar un libro breve a alguien que dice no tener tiempo de leer.",
    cumplida: "recomendar un libro breve a quien no tiene tiempo" },
  { reto: "Leer completo, de pie, un cuento corto entre visitante y visitante.",
    cumplida: "leer un cuento entero de pie" },
  { reto: "Encontrar dos libros de mesas distintas que hablen de lo mismo.",
    cumplida: "encontrar dos libros que conversan entre sí" },
  { reto: "Sostener una conversación de cinco minutos sobre un libro que no has leído.",
    cumplida: "hablar cinco minutos de un libro no leído" },
  { reto: "Convencer a alguien de comprar el segundo libro de un autor que ya ama.",
    cumplida: "vender el segundo libro de un autor querido" },
  { reto: "Descubrir el libro más vendido del día antes de que cierre el salón.",
    cumplida: "adivinar el libro más vendido del día" },
  { reto: "Preguntarle a un visitante qué libro se llevaría a una isla desierta.",
    cumplida: "preguntar por el libro para la isla desierta" },
  { reto: "Recomendar un libro de una editorial que no sea de tu librería.",
    cumplida: "recomendar el libro de otra editorial" },
  { reto: "Hojear un libro de un género que nunca leerías por gusto propio.",
    cumplida: "hojear un género que nunca leería" },
  { reto: "Encontrar la dedicatoria más extraña impresa en algún libro del salón.",
    cumplida: "encontrar la dedicatoria más extraña del salón" },
  { reto: "Contarle a alguien el final de un libro sin arruinárselo.",
    cumplida: "contar un final sin arruinarlo" },
  { reto: "Vender un libro de ensayo a alguien que dice que el ensayo es aburrido.",
    cumplida: "vender ensayo a un escéptico del ensayo" },
  { reto: "Anotar una frase que escuches hoy en el salón y que merezca ser recordada.",
    cumplida: "rescatar una frase escuchada en el salón" },
  { reto: "Descubrir cuál es el libro favorito de otra persona del equipo.",
    cumplida: "descubrir el libro favorito de un colega" },
  { reto: "Recomendar un libro escrito en un país del que nunca hayas leído nada.",
    cumplida: "recomendar un libro de un país nuevo" },
  { reto: "Encontrar el libro con el título más largo de todo el salón.",
    cumplida: "encontrar el título más largo del salón" },
  { reto: "Preguntarle a alguien qué libro le regalaría a su peor enemigo.",
    cumplida: "preguntar qué libro se le regala a un enemigo" },
  { reto: "Convencer a alguien que vino a mirar de que hoy es el día de comprar.",
    cumplida: "convencer a un mirón de comprar hoy" },
  { reto: "Buscar un libro que empiece con una pregunta y leérselo a alguien.",
    cumplida: "encontrar un libro que empieza preguntando" },
  { reto: "Reordenar una mesa para que un libro olvidado quede a la vista.",
    cumplida: "rescatar un libro olvidado en la mesa" },
  { reto: "Descubrir qué libro se lleva más veces a la mano sin comprarse.",
    cumplida: "descubrir el libro más tocado y menos comprado" },
  { reto: "Recomendar un libro de terror a alguien que jura que no le gusta el terror.",
    cumplida: "convertir a alguien al terror" },
  { reto: "Averiguar el nombre de pila de un visitante y despedirlo por su nombre.",
    cumplida: "despedir a un visitante por su nombre" },
  { reto: "Encontrar un libro que hable de Medellín y ofrecérselo a un forastero.",
    cumplida: "ofrecerle Medellín a un forastero" },
  { reto: "Contar cuántos libros de la mesa tienen un animal en la portada.",
    cumplida: "contar los animales de las portadas" },
  { reto: "Convencer a alguien de comprar poesía por primera vez en su vida.",
    cumplida: "estrenar a un lector en la poesía" },
  { reto: "Preguntarle a un editor cómo eligió el nombre de su editorial.",
    cumplida: "averiguar de dónde salió el nombre de una editorial" },
  { reto: "Encontrar dos libros del salón cuyas portadas se parezcan sospechosamente.",
    cumplida: "encontrar dos portadas sospechosamente parecidas" },
  { reto: "Recomendar un libro que hayas leído hace más de diez años.",
    cumplida: "recomendar un libro de hace diez años" },
  { reto: "Descubrir qué está leyendo el visitante más callado del día.",
    cumplida: "descubrir qué leía el visitante más callado" },
  { reto: "Hacer reír a alguien hablando de un libro triste.",
    cumplida: "hacer reír con un libro triste" },
  { reto: "Vender un libro de una editorial que no vendió nada ayer.",
    cumplida: "destrabar la venta de una editorial olvidada" },
  { reto: "Salir del salón con un título anotado que no conocías esta mañana.",
    cumplida: "irse con un título nuevo anotado" }
];

export const SALUDOS = [
  "llegó entre una nube de mariposas amarillas.",
  "empezó la jornada con la sonrisa del gato de Cheshire.",
  "entró al salón como quien cae por la madriguera del conejo.",
  "abrió el día con la terquedad de quien confunde molinos con gigantes.",
  "apareció con la puntualidad que Fogg le exigía a la vuelta al mundo.",
  "llegó preguntando por Comala, y de ahí para acá no ha parado.",
  "cruzó la puerta como Dante cruzó la selva oscura: a mitad del camino.",
  "amaneció con la calma de quien sabe que la ballena vendrá después.",
  "entró recitando algo que nadie alcanzó a oír bien.",
  "llegó como Bloom a Dublín: dispuesto a caminarlo todo en un día.",
  "abrió la jornada con la paciencia de Penélope frente al telar.",
  "apareció con el hielo bajo el brazo, como el gitano de Macondo.",
  "llegó y, a diferencia de Bartleby, hoy sí preferiría hacerlo.",
  "entró al salón con el paso de quien vuelve a Ítaca después de años.",
  "amaneció sin metamorfosis, lo cual ya es una buena noticia.",
  "llegó buscando el aleph y encontró la caja registradora.",
  "cruzó la puerta como Alicia cruzó el espejo: con curiosidad y sin plan.",
  "abrió el día con más preguntas que la Esfinge.",
  "apareció con la energía de un lunes de Mrs. Dalloway comprando flores.",
  "llegó como quien encuentra una carta que llevaba cien años esperando.",
  "entró al salón con el sombrero torcido y las intenciones claras.",
  "amaneció con ganas de fundar un pueblo, o al menos de acomodar una mesa.",
  "llegó con la disciplina de un personaje de Tolstói y el humor de uno de Chéjov.",
  "abrió la jornada como se abre un libro nuevo: por la primera página.",
  "apareció desde el otro lado de la montaña mágica.",
  "llegó con la sed de aventura de los tres mosqueteros y ninguna espada.",
  "entró preguntando si alguien ha visto a Godot.",
  "amaneció con la lucidez de una mañana de Lispector.",
  "llegó como si trajera noticias del Conde de Montecristo.",
  "abrió el día con la voz de quien va a contar una historia larga.",
  "apareció con el asombro intacto de quien ve el mar por primera vez.",
  "cruzó la puerta con el ánimo de quien va a escalar la torre de Babel.",
  "llegó como el coronel: esperando algo, pero de buen humor.",
  "entró al salón con más libros en la cabeza que en las manos.",
  "amaneció dispuesta a que hoy sí pase algo digno de contarse.",
  "llegó con la elegancia inútil y hermosa de Gatsby una noche de fiesta.",
  "apareció sin saber si esto es un sueño de Calderón o un martes cualquiera.",
  "abrió la jornada con la determinación de Antígona y menos problemas.",
  "llegó como quien vuelve de Cumbres Borrascosas: con frío y con historias.",
  "entró al salón buscando la biblioteca infinita y encontró once mesas.",
  "amaneció con el pulso firme de quien va a cortar una tela sin patrón.",
  "llegó con la sospecha de que hoy alguien va a comprar poesía.",
  "abrió el día como Sherezade abría las noches: sabiendo dónde parar.",
  "apareció con el paso lento de quien se toma el tiempo de Proust.",
  "llegó dispuesta a que ningún visitante se vaya con las manos vacías.",
  "entró al salón como quien entra a un jardín de senderos que se bifurcan.",
  "amaneció con el hambre lectora de Fahrenheit y ninguna intención de quemar nada.",
  "llegó con noticias del otro lado del río y entre los árboles.",
  "abrió la jornada con la testarudez amable de quien sabe vender libros.",
  "apareció justo a tiempo, que en el salón es lo más parecido a un milagro."
];

/* ---------------------------------------------------------------------
   Selección determinista: la misma persona, el mismo día, la misma carta,
   aunque recargue la pantalla veinte veces. Sin esto, el feed diría una
   misión y la ventana otra.
   --------------------------------------------------------------------- */

function semilla(txt) {
  let h = 2166136261;
  for (const c of txt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function prng(s) { return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); }; }

/* Cada persona recibe el mazo barajado a su manera y va sacando una carta
   por día. Barajar y luego recorrer —en vez de sortear cada día— es lo que
   garantiza que nadie repita mensaje mientras dure el mazo. */
const _barajas = new Map();
function baraja(mazo, nombreMazo, personaId) {
  const k = nombreMazo + '|' + personaId;
  if (!_barajas.has(k)) {
    const r = prng(semilla(k) || 1), a = [...mazo];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    _barajas.set(k, a);
  }
  return _barajas.get(k);
}
const _dia = iso => Math.floor(Date.UTC(+iso.slice(0,4), +iso.slice(5,7)-1, +iso.slice(8,10)) / 86400000);

export function cartaDelDia(mazo, nombreMazo, personaId, fechaIso) {
  const a = baraja(mazo, nombreMazo, personaId);
  return a[((_dia(fechaIso) % a.length) + a.length) % a.length];
}

export const mensajes = {
  bienvenida: (persona, fechaIso) =>
    cartaDelDia(BIENVENIDAS, 'bienvenida', persona.id, fechaIso)
      .replace('{nombre}', persona.nombre_corto || persona.nombre.split(' ')[0]),
  mision: (persona, fechaIso) =>
    cartaDelDia(MISIONES, 'mision', persona.id, fechaIso),
  saludo: (persona, fechaIso) =>
    cartaDelDia(SALUDOS, 'saludo', persona.id, fechaIso)
};
