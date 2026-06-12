#!/usr/bin/env node
/**
 * Configura los topics del repositorio en GitHub.
 * Requiere: gh CLI autenticado (gh auth login)
 *
 * Uso: npm run setup:github-topics
 */
import { execSync } from 'child_process';

const topics = [
  'logic',
  'truth-table',
  'education',
  'propositional-logic',
  'russell-whitehead',
  'principia-mathematica',
  'react',
  'typescript',
];

try {
  execSync('gh --version', { stdio: 'ignore' });
} catch {
  console.error('Instalá y autenticá GitHub CLI: https://cli.github.com/');
  console.error('Topics sugeridos (configuralos manualmente en GitHub):');
  console.error(topics.join(', '));
  process.exit(1);
}

const topicFlags = topics.map((t) => `--add-topic ${t}`).join(' ');
execSync(`gh repo edit ${topicFlags}`, { stdio: 'inherit' });
console.log('Topics configurados correctamente.');
