/** Configuración central del proyecto — actualizá el repo cuando lo publiques en GitHub. */
export const GITHUB_REPO_URL = 'https://github.com/AldereteSergio/Logica-formal-ejercicios';
export const GITHUB_REPO_OWNER = 'AldereteSergio';
export const GITHUB_REPO_NAME = 'Logica-formal-ejercicios';

/** URL pública del demo (GitHub Pages). Ajustá si usás otro dominio. */
export const SITE_URL = `https://${GITHUB_REPO_OWNER.toLowerCase()}.github.io/${GITHUB_REPO_NAME}/`;

export const SITE_TITLE = 'Tablas de Verdad - Simbología Russell-Whitehead';
export const SITE_DESCRIPTION =
  'Tabla de verdad interactiva con notación de Principia Mathematica. Pensada para estudiantes de la UBA. Practica, valida y comparte ejercicios de lógica proposicional sin publicidad.';

/** Topics sugeridos para el repositorio en GitHub */
export const GITHUB_TOPICS = [
  'logic',
  'truth-table',
  'education',
  'propositional-logic',
  'russell-whitehead',
  'principia-mathematica',
  'react',
  'typescript',
] as const;
