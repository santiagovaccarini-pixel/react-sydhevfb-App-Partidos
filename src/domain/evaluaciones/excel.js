// Cómo calcula Excel, para que las fórmulas del Excel de evaluaciones den
// exactamente lo mismo en la app. Una celda puede tener:
//   · un número;
//   · un texto (también "", lo que dejan las fórmulas que "no dan nada");
//   · verdadero o falso;
//   · nada (null: la celda está vacía de verdad);
//   · un error (#DIV/0!, #VALUE!…), que se arrastra por las cuentas.
// Cada función devuelve lo que devolvería Excel con esos valores. En pantalla
// los errores se ven vacíos (lo decidió Santiago el 05/10: el Excel mostraba
// #DIV/0! cuando no había datos), pero acá siguen siendo errores: una regla
// de color que lee un error no pinta, como en Excel.

export const ERROR = Object.freeze({
  div0: Object.freeze({ error: "#DIV/0!" }),
  valor: Object.freeze({ error: "#VALUE!" }),
  na: Object.freeze({ error: "#N/A" }),
});

export const esError = (valor) => Boolean(valor && typeof valor === "object" && "error" in valor);

// ESBLANCO: solo la celda vacía de verdad. Una fórmula que da "" no está en
// blanco (por eso en el Excel ESBLANCO de esas celdas da FALSO).
export const esBlanco = (valor) => valor === null || valor === undefined;

// OR(ISBLANK(x), x=""): vacía o con "".
export const esVacio = (valor) => esBlanco(valor) || valor === "";

export const esNumero = (valor) => typeof valor === "number" && Number.isFinite(valor);

// SI.ERROR
export const siError = (valor, alternativa) => (esError(valor) ? alternativa : valor);

// Un valor como número para una cuenta (+ - * /): vacía es 0, verdadero 1 y
// falso 0; un texto da #VALUE! (incluso "").
const paraCuenta = (valor) => {
  if (esError(valor)) return valor;
  if (esBlanco(valor)) return 0;
  if (typeof valor === "boolean") return valor ? 1 : 0;
  if (esNumero(valor)) return valor;
  return ERROR.valor;
};

const cuenta = (a, b, operar) => {
  const x = paraCuenta(a);
  if (esError(x)) return x;
  const y = paraCuenta(b);
  if (esError(y)) return y;
  return operar(x, y);
};

export const sumar = (a, b) => cuenta(a, b, (x, y) => x + y);
export const restar = (a, b) => cuenta(a, b, (x, y) => x - y);
export const multiplicar = (a, b) => cuenta(a, b, (x, y) => x * y);
export const dividir = (a, b) => cuenta(a, b, (x, y) => (y === 0 ? ERROR.div0 : x / y));

export const absoluto = (valor) => {
  const x = paraCuenta(valor);
  return esError(x) ? x : Math.abs(x);
};

// Excel compara los números con 15 cifras significativas (=0,1+0,2=0,3 da
// VERDADERO aunque en la computadora no sean iguales).
const aQuinceCifras = (numero) => Number(numero.toPrecision(15));

const tipoParaComparar = (valor) => {
  if (typeof valor === "number") return 0;
  if (typeof valor === "string") return 1;
  return 2;
};

// Compara como Excel: -1, 0 o 1 (o el error, si hay uno). Una celda vacía
// vale 0 contra un número, "" contra un texto y FALSO contra un lógico. Entre
// tipos distintos: cualquier número es menor que cualquier texto, y cualquier
// texto menor que un lógico. Los textos, sin importar mayúsculas.
export const comparar = (a, b) => {
  if (esError(a)) return a;
  if (esError(b)) return b;
  if (esBlanco(a) && esBlanco(b)) return 0;
  const vacio = (otro) => (typeof otro === "string" ? "" : typeof otro === "boolean" ? false : 0);
  const x = esBlanco(a) ? vacio(b) : a;
  const y = esBlanco(b) ? vacio(a) : b;
  const tx = tipoParaComparar(x);
  const ty = tipoParaComparar(y);
  if (tx !== ty) return tx < ty ? -1 : 1;
  if (tx === 0) {
    const p = aQuinceCifras(x);
    const q = aQuinceCifras(y);
    if (p === q) return 0;
    return p < q ? -1 : 1;
  }
  if (tx === 1) {
    const p = x.toLocaleLowerCase();
    const q = y.toLocaleLowerCase();
    if (p === q) return 0;
    return p < q ? -1 : 1;
  }
  if (x === y) return 0;
  return x ? 1 : -1;
};

const comparacion = (aprobar) => (a, b) => {
  const resultado = comparar(a, b);
  return esError(resultado) ? resultado : aprobar(resultado);
};

export const igual = comparacion((c) => c === 0);
export const mayor = comparacion((c) => c > 0);
export const mayorIgual = comparacion((c) => c >= 0);
export const menor = comparacion((c) => c < 0);
export const menorIgual = comparacion((c) => c <= 0);

// "Entre" del formato condicional: incluye los dos bordes y no importa en qué
// orden vengan.
export const entre = (valor, borde1, borde2) => {
  const desde = menorIgual(borde1, borde2);
  if (esError(desde)) return desde;
  const [chico, grande] = desde ? [borde1, borde2] : [borde2, borde1];
  const arriba = mayorIgual(valor, chico);
  if (esError(arriba)) return arriba;
  const abajo = menorIgual(valor, grande);
  if (esError(abajo)) return abajo;
  return arriba && abajo;
};

// Lo que una regla de formato condicional toma por cumplida: solo VERDADERO
// (o un número distinto de cero). Un error o un texto no pinta.
export const seCumple = (valor) => valor === true || (esNumero(valor) && valor !== 0);

// Los números de un rango, como los toman PROMEDIO y SUBTOTAL: los textos,
// los lógicos y las vacías no cuentan; un error en el rango es el resultado.
const numerosDelRango = (valores) => {
  const numeros = [];
  for (const valor of valores) {
    if (esError(valor)) return valor;
    if (esNumero(valor)) numeros.push(valor);
  }
  return numeros;
};

const sumaDe = (numeros) => numeros.reduce((total, numero) => total + numero, 0);

// PROMEDIO de celdas (no de números escritos): salta textos y lógicos.
export const promedio = (valores) => {
  const numeros = numerosDelRango(valores);
  if (esError(numeros)) return numeros;
  if (numeros.length === 0) return ERROR.div0;
  return sumaDe(numeros) / numeros.length;
};

// DESVEST.M (muestral) con la cuenta de Excel: (suma de los cuadrados −
// cuadrado de la suma ÷ n) ÷ (n − 1). Con otra cuenta igual de buena, los
// últimos decimales salen distintos (comparado con el Excel de evaluaciones:
// así da idéntico, hasta el último decimal).
export const desvioMuestral = (valores) => {
  const numeros = numerosDelRango(valores);
  if (esError(numeros)) return numeros;
  const n = numeros.length;
  if (n < 2) return ERROR.div0;
  const suma = sumaDe(numeros);
  const cuadrados = numeros.reduce((total, numero) => total + numero * numero, 0);
  return Math.sqrt((cuadrados - (suma * suma) / n) / (n - 1));
};

// CONTAR: cuántos números (los errores no cuentan ni se arrastran).
export const contarNumeros = (valores) => valores.filter(esNumero).length;

// MAX y MIN: sin números dan 0, como en Excel.
export const maximo = (valores) => {
  const numeros = numerosDelRango(valores);
  if (esError(numeros)) return numeros;
  return numeros.length ? Math.max(...numeros) : 0;
};

export const minimo = (valores) => {
  const numeros = numerosDelRango(valores);
  if (esError(numeros)) return numeros;
  return numeros.length ? Math.min(...numeros) : 0;
};

// SUBTOTAL de las filas que se ven (las que deja el filtro): 1 promedio,
// 2 cuántos números, 4 máximo, 5 mínimo, 7 desvío muestral.
const SUBTOTALES = { 1: promedio, 2: contarNumeros, 4: maximo, 5: minimo, 7: desvioMuestral };

export const subtotal = (funcion, valores) => {
  const calcular = SUBTOTALES[funcion];
  if (!calcular) throw new Error(`SUBTOTAL ${funcion} no está`);
  return calcular(valores);
};

// ------------------------------------------------------------ Formatos --

// Redondea como muestra Excel: primero a 15 cifras significativas y después
// la mitad para arriba, lejos del cero (1,005 con dos decimales es 1,01).
export const redondearComoExcel = (numero, decimales) => {
  const quince = aQuinceCifras(numero);
  const escalado = aQuinceCifras(Math.abs(quince) * 10 ** decimales);
  const redondeado = Math.floor(escalado + 0.5) / 10 ** decimales;
  return redondeado === 0 ? 0 : Math.sign(quince) * redondeado;
};

const conComa = (texto) => texto.replace(".", ",");

const conDecimales = (numero, decimales) => conComa(redondearComoExcel(numero, decimales).toFixed(decimales));

// "General" de Excel: hasta 10 cifras, sin ceros de más.
const general = (numero) => {
  if (Number.isInteger(numero)) return String(numero);
  return conComa(String(Number(numero.toPrecision(10))));
};

// Un tiempo del Excel de evaluaciones: lo guarda como horas y minutos
// ("h:mm"), pero son minutos y segundos (3:04 son 3 min 04 s). Como Excel,
// se lleva al segundo (del Excel) más cercano y lo que sobra no se redondea
// para arriba: 4:44,70 se ve 4:44. Los minutos no vuelven a 0 a las 24.
export const textoDeTiempo = (dias) => {
  const segundosDelExcel = Math.round(Math.abs(dias) * 86400);
  const minutos = Math.floor(segundosDelExcel / 3600);
  const segundos = Math.floor((segundosDelExcel % 3600) / 60);
  return `${dias < 0 && segundosDelExcel >= 60 ? "-" : ""}${minutos}:${String(segundos).padStart(2, "0")}`;
};

const LOGICOS = { "es-AR": ["VERDADERO", "FALSO"], "pt-BR": ["VERDADEIRO", "FALSO"] };

// Un valor como lo muestra Excel con el formato de la celda. Los errores y
// las vacías, vacíos. formato: "General", "0", "0.0", "0.00", "0%", "0.0%",
// "0.00%" o "tiempo".
export const textoDeValor = (valor, formato = "General", idioma = "es-AR") => {
  if (esError(valor) || esBlanco(valor) || valor === "") return "";
  if (typeof valor === "boolean") {
    const [verdadero, falso] = LOGICOS[idioma] || LOGICOS["es-AR"];
    return valor ? verdadero : falso;
  }
  if (typeof valor === "string") return valor;
  if (!esNumero(valor)) return "";
  if (formato === "tiempo") return textoDeTiempo(valor);
  const porcentaje = /^0(\.0+)?%$/.exec(formato);
  if (porcentaje) {
    const decimales = porcentaje[1] ? porcentaje[1].length - 1 : 0;
    return `${conDecimales(valor * 100, decimales)}%`;
  }
  const fijo = /^0(\.0+)?$/.exec(formato);
  if (fijo) return conDecimales(valor, fijo[1] ? fijo[1].length - 1 : 0);
  return general(valor);
};

// ------------------------------------------------------------ Tiempos --

// Los tiempos se guardan en segundos (los de verdad: 3:04 son 184) y se
// cuentan en la unidad del Excel, días, para que cada cuenta dé igual que
// allá: 184 / 1440 es justo lo que guarda Excel para "3:04" (3 h 04 min).
export const SEGUNDOS_POR_DIA_DEL_EXCEL = 1440;

export const tiempoParaExcel = (segundos) => (esNumero(segundos) ? segundos / SEGUNDOS_POR_DIA_DEL_EXCEL : null);
