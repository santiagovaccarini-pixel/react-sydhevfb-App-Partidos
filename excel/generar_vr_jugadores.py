"""
Genera las filas de Valor Referencial (hoja VR) para cada jugador x categoria de tiempo,
replicando exactamente lo que muestran las filas 5..9 (Excelente..Malo) de la hoja
'Data GPS Partido' cuando se filtra por columna T (jugador) y columna DG (categoria).

Uso:  python excel/generar_vr_jugadores.py  <entrada.xlsm>  <salida.xlsm>
Ver:  excel/VALOR_REFERENCIAL.md
"""
import sys, re, io, zipfile, datetime, math, html, warnings
warnings.filterwarnings('ignore')
from collections import Counter
import numpy as np
import pandas as pd
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter as L, column_index_from_string as C

SRC = sys.argv[1] if len(sys.argv) > 1 else 'base.xlsm'
DST = sys.argv[2] if len(sys.argv) > 2 else 'salida.xlsm'
REVIEW = DST.rsplit('.', 1)[0] + '_resumen.xlsx'

DATA_SHEET, VR_SHEET, PLAYERS_SHEET = 'Data GPS Partido', 'VR', 'Tiempos por jugador'
HDR_ROW, FIRST_DATA_ROW = 13, 15
FIRST_COL, LAST_COL = C('P'), C('DA')          # columnas con formulas Excelente..Malo
CATS = ['Sólo PT', 'Sólo ST', '>=30 y Final ST', '>=10 y <30 ST', '>=85', '>=70 y <85', 'PT + <25']
ITEM_BY_CAT = {'Sólo PT': 'Jugador PT', 'Sólo ST': 'Jugador ST'}   # resto -> Jugador Total
NIVELES = [('Excelente', 2), ('Muy Bueno', 1), ('Bueno', 0), ('Regular', -1), ('Malo', -2), ('Desv. Estándar', None)]
VR_FIRST_FREE_ROW = 166
TODAY_SERIAL = (datetime.date.today() - datetime.date(1899, 12, 30)).days

def norm(h):
    return re.sub(r'\s+', ' ', str(h)).strip().casefold() if h is not None else None

def to_num(v):
    if v is None or v == '':
        return np.nan
    if isinstance(v, datetime.timedelta):
        return v.total_seconds() / 86400.0
    if isinstance(v, datetime.time):
        return (v.hour * 3600 + v.minute * 60 + v.second + v.microsecond / 1e6) / 86400.0
    if isinstance(v, datetime.datetime):
        return (v - datetime.datetime(1899, 12, 30)).total_seconds() / 86400.0
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return np.nan

# ---------------------------------------------------------------- 1. leer datos
print('Leyendo', SRC)
wbv = load_workbook(SRC, read_only=True, data_only=True)
wbf = load_workbook(SRC, read_only=True, data_only=False)
ws_v, ws_f = wbv[DATA_SHEET], wbf[DATA_SHEET]

hdr13 = next(ws_v.iter_rows(min_row=HDR_ROW, max_row=HDR_ROW, values_only=True))
ncols = len(hdr13)
players = [r[0].strip() for r in wbv[PLAYERS_SHEET].iter_rows(min_row=2, max_col=1, values_only=True) if r[0]]
N4 = next(ws_v.iter_rows(min_row=4, max_row=4, min_col=C('N'), max_col=C('N'), values_only=True))[0]

raw = []
for r in ws_v.iter_rows(min_row=FIRST_DATA_ROW, values_only=True):
    if r[C('T') - 1] is None:
        continue
    raw.append(r)
print('Filas de datos:', len(raw))
cols_letters = [L(i + 1) for i in range(ncols)]
num = pd.DataFrame([[to_num(v) for v in r] for r in raw], columns=cols_letters)
T = pd.Series([str(r[C('T') - 1]).strip() for r in raw])
DG = pd.Series([r[C('DG') - 1] for r in raw])
U = pd.Series([r[C('U') - 1] for r in raw])

# ---------------------------------------------------------------- 2. formulas fila 5..9
frows = {i: next(ws_f.iter_rows(min_row=i, max_row=i, values_only=True)) for i in (5, 6, 7, 8, 9)}
def ftext(c):
    return getattr(c, 'text', c)

def split_args(s):
    """separa argumentos de nivel superior respetando parentesis y comillas"""
    args, depth, cur, q = [], 0, '', False
    for ch in s:
        if ch == '"':
            q = not q
        if not q:
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            elif ch == ',' and depth == 0:
                args.append(cur); cur = ''; continue
        cur += ch
    args.append(cur)
    return args

def translate(f):
    """formula Excel (subconjunto usado en filas 5..9) -> expresion Python"""
    f = f.lstrip('=')
    # IF(cond, a, b) -> (a) if (cond) else (b)   (solo nivel superior, es lo que hay)
    while True:
        m = re.search(r'IF\(', f)
        if not m:
            break
        start = m.end(); depth = 1; i = start
        while depth:
            if f[i] == '(':
                depth += 1
            elif f[i] == ')':
                depth -= 1
            i += 1
        inner = f[start:i - 1]
        c, a, b = split_args(inner)
        f = f[:m.start()] + f'(({a}) if ({c}) else ({b}))' + f[i:]
    f = re.sub(r'SUBTOTAL\((\d+),\$?([A-Z]+)\$?\d+:\$?[A-Z]+\$?\d+\)', r"ST(\1,'\2')", f)
    f = re.sub(r'\$?([A-Z]+)\$7\b', r"R7('\1')", f)
    f = f.replace('$N$4', 'N4').replace('="%"', '=="%"')
    f = re.sub(r'(?<![=<>!])=(?!=)', '==', f)
    return f

formulas = {}   # col -> {fila: expr}
for j in range(FIRST_COL - 1, LAST_COL):
    col = L(j + 1)
    f7 = ftext(frows[7][j])
    if not (isinstance(f7, str) and f7.startswith('=')):
        continue
    formulas[col] = {i: translate(ftext(frows[i][j])) for i in (5, 6, 7, 8, 9)}
print('Columnas con formula:', len(formulas))

class Calc:
    def __init__(self, mask):
        self.sub = num[mask]
        self.cache = {}
    def ST(self, n, col):
        s = self.sub[col].dropna()
        if n == 1:
            return s.mean() if len(s) else float('nan')
        if n == 2:
            return float(len(s))
        if n == 7:
            return s.std(ddof=1) if len(s) > 1 else float('nan')
        if n == 9:
            return s.sum() if len(s) else 0.0
        raise ValueError(n)
    def R7(self, col):
        return self.value(7, col)
    def value(self, row, col):
        key = (row, col)
        if key not in self.cache:
            try:
                v = eval(formulas[col][row], {'ST': self.ST, 'R7': self.R7, 'N4': N4})
                if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                    v = None
            except (ZeroDivisionError, KeyError, TypeError):
                v = None
            self.cache[key] = v
        return self.cache[key]

# ---------------------------------------------------------------- 3. validar contra valores cacheados (sin filtro)
cached = {i: next(ws_v.iter_rows(min_row=i, max_row=i, values_only=True)) for i in (5, 6, 7, 8, 9)}
calc_all = Calc(np.ones(len(num), dtype=bool))
bad = []
for col in formulas:
    for i in (5, 6, 7, 8, 9):
        exp = to_num(cached[i][C(col) - 1]); got = calc_all.value(i, col)
        if got is None and (exp is None or np.isnan(exp)):
            continue
        if got is None or np.isnan(exp) or abs(got - exp) > 1e-6 * max(1, abs(exp)):
            bad.append((col, i, exp, got))
print('Validacion vs Excel (sin filtro): diferencias =', len(bad))
for b in bad[:15]:
    print('   ', b)

# ---------------------------------------------------------------- 4. mapa de columnas Data -> VR
ws_vr = wbv[VR_SHEET]
vr_hdr = next(ws_vr.iter_rows(min_row=2, max_row=2, values_only=True))
vr_by_norm = {}
for j, h in enumerate(vr_hdr):
    if h is not None and norm(h) not in vr_by_norm:
        vr_by_norm[norm(h)] = L(j + 1)
col_map = {}     # data col -> vr col
unmatched = []
for j in range(C('AE') - 1, LAST_COL):
    col = L(j + 1); h = hdr13[j]
    if h is None or col not in formulas and col != 'AE':
        continue
    key = norm(h)
    if key in vr_by_norm:
        col_map[col] = vr_by_norm[key]
    else:
        unmatched.append((col, h))
print('Columnas mapeadas a VR:', len(col_map), '| sin correspondencia en VR:', unmatched)

# ---------------------------------------------------------------- 5. calcular por jugador x categoria
out_rows = []        # dicts: vr_col -> value  (+ meta)
review = []
skipped = []
for p in players:
    for cat in CATS:
        mask = ((T == p) & (DG == cat)).to_numpy()
        n = int(mask.sum())
        if n == 0:
            skipped.append((p, cat)); continue
        calc = Calc(mask)
        cnt = calc.ST(2, 'AF')
        puesto = Counter(u for u in U[mask] if u).most_common(1)
        puesto = puesto[0][0] if puesto else ''
        item = ITEM_BY_CAT.get(cat, 'Jugador Total')
        for nivel, k in NIVELES:
            row = {'C': item, 'D': p, 'E': puesto, 'F': cat, 'G': nivel, 'H': cnt, 'B': TODAY_SERIAL}
            for dcol, vcol in col_map.items():
                if k is None:                      # Desv. Estandar
                    v = calc.ST(7, dcol)
                    v = None if v is None or np.isnan(v) else v
                else:
                    v = calc.value({2: 5, 1: 6, 0: 7, -1: 8, -2: 9}[k], dcol)
                row[vcol] = v
            row['_key'] = f'{item}{p}{puesto}{cat}{nivel}'
            out_rows.append(row)
            review.append({'Item': item, 'Nombre': p, 'Puesto': puesto, 'Minutos': cat, 'Categoría': nivel, 'Cuenta': cnt,
                           **{(hdr13[C(d) - 1] or d).strip(): row[v] for d, v in col_map.items()}})
print(f'Combinaciones con datos: {len(out_rows)//6}  (filas VR: {len(out_rows)});  sin casos: {len(skipped)}')

pd.DataFrame(review).to_excel(REVIEW, index=False)
print('Resumen de control:', REVIEW)

# ---------------------------------------------------------------- 6. inyectar en el XML de la hoja VR
zin = zipfile.ZipFile(SRC)
wbxml = zin.read('xl/workbook.xml').decode('utf-8')
rels = zin.read('xl/_rels/workbook.xml.rels').decode('utf-8')
rid = re.search(r'<sheet [^>]*name="%s"[^>]*r:id="(rId\d+)"' % VR_SHEET, wbxml).group(1)
target = re.search(r'<Relationship [^>]*Id="%s"[^>]*Target="([^"]+)"' % rid, rels) or \
         re.search(r'<Relationship [^>]*Target="([^"]+)"[^>]*Id="%s"' % rid, rels)
vr_part = 'xl/' + target.group(1).lstrip('/').replace('xl/', '')
print('Parte XML de VR:', vr_part)
sx = zin.read(vr_part).decode('utf-8')

def col_idx(ref):
    return C(re.match(r'[A-Z]+', ref).group(0))

def fmt_num(v):
    v = float(v)
    return str(int(v)) if v.is_integer() and abs(v) < 1e15 else repr(v)

def render_cell(ref, s_attr, value, existing=None):
    """devuelve el xml de la celda; conserva el estilo; 'existing' es el xml previo (para la formula de A)."""
    s = f' s="{s_attr}"' if s_attr else ''
    if existing is not None and '<f' in existing:            # celda con formula (columna A): solo actualizar <v>
        fm = re.search(r'<f[^>]*?(?:/>|>.*?</f>)', existing, re.S).group(0)
        return f'<c r="{ref}"{s} t="str">{fm}<v>{html.escape(str(value), quote=False)}</v></c>'
    if value is None:
        return f'<c r="{ref}"{s}/>'
    if isinstance(value, str):
        return f'<c r="{ref}"{s} t="inlineStr"><is><t>{html.escape(value, quote=False)}</t></is></c>'
    return f'<c r="{ref}"{s}><v>{fmt_num(value)}</v></c>'

row_re = re.compile(r'<row r="(\d+)"([^>]*?)(?:/>|>(.*?)</row>)', re.S)
cell_re = re.compile(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', re.S)

# indexar filas existentes
rows_xml = {}
for m in row_re.finditer(sx):
    rows_xml[int(m.group(1))] = m
needed = range(VR_FIRST_FREE_ROW, VR_FIRST_FREE_ROW + len(out_rows))
missing = [r for r in needed if r not in rows_xml]
if missing:
    raise SystemExit(f'La hoja VR no tiene filas pre-formateadas suficientes; faltan {len(missing)} (desde {missing[0]}). Ampliar VR_FIRST_FREE_ROW o el formato.')

replacements = []
for r, data in zip(needed, out_rows):
    m = rows_xml[r]
    attrs, inner = m.group(2), m.group(3) or ''
    cells = {}
    for cm in cell_re.finditer(inner):
        cells[cm.group(1)] = (cm.group(3), cm.group(0))
    def s_of(col):
        a = cells.get(col, ('', ''))[0]
        sm = re.search(r's="(\d+)"', a)
        return sm.group(1) if sm else None
    new_cells = {}
    for col, (a, whole) in cells.items():
        new_cells[col] = whole
    # A: formula existente (C&D&E&F&G) con valor cacheado
    a_existing = cells.get('A', (None, None))[1]
    if a_existing and '<f' in a_existing:
        new_cells['A'] = render_cell(f'A{r}', s_of('A'), data['_key'], existing=a_existing)
    else:
        new_cells['A'] = f'<c r="A{r}"{(" s=%s" % chr(34)+s_of("A")+chr(34)) if s_of("A") else ""} t="str"><f>C{r}&amp;D{r}&amp;E{r}&amp;F{r}&amp;G{r}</f><v>{html.escape(data["_key"], quote=False)}</v></c>'
    for col, v in data.items():
        if col.startswith('_') or col == 'A':
            continue
        new_cells[col] = render_cell(f'{col}{r}', s_of(col), v)
    ordered = ''.join(new_cells[c] for c in sorted(new_cells, key=C))
    new_row = f'<row r="{r}"{attrs}>{ordered}</row>'
    replacements.append((m.start(), m.end(), new_row))

# aplicar de atras hacia adelante
parts = []; last = len(sx)
for start, end, new in sorted(replacements, reverse=True):
    parts.append(sx[end:last]); parts.append(new); last = start
parts.append(sx[:last])
sx_new = ''.join(reversed(parts))

# forzar recalculo completo al abrir (para que A y las VLOOKUP de 'Data GPS Partido' tomen las filas nuevas)
if 'fullCalcOnLoad' not in wbxml:
    wbxml_new = re.sub(r'<calcPr([^>]*?)/>', r'<calcPr\1 fullCalcOnLoad="1"/>', wbxml, count=1)
else:
    wbxml_new = wbxml

zout = zipfile.ZipFile(DST, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    if item.filename == vr_part:
        zout.writestr(item, sx_new.encode('utf-8'))
    elif item.filename == 'xl/workbook.xml':
        zout.writestr(item, wbxml_new.encode('utf-8'))
    else:
        zout.writestr(item, zin.read(item.filename))
zout.close()
print('Archivo generado:', DST)
