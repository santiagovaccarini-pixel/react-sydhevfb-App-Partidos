import { CURL_NORDICO_ISOPRONE } from "./curlNordicoIsoprone.js";
import { ESTABILIDAD_ROTACIONAL } from "./estabilidadRotacional.js";
import { ISOCINECIA } from "./isocinecia.js";
import { MOVILIDAD_CADERA, MOVILIDAD_ISQUIO, MOVILIDAD_TOBILLO } from "./movilidad.js";
import { ZONA_MEDIA } from "./zonaMedia.js";

// Los tests de Evaluaciones, en el orden de las hojas del Excel
// BD_evaluaciones (de izquierda a derecha). Se suman de a uno, cada uno en su
// archivo; el primero es el que se ve al entrar. La hoja Funcional son
// cuatro tests, uno por bloque (Santiago, 09/10).
export const TESTS = Object.freeze([ZONA_MEDIA, CURL_NORDICO_ISOPRONE, ISOCINECIA, MOVILIDAD_TOBILLO, MOVILIDAD_CADERA, MOVILIDAD_ISQUIO, ESTABILIDAD_ROTACIONAL]);
