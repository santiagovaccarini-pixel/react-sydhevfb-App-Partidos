# Instrucciones de diseño en Claude Code Cloud

## Qué se carga

| Archivo | Función |
| --- | --- |
| `CLAUDE.md` | Instrucciones persistentes que indican aplicar la Skill por defecto en todo trabajo de interfaz, incluso si el pedido no menciona diseño. |
| `.claude/skills/sports-ux-ui/SKILL.md` | Estándar general de diseño y usabilidad, disponible para selección automática por su descripción y también con `/sports-ux-ui`. |
| `docs/DESIGN_SYSTEM.md` | Fuente de criterios de estética, componentes, tablas, reportes y navegación. |
| `docs/UI_DECISIONS.md` y `docs/PENDIENTES.md` | Decisiones existentes, excepciones, descartes y pendientes por módulo. |

Las sesiones cloud cargan las Skills de proyecto incluidas en el repositorio
clonado. No hace falta instalar esta Skill en tu computadora ni subirla como
plugin. `CLAUDE.md` se lee como instrucciones del proyecto; el cuerpo de la Skill
se carga cuando se usa. Son instrucciones para el asistente, no una garantía
automática de calidad ni una modificación de la aplicación.

En el uso normal pedís lo que necesitás, sin agregar «hacelo premium» ni indicar
retoques visuales uno por uno. El estándar define cómo debe resolverse la interfaz.
No se agregan hooks ni permisos especiales: CLAUDE.md establece la regla y la
descripción de la Skill facilita su selección automática. La prueba siguiente
permite comprobar que Claude la aplica en tu entorno.

## Probar antes de unir el PR

1. Abrí Claude Code en la nube y elegí el repositorio
   `santiagovaccarini-pixel/react-sydhevfb-App-Partidos`.
2. Elegí `main` si la actualización que querés probar ya está integrada. Para un
   PR abierto, elegí su rama de trabajo. Iniciá una sesión nueva con esa rama:
   no alcanza con que los archivos estén en otra rama o en un chat anterior.
3. Pegá este pedido de revisión sin cambios:

   ```text
   /sports-ux-ui Revisá el reporte individual de Lesiones sin editar archivos.
   Leé CLAUDE.md, la Skill, DESIGN_SYSTEM.md y las decisiones vigentes. Decime
   tres mejoras concretas de legibilidad y jerarquía compatibles con lo aprobado,
   qué componentes reutilizarías y cómo las verificarías en celular y al imprimir.
   Explicá cómo aplicarías la dirección visual documentada y qué tomarías de las
   referencias, sin copiar sus datos ni agregar sus funciones.
   Separá las propuestas de las decisiones existentes. No agregues métricas.
   ```

4. Comprobá que la respuesta identifica los archivos consultados, propone mejoras
   dentro del alcance, conserva cálculos y decisiones, y no afirma haber visto una
   imagen ausente. Debe explicar la jerarquía, la lectura y la facilidad de uso con
   los criterios del sistema de diseño. No debe modificar archivos.
   Debe reconocer negro/grafito y dorado como identidad, separar colores de marca
   y de datos, justificar la composición y conservar los descartes. Una descripción
   genérica de «premium» o tomar «Editorial»/«Analítico» como ejemplos aprobados no
   cumple. Si no tiene las capturas en el checkout, debe usar el registro escrito
   y no afirmar haberlas visto.
5. Para probar la selección automática, iniciá otra sesión desde la misma rama y
   pedí: «Explicame sin editar cómo simplificarías la navegación para consultar un
   reporte de lesiones, respetando lo que ya está decidido». Sin mencionar la Skill
   ni repetir preferencias estéticas, Claude debería usar `sports-ux-ui` y explicar
   la propuesta con el estándar general. Si no la elige, invocá `/sports-ux-ui` y
   comprobá su descubrimiento con el apartado siguiente.

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

Después de la revisión, pedí la función o mejora que necesites, por ejemplo:
«Aplicá la mejora de navegación que propusiste». Claude debe aplicar el estándar
general sin pedirte que diseñes cada detalle ni volver a acordar la estética.
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
