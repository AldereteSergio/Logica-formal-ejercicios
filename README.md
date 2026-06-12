# Russell-Whitehead Logic Matrix Board

Tabla de verdad interactiva con notación lógica de **Principia Mathematica** (Russell & Whitehead). Practica, valida y comparte ejercicios de lógica proposicional — **sin publicidad**.

## Demo en vivo

**[Abrir la aplicación](https://sergio.github.io/tabla-de-verdades/)**

> Actualizá la URL en `src/config.ts` cuando publiques el repo con tu usuario/organización de GitHub.

## Vista previa

![Captura de la tabla de verdad interactiva](./docs/preview.svg)

<!-- Reemplazá la imagen anterior por un GIF real cuando lo grabes:
![Demo animada](./docs/demo.gif)
-->

Para grabar el GIF:
1. `npm run dev`
2. Resolvé un ejercicio y validá la tabla
3. Usá [ScreenToGif](https://www.screentogif.com/) o similar
4. Guardá como `docs/demo.gif` y actualizá este README

## Características

- Notación Russell-Whitehead: `~`, `·`, `v`, `⊃`, `≡`
- Tabla interactiva con validación celda por celda
- Generador aleatorio de ejercicios (2–4 variables)
- Importación y exportación CSV
- Enlaces compartibles con fórmula en la URL (`?formula=...`)
- Modo claro/oscuro
- 100% cliente, sin backend

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests de lógica
npm run build    # compila a dist/
npm run preview  # previsualiza el build
```

## Despliegue en GitHub Pages

El workflow [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) publica automáticamente en cada push a `main`.

**Pasos una sola vez en GitHub:**

1. Creá el repositorio `tabla-de-verdades` (o ajustá `src/config.ts` y `vite.config.ts`)
2. Subí el código: `git push -u origin main`
3. En **Settings → Pages → Build and deployment**, elegí **GitHub Actions**
4. Tras el primer deploy, actualizá `SITE_URL` en `src/config.ts` si la URL difiere

## Topics del repositorio

Configurá topics para que otros te encuentren en GitHub:

```bash
npm run setup:github-topics
```

O manualmente en **Settings → General → Topics**:

`logic` · `truth-table` · `education` · `propositional-logic` · `russell-whitehead` · `principia-mathematica` · `react` · `typescript`

## Difusión (listas y comunidades)

Acciones manuales de alto impacto — copiá el pitch y enviálo donde corresponda:

| Dónde | Enlace | Qué hacer |
|-------|--------|-----------|
| Reddit r/logic | https://www.reddit.com/r/logic/ | Post con demo + enlace |
| Reddit r/philosophyofmath | https://www.reddit.com/r/philosophyofmath/ | Mismo pitch, enfoque histórico |
| MathOverflow (meta) | https://mathoverflow.net/ | Solo si encaja con una pregunta existente |
| Hacker News (Show HN) | https://news.ycombinator.com/submit | Título: *Show HN: Interactive truth table with Principia Mathematica notation* |
| Awesome lists | Buscar *awesome logic* / *awesome math* | PR agregando el enlace del demo |

**Pitch sugerido:**

> Herramienta web gratuita para practicar tablas de verdad con la notación de Russell-Whitehead (Principia Mathematica). Validación interactiva, ejercicios aleatorios, import CSV y enlaces compartibles. Sin publicidad. [Demo](https://sergio.github.io/tabla-de-verdades/) · [Código](https://github.com/Sergio/tabla-de-verdades)

## Apoyar el proyecto

Si te resultó útil, **[dejanos una estrella en GitHub](https://github.com/Sergio/tabla-de-verdades)** — ayuda a mantener el proyecto visible y sin publicidad.

## Licencia

MIT (o la que elijas al publicar).
