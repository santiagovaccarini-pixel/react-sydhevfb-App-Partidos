"""
Genera las filas de Valor Referencial (hoja VR) para cada jugador x categoria de tiempo,
replicando exactamente lo que muestran las filas 5..9 (Excelente..Malo) de la hoja
'Data GPS Partido' cuando se filtra por columna T (jugador) y columna DG (categoria).

Ademas:
  * Junta categorias por jugador segun las celdas PINTADAS en la hoja 'Tiempos por jugador'
    (celdas de un mismo color en la fila del jugador = un mismo grupo; el VR de cada categoria
    del grupo se calcula con los casos de todas las del grupo y queda en amarillo en VR).
  * Valida los datos por cuartiles (regla de Tukey: fuera de [Q1 - k*IQR, Q3 + k*IQR]) y
    excluye los valores atipicos del calculo, metrica por metrica. Las celdas afectadas quedan
    en naranja en VR y el detalle va a la hoja 'Atipicos' del resumen.

Uso:  python excel/generar_vr_jugadores.py  <entrada.xlsm>  <salida.xlsm>  [opciones]
        --sin-atipicos        no excluir valores atipicos
        --iqr-k 1.5           multiplicador del rango intercuartil (1.5 = regla clasica)
        --min-n-iqr 4         minimo de casos para aplicar la deteccion
        --sin-juntar          ignorar las celdas pintadas de 'Tiempos por jugador'
Ver:  excel/VALOR_REFERENCIAL.md
"""
import sys, re, zipfile, datetime, math, html, warnings, argparse
warnings.filterwarnings('ignore')
from collections import Counter, defaultdict
import numpy as np
import pandas as pd
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter as L, column_index_from_string as C

ap = argparse.ArgumentParser()
ap.add_argument('entrada', nargs='?', default='base.xlsm')
ap.add_argument('salida', nargs='?', default='salida.xlsm')
ap.add_argument('--sin-atipicos', action='store_true')
ap.add_argument('--iqr-k', type=float, default=1.5)
ap.add_argument('--min-n-iqr', type=int, default=4)
ap.add_argument('--sin-juntar', action='store_true')
ARGS = ap.parse_args()
SRC, DST = ARGS.entrada, ARGS.salida
REVIEW = DST.rsplit('.', 1)[0] + '_resumen.xlsx'

DATA_SHEET, VR_SHEET, PLAYERS_SHEET = 'Data GPS Partido', 'VR', 'Tiempos por jugador'
HDR_ROW, FIRST_DATA_ROW = 13, 15
FIRST_COL, LAST_COL = C('P'), C('DA')          # columnas con formulas Excelente..Malo
CATS = ['Sólo PT', 'Sólo ST', '>=30 y Final ST', '>=10 y <30 ST', '>=85', '>=70 y <85', 'PT + <25']
ITEM_BY_CAT = {'Sólo PT': 'Jugador PT', 'Sólo ST': 'Jugador ST'}   # resto -> Jugador Total
NIVELES = [('Excelente', 5), ('Muy Bueno', 6), ('Bueno', 7), ('Regular', 8), ('Malo', 9), ('Desv. Estándar', None)]
VR_FIRST_FREE_ROW = 166
TODAY_SERIAL = (datetime.date.today() - datetime.date(1899, 12, 30)).days
FILL_YELLOW_RGB = 'FFFFFF00'    # casos juntados de otra categoria (convencion del libro)
FILL_ORANGE_RGB = 'FFF4B183'    # valores atipicos excluidos del calculo
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'


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


def serial_to_date(v):
    try:
        return (datetime.datetime(1899, 12, 30) + datetime.timedelta(days=float(v))).date()
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- 0. partes XML del libro
zin = zipfile.ZipFile(SRC)
wbxml = zin.read('xl/workbook.xml').decode('utf-8')
rels = zin.read('xl/_rels/workbook.xml.rels').decode('utf-8')


def sheet_part(name):
    rid = re.search(r'<sheet [^>]*name="%s"[^>]*r:id="(rId\d+)"' % re.escape(name), wbxml).group(1)
    m = re.search(r'<Relationship [^>]*Id="%s"[^>]*Target="([^"]+)"' % rid, rels) or \
        re.search(r'<Relationship [^>]*Target="([^"]+)"[^>]*Id="%s"' % rid, rels)
    t = m.group(1)
    return t.lstrip('/') if t.startswith('/') else 'xl/' + t


styles_xml = zin.read('xl/styles.xml').decode('utf-8')
fills_block = re.search(r'<fills count="(\d+)">(.*?)</fills>', styles_xml, re.S)
fills_list = re.findall(r'<fill>.*?</fill>|<fill/>', fills_block.group(2), re.S)
xfs_block = re.search(r'<cellXfs count="(\d+)">(.*?)</cellXfs>', styles_xml, re.S)
xfs_list = re.findall(r'<xf [^>]*?(?:/>|>.*?</xf>)', xfs_block.group(2), re.S)
xf_fill = [int(re.search(r'fillId="(\d+)"', x).group(1)) for x in xfs_list]

# ---------------------------------------------------------------- 1. leer datos
print('Leyendo', SRC)
wbv = load_workbook(SRC, read_only=True, data_only=True)
wbf = load_workbook(SRC, read_only=True, data_only=False)
ws_v, ws_f = wbv[DATA_SHEET], wbf[DATA_SHEET]

hdr13 = next(ws_v.iter_rows(min_row=HDR_ROW, max_row=HDR_ROW, values_only=True))
ncols = len(hdr13)
players = [str(r[0]).strip() for r in wbv[PLAYERS_SHEET].iter_rows(min_row=2, max_col=1, values_only=True) if r[0]]
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
META = pd.DataFrame({'Caso': [r[C('C') - 1] for r in raw], 'Item': [r[C('D') - 1] for r in raw],
                     'Fecha': [r[C('E') - 1] for r in raw], 'Rival': [r[C('N') - 1] for r in raw]})

# ---------------------------------------------------------------- 2. grupos a juntar (celdas pintadas)
merge_groups = {}   # jugador -> {categoria: [categorias del grupo]}
if not ARGS.sin_juntar:
    pl_xml = zin.read(sheet_part(PLAYERS_SHEET)).decode('utf-8')
    ss = zin.read('xl/sharedStrings.xml').decode('utf-8') if 'xl/sharedStrings.xml' in zin.namelist() else ''
    sst = [html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', si, re.S)))
           for si in re.findall(r'<si>.*?</si>', ss, re.S)]

    def cell_text(c):
        v = re.search(r'<v>(.*?)</v>', c, re.S)
        if v is None:
            t = re.search(r'<is>.*?<t[^>]*>(.*?)</t>', c, re.S)
            return html.unescape(t.group(1)) if t else None
        if 't="s"' in c:
            return sst[int(v.group(1))]
        return html.unescape(v.group(1))

    cats_by_col = {}
    for c in re.findall(r'<c r="[A-Z]+1"[^>]*?(?:/>|>.*?</c>)', pl_xml, re.S):
        col = re.match(r'<c r="([A-Z]+)', c).group(1)
        txt = cell_text(c)
        if txt in CATS:
            cats_by_col[col] = txt
    for row in re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', pl_xml, re.S):
        rnum, inner = int(row[0]), row[1]
        if rnum < 2:
            continue
        cells = {re.match(r'<c r="([A-Z]+)', c).group(1): c
                 for c in re.findall(r'<c r="[A-Z]+\d+"[^>]*?(?:/>|>.*?</c>)', inner, re.S)}
        name = cell_text(cells['A']).strip() if 'A' in cells and cell_text(cells['A']) else None
        if not name:
            continue
        by_fill = defaultdict(list)
        for col, cat in cats_by_col.items():
            c = cells.get(col)
            if c is None:
                continue
            sm = re.search(r' s="(\d+)"', c)
            fid = xf_fill[int(sm.group(1))] if sm else 0
            if fid not in (0, 1):
                by_fill[fid].append(cat)
        groups = {}
        for fid, cats in by_fill.items():
            if len(cats) >= 2:
                for cat in cats:
                    groups[cat] = cats
            else:
                print(f'  Aviso: {name} / {cats[0]} esta pintada sola (sin otra categoria del mismo color); se ignora.')
        if groups:
            merge_groups[name] = groups
    print('Jugadores con categorias a juntar:', len(merge_groups))
    for p, g in merge_groups.items():
        seen = []
        for cats in g.values():
            if cats not in seen:
                seen.append(cats); print(f'   {p}: ' + ' + '.join(cats))

# ---------------------------------------------------------------- 3. formulas fila 5..9
frows = {i: next(ws_f.iter_rows(min_row=i, max_row=i, values_only=True)) for i in (5, 6, 7, 8, 9)}


def ftext(c):
    return getattr(c, 'text', c)


def split_args(s):
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
        c, a, b = split_args(f[start:i - 1])
        f = f[:m.start()] + f'(({a}) if ({c}) else ({b}))' + f[i:]
    f = re.sub(r'SUBTOTAL\((\d+),\$?([A-Z]+)\$?\d+:\$?[A-Z]+\$?\d+\)', r"ST(\1,'\2')", f)
    f = re.sub(r'\$?([A-Z]+)\$7\b', r"R7('\1')", f)
    f = f.replace('$N$4', 'N4').replace('="%"', '=="%"')
    f = re.sub(r'(?<![=<>!])=(?!=)', '==', f)
    return f


formulas = {}
for j in range(FIRST_COL - 1, LAST_COL):
    col = L(j + 1)
    f7 = ftext(frows[7][j])
    if not (isinstance(f7, str) and f7.startswith('=')):
        continue
    formulas[col] = {i: translate(ftext(frows[i][j])) for i in (5, 6, 7, 8, 9)}
print('Columnas con formula:', len(formulas))


class Calc:
    """Evalua las formulas de las filas 5..9 sobre un subconjunto de filas.
    excl: {columna objetivo: mascara booleana de filas a excluir (atipicos de esa columna)}"""

    def __init__(self, mask, excl=None):
        self.base = np.asarray(mask, dtype=bool)
        self.excl = excl or {}
        self.cur = self.base
        self.cache = {}

    def _use(self, col):
        e = self.excl.get(col)
        self.cur = self.base & ~e if e is not None else self.base

    def ST(self, n, col):
        s = num[col][self.cur].dropna()
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
        # referencia a la fila 7 de la misma columna objetivo: misma mascara
        return self._eval(7, col)

    def _eval(self, row, col):
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

    def value(self, row, col):
        self._use(col)
        return self._eval(row, col)

    def std(self, col):
        self._use(col)
        v = self.ST(7, col)
        return None if v is None or np.isnan(v) else float(v)

    def count(self, col):
        self.cur = self.base          # casos del grupo, sin descontar atipicos (como SUBTOTAL(2) en AF1)
        return int(self.ST(2, col))


# ---------------------------------------------------------------- 4. validar contra valores cacheados (sin filtro)
cached = {i: next(ws_v.iter_rows(min_row=i, max_row=i, values_only=True)) for i in (5, 6, 7, 8, 9)}
calc_all = Calc(np.ones(len(num), dtype=bool))
bad = []
for col in formulas:
    for i in (5, 6, 7, 8, 9):
        exp = to_num(cached[i][C(col) - 1]); got = calc_all.value(i, col)
        if got is None and np.isnan(exp):
            continue
        if got is None or np.isnan(exp) or abs(got - exp) > 1e-6 * max(1, abs(exp)):
            bad.append((col, i, exp, got))
bad_cols = sorted({b[0] for b in bad}, key=C)
print('Validacion vs Excel (sin filtro): columnas con diferencias =', bad_cols,
      '(P:S usan rangos hasta la fila 5216 en el libro; no van a VR)' if bad_cols else '')

# ---------------------------------------------------------------- 5. mapa de columnas Data -> VR
ws_vr = wbv[VR_SHEET]
vr_hdr = next(ws_vr.iter_rows(min_row=2, max_row=2, values_only=True))
vr_by_norm = {}
for j, h in enumerate(vr_hdr):
    if h is not None and norm(h) not in vr_by_norm:
        vr_by_norm[norm(h)] = L(j + 1)
col_map = {}
unmatched = []
for j in range(C('AE') - 1, LAST_COL):
    col = L(j + 1); h = hdr13[j]
    if h is None or (col not in formulas and col != 'AE'):
        continue
    key = norm(h)
    if key in vr_by_norm:
        col_map[col] = vr_by_norm[key]
    else:
        unmatched.append((col, h))
if any(c in bad_cols for c in col_map):
    raise SystemExit('Hay columnas que van a VR cuya formula no se pudo replicar: ' + str([c for c in col_map if c in bad_cols]))
print('Columnas mapeadas a VR:', len(col_map), '| sin correspondencia en VR:', unmatched)
metric_name = {d: str(hdr13[C(d) - 1]).strip() for d in col_map}

# ---------------------------------------------------------------- 6. calcular por jugador x categoria
out_rows, review, skipped, outliers, combos = [], [], [], [], []
for p in players:
    for cat in CATS:
        own = ((T == p) & (DG == cat)).to_numpy()
        n_own = int(own.sum())
        group = merge_groups.get(p, {}).get(cat)
        if group:
            mask = ((T == p) & DG.isin(group)).to_numpy()
        else:
            mask = own
        n = int(mask.sum())
        if n == 0:
            skipped.append((p, cat)); continue

        # --- atipicos por cuartiles, metrica por metrica
        excl, n_out_by_col = {}, {}
        if not ARGS.sin_atipicos:
            idx = np.flatnonzero(mask)
            for dcol in col_map:
                vals = num[dcol].to_numpy()[idx]
                ok = ~np.isnan(vals)
                if ok.sum() < ARGS.min_n_iqr:
                    continue
                q1, q3 = np.percentile(vals[ok], [25, 75])      # = CUARTIL.INC de Excel
                iqr = q3 - q1
                if iqr == 0:            # sin dispersion entre cuartiles no hay con que juzgar: no se marca nada
                    continue
                lo, hi = q1 - ARGS.iqr_k * iqr, q3 + ARGS.iqr_k * iqr
                bad_rows = idx[ok & ((vals < lo) | (vals > hi))]
                if len(bad_rows):
                    m = np.zeros(len(num), dtype=bool); m[bad_rows] = True
                    excl[dcol] = m; n_out_by_col[dcol] = len(bad_rows)
                    for ridx in bad_rows:
                        outliers.append({'Jugador': p, 'Categoría VR': cat,
                                         'Categoría del caso': DG[ridx], 'Item': META.Item[ridx],
                                         'Caso': META.Caso[ridx], 'Fecha': META.Fecha[ridx], 'Rival': META.Rival[ridx],
                                         'Métrica': metric_name[dcol], 'Columna': dcol,
                                         'Valor': float(num[dcol][ridx]), 'Límite inferior': lo, 'Límite superior': hi,
                                         'Q1': q1, 'Q3': q3, 'n': int(ok.sum())})
        calc = Calc(mask, excl)
        cnt = calc.count('AF')
        puesto = Counter(u for u in U[mask] if u).most_common(1)
        puesto = puesto[0][0] if puesto else ''
        item = ITEM_BY_CAT.get(cat, 'Jugador Total')
        combos.append({'Jugador': p, 'Categoría': cat, 'Casos propios': n_own, 'Casos usados': n,
                       'Juntada con': ' + '.join(c for c in group if c != cat) if group else '',
                       'Métricas con atípicos': len(n_out_by_col), 'Valores atípicos excluidos': sum(n_out_by_col.values())})
        for nivel, frow in NIVELES:
            row = {'C': item, 'D': p, 'E': puesto, 'F': cat, 'G': nivel, 'H': cnt, 'B': TODAY_SERIAL}
            for dcol, vcol in col_map.items():
                row[vcol] = calc.std(dcol) if frow is None else calc.value(frow, dcol)
            row['_key'] = f'{item}{p}{puesto}{cat}{nivel}'
            row['_merged'] = bool(group)
            row['_outcols'] = {col_map[d] for d in n_out_by_col}
            out_rows.append(row)
            review.append({'Item': item, 'Nombre': p, 'Puesto': puesto, 'Minutos': cat, 'Categoría': nivel, 'Cuenta': cnt,
                           'Juntada con': combos[-1]['Juntada con'], 'Atípicos excluidos': combos[-1]['Valores atípicos excluidos'],
                           **{metric_name[d]: row[v] for d, v in col_map.items()}})
print(f'Combinaciones con datos: {len(combos)}  (filas VR: {len(out_rows)});  sin casos: {len(skipped)}')
print(f'Combinaciones juntadas: {sum(1 for c in combos if c["Juntada con"])};  valores atipicos excluidos: {len(outliers)}'
      f' en {sum(1 for c in combos if c["Valores atípicos excluidos"])} combinaciones')

with pd.ExcelWriter(REVIEW) as xw:
    pd.DataFrame(review).to_excel(xw, sheet_name='VR', index=False)
    pd.DataFrame(combos).to_excel(xw, sheet_name='Combinaciones', index=False)
    df_out = pd.DataFrame(outliers)
    if len(df_out):
        df_out['Fecha'] = pd.to_datetime(df_out['Fecha'], errors='coerce').dt.date
    df_out.to_excel(xw, sheet_name='Atípicos', index=False)
    pd.DataFrame({'Leyenda': [
        'Amarillo en VR: la categoría se calculó juntando sus casos con otra(s) categoría(s) del mismo jugador (celdas pintadas en Tiempos por jugador).',
        f'Naranja en VR: en esa métrica se excluyeron valores atípicos (fuera de Q1 - {ARGS.iqr_k}·IQR, Q3 + {ARGS.iqr_k}·IQR; se aplica con {ARGS.min_n_iqr} o más casos).',
        'Cuenta (H) es la cantidad de casos usados; el detalle de cada valor excluido está en la hoja Atípicos.',
        'Excelente/Muy Bueno/Regular/Malo = Bueno ± 2/1 desvíos; Desv. Estándar = desvío muestral, igual que las filas 5..9 de Data GPS Partido.']}).to_excel(xw, sheet_name='Leyenda', index=False)
print('Resumen de control:', REVIEW)

# ---------------------------------------------------------------- 7. estilos: variantes con relleno amarillo / naranja
fills_new = list(fills_list)
def fill_id_for(rgb):
    for i, f in enumerate(fills_new):
        if f'rgb="{rgb}"' in f and 'patternType="solid"' in f:
            return i
    fills_new.append(f'<fill><patternFill patternType="solid"><fgColor rgb="{rgb}"/><bgColor indexed="64"/></patternFill></fill>')
    return len(fills_new) - 1
FILL_Y, FILL_O = fill_id_for(FILL_YELLOW_RGB), fill_id_for(FILL_ORANGE_RGB)
xfs_new = list(xfs_list)
variant_cache = {}
def styled(s_attr, fill):
    """id de estilo igual a s_attr pero con el relleno dado"""
    key = (s_attr, fill)
    if key not in variant_cache:
        base = xfs_new[int(s_attr)] if s_attr else '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        x = re.sub(r'fillId="\d+"', f'fillId="{fill}"', base, count=1)
        if 'applyFill=' in x:
            x = re.sub(r'applyFill="\d"', 'applyFill="1"', x, count=1)
        else:
            x = x.replace('<xf ', '<xf applyFill="1" ', 1)
        xfs_new.append(x); variant_cache[key] = str(len(xfs_new) - 1)
    return variant_cache[key]

# ---------------------------------------------------------------- 8. inyectar en el XML de la hoja VR
vr_part = sheet_part(VR_SHEET)
print('Parte XML de VR:', vr_part)
sx = zin.read(vr_part).decode('utf-8')


def fmt_num(v):
    v = float(v)
    return str(int(v)) if v.is_integer() and abs(v) < 1e15 else repr(v)


def render_cell(ref, s_attr, value, existing=None):
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
rows_xml = {int(m.group(1)): m for m in row_re.finditer(sx)}
needed = range(VR_FIRST_FREE_ROW, VR_FIRST_FREE_ROW + len(out_rows))
missing = [r for r in needed if r not in rows_xml]
if missing:
    raise SystemExit(f'La hoja VR no tiene filas pre-formateadas suficientes; faltan {len(missing)} (desde {missing[0]}).')

replacements = []
for r, data in zip(needed, out_rows):
    m = rows_xml[r]
    attrs, inner = m.group(2), m.group(3) or ''
    cells = {cm.group(1): (cm.group(3), cm.group(0)) for cm in cell_re.finditer(inner)}

    def s_of(col):
        a = cells.get(col, ('', ''))[0]
        sm = re.search(r's="(\d+)"', a)
        return sm.group(1) if sm else None

    new_cells = {col: whole for col, (a, whole) in cells.items()}
    a_existing = cells.get('A', (None, None))[1]
    if a_existing and '<f' in a_existing:
        new_cells['A'] = render_cell(f'A{r}', s_of('A'), data['_key'], existing=a_existing)
    else:
        sa = s_of('A'); sattr = f' s="{sa}"' if sa else ''
        new_cells['A'] = f'<c r="A{r}"{sattr} t="str"><f>C{r}&amp;D{r}&amp;E{r}&amp;F{r}&amp;G{r}</f><v>{html.escape(data["_key"], quote=False)}</v></c>'
    for col, v in data.items():
        if col.startswith('_') or col == 'A':
            continue
        s = s_of(col)
        if col in data['_outcols']:
            s = styled(s, FILL_O)
        elif data['_merged']:
            s = styled(s, FILL_Y)
        new_cells[col] = render_cell(f'{col}{r}', s, v)
    ordered = ''.join(new_cells[c] for c in sorted(new_cells, key=C))
    replacements.append((m.start(), m.end(), f'<row r="{r}"{attrs}>{ordered}</row>'))

parts, last = [], len(sx)
for start, end, new in sorted(replacements, reverse=True):
    parts.append(sx[end:last]); parts.append(new); last = start
parts.append(sx[:last])
sx_new = ''.join(reversed(parts))

# estilos nuevos
styles_new = styles_xml
if len(fills_new) != len(fills_list):
    styles_new = styles_new.replace(fills_block.group(0), f'<fills count="{len(fills_new)}">' + ''.join(fills_new) + '</fills>', 1)
if len(xfs_new) != len(xfs_list):
    styles_new = styles_new.replace(xfs_block.group(0), f'<cellXfs count="{len(xfs_new)}">' + ''.join(xfs_new) + '</cellXfs>', 1)
print(f'Estilos: {len(xfs_new) - len(xfs_list)} variantes de relleno agregadas')

# recalculo completo al abrir (para que A y las VLOOKUP de 'Data GPS Partido' tomen las filas nuevas)
wbxml_new = wbxml if 'fullCalcOnLoad' in wbxml else re.sub(r'<calcPr([^>]*?)/>', r'<calcPr\1 fullCalcOnLoad="1"/>', wbxml, count=1)

zout = zipfile.ZipFile(DST, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    if item.filename == vr_part:
        zout.writestr(item, sx_new.encode('utf-8'))
    elif item.filename == 'xl/workbook.xml':
        zout.writestr(item, wbxml_new.encode('utf-8'))
    elif item.filename == 'xl/styles.xml':
        zout.writestr(item, styles_new.encode('utf-8'))
    else:
        zout.writestr(item, zin.read(item.filename))
zout.close()
print('Archivo generado:', DST)
