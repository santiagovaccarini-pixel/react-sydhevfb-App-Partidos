import { CURL_NORDICO_ISOPRONE } from "./curlNordicoIsoprone.js";
import { ISOCINECIA } from "./isocinecia.js";
import { ZONA_MEDIA } from "./zonaMedia.js";

// Los tests de Evaluaciones, en el orden de las hojas del Excel
// BD_evaluaciones (de izquierda a derecha). Se suman de a uno, cada uno en su
// archivo; el primero es el que se ve al entrar.
export const TESTS = Object.freeze([ZONA_MEDIA, CURL_NORDICO_ISOPRONE, ISOCINECIA]);
