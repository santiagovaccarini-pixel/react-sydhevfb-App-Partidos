"""Las imágenes con relieve del mapa corporal de los reportes de Lesiones.

Toma la figura del cuerpo de la app (volcada por volcar-geometria.mjs: la
silueta partida en partes, sus músculos y tendones y las líneas del cuerpo)
y le da volumen: cada corte del cuerpo es redondo, cada músculo es un bulto
propio (y unos pocos más de adorno, que la app no tiene para elegir: el
trapecio, los abdominales, los antebrazos, el tibial…), las líneas son
surcos. Después lo ilumina como una escultura gris (dos luces, brillo y
sombra en los surcos) y guarda un WebP con fondo transparente que cubre de
x = 20 a 180 y de y = 0 a 440 del lienzo de la figura (200 x 440), a 3
puntos por unidad: así las manchas de calor, que usan esas coordenadas,
caen justo en su lugar. Uso: render.py <geometria.json> <frente|espalda> <salida.webp>
"""
import json, re, sys, math
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

G = json.load(open(sys.argv[1]))
VISTA = sys.argv[2]
SALIDA = sys.argv[3]

# El lienzo de la figura y cuántos puntos por unidad se calculan (después
# se achica a la mitad, para que los bordes queden suaves).
ANCHO = 200
X0, X1, Y0, Y1 = 20.0, 180.0, 0.0, 440.0
S = 6
W, H = int((X1 - X0) * S), int((Y1 - Y0) * S)

TOKEN = re.compile(r"[MLCZAmlcza]|-?\d*\.?\d+(?:e-?\d+)?")


def cubica(p0, p1, p2, p3, n=16):
    t = np.linspace(0, 1, n + 1)[1:, None]
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3


def poligonos(d):
    toks = TOKEN.findall(d)
    i = 0
    polys, actual, pos, cmd = [], [], np.array([0.0, 0.0]), None
    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    while i < len(toks):
        t = toks[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t; i += 1
            if cmd in "Zz":
                if actual: polys.append(np.array(actual)); actual = []
                continue
        if cmd == "M":
            if actual: polys.append(np.array(actual))
            pos = np.array([num(), num()]); actual = [pos.copy()]; cmd = "L"
        elif cmd == "L":
            pos = np.array([num(), num()]); actual.append(pos.copy())
        elif cmd == "C":
            p1 = np.array([num(), num()]); p2 = np.array([num(), num()]); p3 = np.array([num(), num()])
            for q in cubica(pos, p1, p2, p3): actual.append(q)
            pos = p3
        elif cmd == "a":
            rx, ry, rot, large, sweep, dx, dy = [num() for _ in range(7)]
            centro = pos + np.array([dx / 2, dy / 2])
            r = math.hypot(dx, dy) / 2
            ang0 = math.atan2(pos[1] - centro[1], pos[0] - centro[0])
            for k in range(1, 13):
                a = ang0 - math.pi * k / 12 if sweep == 0 else ang0 + math.pi * k / 12
                actual.append(centro + r * np.array([math.cos(a), math.sin(a)]))
            pos = pos + np.array([dx, dy])
        else:
            i += 1
    if actual: polys.append(np.array(actual))
    return polys


def espejo(poly):
    p = poly.copy(); p[:, 0] = ANCHO - p[:, 0]; return p


def a_px(poly):
    p = poly.copy()
    p[:, 0] = (p[:, 0] - X0) * S
    p[:, 1] = (p[:, 1] - Y0) * S
    return p


def pintar(polys, cerrada=True, grosor=1.0):
    m = np.zeros((H, W), np.uint8)
    for poly in polys:
        pts = np.round(a_px(poly) * 4).astype(np.int32)
        if cerrada:
            cv2.fillPoly(m, [pts], 255, lineType=cv2.LINE_AA, shift=2)
        else:
            cv2.polylines(m, [pts], False, 255, thickness=max(1, int(grosor * S)), lineType=cv2.LINE_AA, shift=2)
    return m.astype(np.float32) / 255.0


def con_espejo(poly, espejada):
    return espejo(poly) if espejada else poly


V = G[VISTA]
polys_cuerpo = [con_espejo(p, x["espejada"]) for x in V["piezas"] for p in poligonos(x["d"])]
cuerpo = pintar(polys_cuerpo)
B = cuerpo > 0.5

# Bordes del cuerpo a cada altura, del lado izquierdo de la pantalla (para
# ubicar los músculos de adorno adentro del brazo y la pierna).
def bordes(y, desde, hasta):
    fila = B[int(round((y - Y0) * S)), :]
    xs = np.where(fila)[0] / S + X0
    xs = xs[(xs >= desde) & (xs <= hasta)]
    if not len(xs):
        return None
    return xs.min(), xs.max()


def huso(y0, y1, f0, f1, desde, hasta, n=40, punta=0.25):
    """Un músculo en forma de huso entre dos alturas, de la fracción f0 a f1
    del ancho del miembro (que está entre desde y hasta en x)."""
    izq, der = [], []
    for k in range(n + 1):
        t = k / n
        y = y0 + (y1 - y0) * t
        b = bordes(y, desde, hasta)
        if not b:
            continue
        a, z = b
        w = z - a
        medio = a + w * (f0 + f1) / 2
        semi = w * (f1 - f0) / 2 * (punta + (1 - punta) * math.sin(math.pi * t) ** 0.7)
        izq.append([medio - semi, y]); der.append([medio + semi, y])
    return np.array(izq + der[::-1])


def elipse(cx, cy, rx, ry, ang=0, n=36):
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x, y = rx * np.cos(a), ry * np.sin(a)
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    return np.stack([cx + x * c - y * s, cy + x * s + y * c], axis=1)


def suave(puntos, n=10):
    p = np.array(puntos, float)
    out = []
    for i in range(len(p)):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % len(p)], p[(i + 2) % len(p)]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(out)


def linea(puntos, n=10):
    p = np.array(puntos, float)
    out = []
    for i in range(len(p) - 1):
        p0, p1, p2, p3 = p[max(i - 1, 0)], p[i], p[i + 1], p[min(i + 2, len(p) - 1)]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(p[-1])
    return np.array(out)


# ------------------------------------------------- Músculos de adorno --
# Solo para el dibujo (no se eligen en la app): (polígono, fuerza). Se
# dibujan en la mitad izquierda de la pantalla y se espejan.
ADORNO = {"frente": [], "espalda": []}
SURCOS = {"frente": [], "espalda": []}
BRAZO = (30, 70)
PIERNA = (60, 100)

# Frente.
ADORNO["frente"] += [
    (suave([[91, 58], [89, 65], [83, 70], [75, 74], [69, 77], [78, 77], [88, 75], [94, 72], [94, 64]]), 0.45),  # trapecio
    (suave([[89.5, 49], [92.5, 50], [96.5, 62], [98.5, 73], [95.5, 74], [92, 63]]), 0.5),  # esternocleidomastoideo
    (elipse(71.5, 125, 4.2, 2.3, 25), 0.35), (elipse(72.5, 131.5, 4.2, 2.3, 25), 0.35), (elipse(73.5, 138, 4.0, 2.2, 25), 0.3),  # serrato
    (huso(178, 216, 0.02, 0.55, *BRAZO), 0.6),  # braquiorradial
    (huso(180, 214, 0.5, 0.98, *BRAZO), 0.55),  # flexores
    (huso(334, 390, 0.12, 0.55, *PIERNA), 0.6),  # tibial anterior
    (huso(338, 384, 0.0, 0.16, *PIERNA, punta=0.4), 0.4),  # peroneos
    # La cara, apenas: la frente, la nariz y el mentón.
    (elipse(92, 26.5, 6.5, 2.4, 6), 0.18), (elipse(100, 38, 2.2, 6.5), 0.32), (elipse(100, 54.5, 4.5, 2.2), 0.16),
]
SURCOS["frente"] += [
    (linea([[100, 132], [100, 150], [100, 168], [100, 186], [100, 206]]), 1.2, 1.6),  # línea alba
    (linea([[91, 149], [96, 150.5], [100, 150]]), 1.0, 1.4),
    (linea([[91, 164], [96, 165.5], [100, 165]]), 1.0, 1.4),
    (linea([[92, 184], [96, 185], [100, 184.5]]), 0.9, 1.2),
    (linea([[89, 31.5], [92.5, 30.8], [96, 31.8]]), 0.35, 1.6),  # ojo
    (linea([[96.5, 48], [100, 48.6], [103.5, 48]]), 0.35, 0.9),  # boca
    (linea([[41.5, 250], [41.8, 262]]), 0.8, 0.9), (linea([[45, 252], [45.3, 266]]), 0.8, 0.9), (linea([[48.5, 251], [48.6, 265]]), 0.8, 0.9),  # dedos
    (linea([[73, 337], [76, 360], [79, 388]]), 0.8, 0.9),  # canto del peroné
    (linea([[88.5, 334], [89.5, 360], [90.5, 392]]), 0.7, 1.0),  # tibia
]

# Espalda.
ADORNO["espalda"] += [
    (suave([[100, 57], [94, 61], [86, 67], [77, 73], [70, 77], [75, 83], [84, 88], [90, 98], [94, 112], [97, 126], [100, 142]]), 0.5),  # trapecio
    (huso(140, 204, 0.0, 1.0, 91.5, 99.2, punta=0.45), 0.6),  # erectores
    (huso(178, 216, 0.02, 0.5, *BRAZO), 0.55),  # extensores
    (huso(180, 214, 0.45, 0.98, *BRAZO), 0.5),  # flexores
    (huso(333, 352, 0.0, 0.2, *PIERNA, punta=0.5), 0.3),
]
SURCOS["espalda"] += [
    (linea([[100, 60], [100, 100], [100, 140], [100, 180], [100, 212]]), 1.2, 1.6),  # columna
    (linea([[78, 330], [86, 333], [94, 330]]), 0.6, 0.8),  # pliegue de la rodilla
    (linea([[41.5, 250], [41.8, 262]]), 0.8, 0.9), (linea([[45, 252], [45.3, 266]]), 0.8, 0.9), (linea([[48.5, 251], [48.6, 265]]), 0.8, 0.9),
]

# ------------------------------------------------------------- Volumen --
D = ndimage.distance_transform_edt(B)
R = ndimage.maximum_filter(D, size=int(24 * S))
R = ndimage.gaussian_filter(R, 1.4 * S)
alto = np.sqrt(np.clip(D * (2 * np.maximum(R, 1) - D), 0, None)) * 1.0

bultos = np.zeros_like(alto)
ocupado = np.zeros(B.shape, bool)


def bulto(m, fuerza):
    global bultos
    if m.sum() < 30:
        return
    d = ndimage.distance_transform_edt(m)
    r = max(d.max(), 1)
    perfil = np.sqrt(np.clip(d * (2 * r - d), 0, None)) * fuerza
    bultos = np.maximum(bultos, perfil)


FUERZA = 0.9
for e in V["estructuras"]:
    if e["capa"] == "profunda" or e["tipo"] == "ligamento":
        continue
    m = pintar([con_espejo(p, e["espejada"]) for p in poligonos(e["d"])]) > 0.5
    m &= B
    ocupado |= m
    bulto(m, FUERZA if e["tipo"] == "musculo" else 0.3)

for poly, fuerza in ADORNO[VISTA]:
    for p in (poly, espejo(poly)):
        m = (pintar([p]) > 0.5) & B & ~ocupado
        bulto(m, fuerza * 1.45)

alto = alto + bultos
lineas = [con_espejo(p, x["espejada"]) for x in V["detalles"] for p in poligonos(x["d"])]
surco = ndimage.gaussian_filter(pintar(lineas, cerrada=False, grosor=1.0), 1.0 * S) * 3.0 * S
for poly, hondo, grosor in SURCOS[VISTA]:
    capa = pintar([poly, espejo(poly)], cerrada=False, grosor=grosor)
    surco = surco + ndimage.gaussian_filter(capa, 0.9 * S) * hondo * 3.2 * S
alto = alto - surco
alto = ndimage.gaussian_filter(alto, 0.9 * S)

# --------------------------------------------------------------- Luces --
gy, gx = np.gradient(alto)
n = np.dstack([-gx, -gy, np.full_like(alto, 1.0)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
def luz(v):
    v = np.array(v, np.float32); return v / np.linalg.norm(v)
L1, L2 = luz([-0.45, -0.55, 0.8]), luz([0.75, -0.15, 0.55])
Vw = np.array([0, 0, 1.0])
dif = np.clip(n @ L1, 0, 1) * 0.72 + np.clip(n @ L2, 0, 1) * 0.24 + 0.26
Hh = (L1 + Vw) / np.linalg.norm(L1 + Vw)
spec = np.clip(n @ Hh, 0, 1) ** 18 * 0.24
borde = (1 - n[:, :, 2]) ** 2
cavidad = np.clip(ndimage.gaussian_filter(alto, 4 * S) - alto, 0, None)
ao = 1 - np.clip(cavidad / (4.5 * S), 0, 0.6)
albedo = 0.84
gris = np.clip(albedo * dif * ao + spec * ao + borde * 0.06, 0, 1)
rgb = np.dstack([gris * 0.98, gris * 0.985, gris * 1.0])
img = np.dstack([rgb, cuerpo])
img = cv2.resize(img, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA").save(SALIDA, "WEBP", quality=88, method=6)
print(SALIDA)
