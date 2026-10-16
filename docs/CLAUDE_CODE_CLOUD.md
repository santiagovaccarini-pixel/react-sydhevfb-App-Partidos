# Instrucciones de diseño en Claude Code Cloud

## Qué se carga

| Archivo | Función |
| --- | --- |
| `CLAUDE.md` | Instrucciones generales persistentes del proyecto y vínculo a la Skill. |
| `.claude/skills/sports-ux-ui/SKILL.md` | Procedimiento de diseño que Claude puede elegir cuando corresponda o que podés invocar con `/sports-ux-ui`. |
| `docs/DESIGN_SYSTEM.md` | Fuente de criterios de estética, componentes, tablas, reportes y navegación. |
| `docs/UI_DECISIONS.md` y `docs/PENDIENTES.md` | Decisiones existentes, excepciones, descartes y pendientes por módulo. |

Las sesiones cloud cargan las Skills de proyecto incluidas en el repositorio
clonado. No hace falta instalar esta Skill en tu computadora ni subirla como
plugin. `CLAUDE.md` se lee como instrucciones del proyecto; el cuerpo de la Skill
se carga cuando se usa. Son instrucciones para el asistente, no una garantía
automática de calidad ni una modificación de la aplicación.

## Probar antes de unir el PR

1. Abrí Claude Code en la nube y elegí el repositorio
   `santiagovaccarini-pixel/react-sydhevfb-App-Partidos`.
2. Elegí como rama de partida la que contiene este cambio:
   `docs/sports-ux-ui-claude-cloud`. Iniciá una sesión nueva con esa rama. Si tu
   interfaz no permite elegirla, podés probar después de unir el PR, en una sesión
   nueva desde `main`; no alcanza con que los archivos estén en otra rama.
3. Pegá este pedido de revisión sin cambios:

   ```text
   /sports-ux-ui Revisá el reporte individual de Lesiones sin editar archivos.
   Leé CLAUDE.md, la Skill, DESIGN_SYSTEM.md y las decisiones vigentes. Decime
   tres mejoras concretas de legibilidad y jerarquía compatibles con lo aprobado,
   qué componentes reutilizarías y cómo las verificarías en celular y al imprimir.
   Separá las propuestas de las decisiones existentes. No agregues métricas.
   ```

4. Comprobá que la respuesta identifica los archivos consultados, propone mejoras
   dentro del alcance, conserva cálculos y decisiones, y no afirma haber visto una
   imagen ausente. Debe respetar las tarjetas compactas del individual y dejar
   pendiente la combinación con la imagen oscura. No debe modificar archivos.
5. Para probar la selección automática, iniciá otra sesión desde la misma rama y
   pedí: «Revisá sin editar la presentación de la tabla de GPS › Informe. Aplicá
   los criterios visuales del proyecto y explicá qué reutilizarías». Claude debería
   usar `sports-ux-ui`, conservar los números centrados y no sugerir recuperar las
   tarjetas de promedios descartadas. Si no la elige, invocá `/sports-ux-ui` y
   comprobá su descubrimiento con el paso siguiente.

## Si no aparece o no sigue el estilo

- Pedile que compruebe la rama de partida y que existen `CLAUDE.md` y
  `.claude/skills/sports-ux-ui/SKILL.md` en el checkout de esa sesión. La rama de
  trabajo creada por Claude puede tener otro nombre; lo que importa es su contenido.
- Comprobá que `SKILL.md` empieza con el bloque YAML, que el nombre es
  `sports-ux-ui` y que las rutas respetan mayúsculas y minúsculas. Invocá la Skill
  explícitamente; si acabás de incorporar los archivos, probá una sesión nueva.
- Si faltan archivos, revisá el PR o la rama elegida. Una sesión iniciada desde
  `main` antes de integrar el PR no tiene esta configuración.
- Si la descubre pero se aparta del pedido, señalá el criterio y la decisión
  concreta que incumple. Ajustá la fuente correspondiente sin duplicar todo el
  sistema de diseño en CLAUDE.md o en la Skill.

## Probar una mejora real

Después de la revisión, pedí una mejora acotada, por ejemplo: «Aplicá solo el
ajuste de espaciado que propusiste en esa pantalla; conservá lógica y navegación».
Revisá el diff y las pruebas que informe Claude. Para un cambio de código deben
ejecutarse las verificaciones de CLAUDE.md; si es visual, también un recorrido
en celular y escritorio y la impresión cuando corresponda. Si el entorno no
permite alguna comprobación, debe indicarla como pendiente.

Esta configuración inicial cambia solo documentación e instrucciones. Para
validarla alcanzan la revisión de contenido, las rutas y los enlaces; no requiere
migraciones, credenciales ni ejecutar la aplicación. Las pruebas de selección y
comportamiento en Claude Code Cloud se realizan en tu sesión, con los pasos de arriba.

## Referencias oficiales

Consultadas el 16/10/2026:

- [Skills: ubicación en el proyecto e invocación](https://code.claude.com/docs/en/skills).
- [Instrucciones persistentes con CLAUDE.md](https://code.claude.com/docs/en/memory).
- [Claude Code en la nube: repositorio y rama de trabajo](https://code.claude.com/docs/en/claude-code-on-the-web).
- [Inicio de una tarea: elegir repositorio y rama](https://code.claude.com/docs/en/web-quickstart#start-a-task).
