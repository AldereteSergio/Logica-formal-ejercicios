# Tablas de Verdad - Simbología Russell-Whitehead

Tabla de verdad interactiva con notación lógica de **Principia Mathematica** (Russell & Whitehead). Pensada para ayudar a estudiantes de la **UBA** (Filosofía, CBC, Exactas) y cualquier persona interesada en la lógica formal.

## Demo en vivo

**[Abrir la aplicación](https://alderetesergio.github.io/Logica-formal-ejercicios/)**

## Vista previa

![Captura de la tabla de verdad interactiva](./docs/preview.gif)


## Características

- **Notación Russell-Whitehead**: `~`, `·`, `v`, `⊃`, `≡`
- **Tabla interactiva**: Validación celda por celda en tiempo real.
- **Generador aleatorio**: Ejercicios de 2 a 4 variables para practicar.
- **Importación/Exportación CSV**: Guardá tus tablas o cargá ejercicios externos.
- **Enlaces compartibles**: Generá una URL con la fórmula precargada (`?formula=...`).
- **Modo Claro/Oscuro**: Porque la lógica no descansa de noche.
- **100% Cliente**: Privacidad total, sin backend.

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

**Pasos en GitHub:**

1. Subí el código: `git push -u origin main`
2. En **Settings → Pages → Build and deployment**, elegí **GitHub Actions**.

## Topics del repositorio

Configurá topics para que otros te encuentren en GitHub:

```bash
npm run setup:github-topics
```

O manualmente en **Settings → General → Topics**:

`logic` · `truth-table` · `education` · `propositional-logic` · `russell-whitehead` · `principia-mathematica` · `react` · `typescript` · `uba`

**Pitch sugerido:**

> Herramienta web gratuita para practicar tablas de verdad con la notación de Russell-Whitehead (Principia Mathematica). Ideal para estudiantes de la UBA. Validación interactiva, ejercicios aleatorios, import CSV y enlaces compartibles. Sin publicidad. [Demo](https://alderetesergio.github.io/Logica-formal-ejercicios/) · [Código](https://github.com/AldereteSergio/Logica-formal-ejercicios)

## Apoyar el proyecto

Si te resultó útil, **[dejanos una estrella en GitHub](https://github.com/AldereteSergio/Logica-formal-ejercicios)** — ayuda a mantener el proyecto visible y sin publicidad.

## Sobre el autor

Hecho con ❤️ por **Sergio Alderete**. 

## Licencia

MIT.
