# Encuesta de Clima 2026 · Agronorte

Reporte de resultados de la Encuesta de Clima (Work Environment Survey) para **Agronorte Oficial** (instance 181841, survey 435206), con segmentación por Departamento (Área), Jefe Directo, División, Género y Sucursal.

Sitio estático (HTML/CSS/JS sin build step) pensado para deploy directo en Vercel.

## Estructura

- `index.html` — estructura de la página
- `styles.css` — estilos (tokens de Humand Design System)
- `app.js` — lógica de filtros, render de gráficos y tablas
- `data.json` — dataset generado a partir de 3 queries de Redash:
  - `Agronorte 181841 | Clima 435206 | Favorabilidad por Dimensión (Seg, Jefe Directo, Departamento)` (id 61463)
  - `Agronorte 181841 | Clima 435206 | Participación por Dimensión` (id 61464)
  - `Agronorte 181841 | Clima 435206 | Detalle por Pregunta` (id 61465)

## Notas de datos

- Favorabilidad (verde) = % de respuestas "de acuerdo" / "totalmente de acuerdo" (top-2-box, escala 0-4). Negativo (rojo) = % de respuestas "en desacuerdo" / "totalmente en desacuerdo" (bottom-2-box). Neutral (amarillo) = el resto. eNPS se calcula y muestra igual que las demás dimensiones (topic "eNPS" del Core Form), y se destaca como KPI principal junto con la favorabilidad general.
- Los cortes segmentados solo se muestran para grupos con **3 o más respuestas** (anonimato).
- "Departamento" corresponde al grupo de segmentación **ÁREA** (este cliente no usa el módulo de Departments de Humand).
- "Jefe Directo" corresponde a `WorkEnvironmentSurveyUsers.directBossId`, congelado al momento de lanzar la encuesta.
- **Universo del reporte**: colaboradores invitados a la encuesta, activos (`Users.deletedAt IS NULL`) y con un ítem de segmentación de **Antigüedad** asignado al momento del lanzamiento (grupo de segmentación id 458642). Esto da **379** colaboradores de los 386 invitados originalmente — los 7 restantes quedaron afuera por estar dados de baja o no tener Antigüedad asignada al lanzar la encuesta, y no fueron considerados en ningún cálculo (favorabilidad, participación, etc.).
- Se excluyeron del reporte las segmentaciones de **Ropa de trabajo** y **Antigüedad**, a pedido del cliente.

## Desarrollo local

No requiere build. Basta con servir los archivos estáticos, por ejemplo:

```bash
npx serve .
```

## Deploy

Deploy automático vía Vercel al pushear a `main` (GitHub App de Vercel instalada en la organización Humand-CX).
