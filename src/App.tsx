import { useState, useEffect } from 'react';
import { GITHUB_REPO_URL } from './config';

// ==========================================
// 1. ANALIZADOR DE LÓGICA PROPOSICIONAL (AST)
// ==========================================

export interface Token {
  type: 'paren' | 'op_neg' | 'op_and' | 'op_or' | 'op_impl' | 'op_equiv' | 'var';
  value: string;
  index: number;
}

export type ASTNode =
  | { type: 'var'; name: string; token: Token }
  | { type: 'unary'; op: string; operand: ASTNode; token: Token }
  | { type: 'binary'; op: string; left: ASTNode; right: ASTNode; token: Token };

export interface CheckFormulaResult {
  valid: boolean;
  error?: string;
  variables?: string[];
  tokens?: Token[];
  ast?: ASTNode;
}

// Normaliza los símbolos de entrada al formato estándar Russell-Whitehead
export function normalizeFormula(str: string): string {
  return str
    .replace(/<->|=/g, '≡')
    .replace(/->|>/g, '⊃')
    .replace(/¬|-/g, '~')
    .replace(/\*|&|\^|\./g, '·')
    .replace(/V|\+/g, 'v')
    .replace(/\s+/g, ' ');
}

// Tokenizador para dividir la fórmula en componentes manejables
export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < formula.length) {
    const char = formula[i];
    if (char === ' ' || char === '\t') {
      i++;
      continue;
    }
    if (char === '(' || char === ')' || char === '[' || char === ']' || char === '{' || char === '}') {
      tokens.push({ type: 'paren', value: char, index: i });
      i++;
    } else if (char === '~') {
      tokens.push({ type: 'op_neg', value: '~', index: i });
      i++;
    } else if (char === '·') {
      tokens.push({ type: 'op_and', value: '·', index: i });
      i++;
    } else if (char === 'v') {
      tokens.push({ type: 'op_or', value: 'v', index: i });
      i++;
    } else if (char === '⊃') {
      tokens.push({ type: 'op_impl', value: '⊃', index: i });
      i++;
    } else if (char === '≡') {
      tokens.push({ type: 'op_equiv', value: '≡', index: i });
      i++;
    } else if (/[pqrstuwxyz]/i.test(char)) {
      tokens.push({ type: 'var', value: char.toLowerCase(), index: i });
      i++;
    } else {
      // Ignora caracteres no reconocidos para evitar bloqueos
      i++;
    }
  }
  return tokens;
}

// Parser de Descenso Recursivo para crear el Árbol de Sintaxis Abstracta (AST)
export function parse(tokens: Token[]): ASTNode {
  let index = 0;

  function peek(): Token | undefined {
    return tokens[index];
  }

  function parseExpression(): ASTNode {
    return parseEquiv();
  }

  function parseEquiv(): ASTNode {
    let node = parseImpl();
    while (peek() && peek()!.type === 'op_equiv') {
      const opToken = tokens[index++];
      const right = parseImpl();
      node = { type: 'binary', op: '≡', left: node, right: right, token: opToken };
    }
    return node;
  }

  function parseImpl(): ASTNode {
    let node = parseOr();
    while (peek() && peek()!.type === 'op_impl') {
      const opToken = tokens[index++];
      const right = parseOr();
      node = { type: 'binary', op: '⊃', left: node, right: right, token: opToken };
    }
    return node;
  }

  function parseOr(): ASTNode {
    let node = parseAnd();
    while (peek() && peek()!.type === 'op_or') {
      const opToken = tokens[index++];
      const right = parseAnd();
      node = { type: 'binary', op: 'v', left: node, right: right, token: opToken };
    }
    return node;
  }

  function parseAnd(): ASTNode {
    let node = parseNeg();
    while (peek() && peek()!.type === 'op_and') {
      const opToken = tokens[index++];
      const right = parseNeg();
      node = { type: 'binary', op: '·', left: node, right: right, token: opToken };
    }
    return node;
  }

  function parseNeg(): ASTNode {
    if (peek() && peek()!.type === 'op_neg') {
      const opToken = tokens[index++];
      const operand = parseNeg();
      return { type: 'unary', op: '~', operand: operand, token: opToken };
    }
    return parsePrimary();
  }

  function parsePrimary(): ASTNode {
    const token = peek();
    if (!token) {
      throw new Error('Fórmula incompleta o con operadores sin variables.');
    }
    if (token.type === 'var') {
      index++;
      return { type: 'var', name: token.value, token: token };
    } else if (
      token.type === 'paren' &&
      (token.value === '(' || token.value === '[' || token.value === '{')
    ) {
      const openChar = token.value;
      index++;
      const node = parseExpression();
      
      const closeToken = peek();
      if (!closeToken || closeToken.type !== 'paren') {
        const expectedClose = openChar === '(' ? ')' : openChar === '[' ? ']' : '}';
        throw new Error(`Se esperaba un paréntesis de cierre '${expectedClose}', pero no se encontró.`);
      }
      
      const expectedClose = openChar === '(' ? ')' : openChar === '[' ? ']' : '}';
      if (closeToken.value !== expectedClose) {
        throw new Error(`Símbolo discrepante: se abrió con '${openChar}' pero se intenta cerrar con '${closeToken.value}'.`);
      }
      
      index++; // consume close paren
      return node;
    }
    throw new Error(`Símbolo inesperado: "${token.value}" en la posición ${token.index + 1}.`);
  }

  return parseExpression();
}

// Evalúa el AST para una combinación de variables y asocia cada resultado al índice del token correspondiente
export function evaluateAST(
  node: ASTNode,
  variableValues: Record<string, boolean>,
  tokenValues: Record<number, boolean>
): boolean {
  let val = false;
  if (node.type === 'var') {
    val = variableValues[node.name];
    tokenValues[node.token.index] = val;
  } else if (node.type === 'unary') {
    const operandVal = evaluateAST(node.operand, variableValues, tokenValues);
    if (node.op === '~') {
      val = !operandVal;
    }
    tokenValues[node.token.index] = val;
  } else if (node.type === 'binary') {
    const leftVal = evaluateAST(node.left, variableValues, tokenValues);
    const rightVal = evaluateAST(node.right, variableValues, tokenValues);
    if (node.op === '·') {
      val = leftVal && rightVal;
    } else if (node.op === 'v') {
      val = leftVal || rightVal;
    } else if (node.op === '⊃') {
      val = !leftVal || rightVal;
    } else if (node.op === '≡') {
      val = leftVal === rightVal;
    }
    tokenValues[node.token.index] = val;
  }
  return val;
}

// Mapea variables que están directamente negadas (ej: ~r) para permitir validación tolerante
export function findNegatedVariables(node: ASTNode | null, map: Record<number, number> = {}): Record<number, number> {
  if (!node) return map;
  if (node.type === 'unary' && node.op === '~' && node.operand.type === 'var') {
    map[node.operand.token.index] = node.token.index;
  }
  if (node.type === 'unary') {
    findNegatedVariables(node.operand, map);
  } else if (node.type === 'binary') {
    findNegatedVariables(node.left, map);
    findNegatedVariables(node.right, map);
  }
  return map;
}

// Genera combinaciones de bits para crear la tabla de verdad
export function generateCombinations(variables: string[], orderType: string): Record<string, boolean>[] {
  const numVars = variables.length;
  const numRows = Math.pow(2, numVars);
  const rows: Record<string, boolean>[] = [];
  for (let i = 0; i < numRows; i++) {
    const row: Record<string, boolean> = {};
    const val = (numRows - 1) - i;
    if (orderType === 'reverse') {
      // Estilo Russell-Whitehead del ejemplo (p es LSB, alterna cada fila; r es MSB, alterna en la mitad superior)
      for (let v = 0; v < numVars; v++) {
        const bit = (val >> v) & 1;
        row[variables[v]] = bit === 1;
      }
    } else {
      // Estilo tradicional académico (p es MSB, q cambia en parejas, r es LSB)
      for (let v = 0; v < numVars; v++) {
        const bit = (val >> (numVars - 1 - v)) & 1;
        row[variables[v]] = bit === 1;
      }
    }
    rows.push(row);
  }
  return rows;
}

// Verifica de forma preliminar si la fórmula es sintácticamente correcta
export function checkFormula(formulaStr: string): CheckFormulaResult {
  try {
    const normalized = normalizeFormula(formulaStr);
    const tokens = tokenize(normalized);
    const vars = [...new Set(tokens.filter(t => t.type === 'var').map(t => t.value))].sort();
    if (vars.length === 0) {
      return { valid: false, error: "Escribe al menos una variable proposicional (ej. p, q, r)." };
    }
    const ast = parse(tokens);
    return { valid: true, variables: vars, tokens: tokens, ast: ast };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

interface GeneratedNode {
  type: 'var' | 'unary' | 'binary';
  value?: string;
  op?: string;
  operand?: GeneratedNode;
  left?: GeneratedNode;
  right?: GeneratedNode;
}

// Generador aleatorio de fórmulas bien formadas (máximo 4 variables: p, q, r, s)
export function generateRandomFormula(variablesCount: number = 3): string {
  const allVars = ['p', 'q', 'r', 's'];
  const vars = allVars.slice(0, Math.max(1, Math.min(4, variablesCount)));
  const binaryOps = [' · ', ' v ', ' ⊃ ', ' ≡ '];
  
  function buildNode(depth: number, maxDepth: number): GeneratedNode {
    const isBaseCase = depth >= maxDepth || (depth > 0 && Math.random() < 0.4);
    if (isBaseCase) {
      const randVar = vars[Math.floor(Math.random() * vars.length)];
      if (Math.random() < 0.25) {
        return {
          type: 'unary',
          op: '~',
          operand: { type: 'var', value: randVar }
        };
      }
      return { type: 'var', value: randVar };
    }
    
    // 15% de probabilidad de generar una negación sobre un subbloque
    if (Math.random() < 0.15) {
      return {
        type: 'unary',
        op: '~',
        operand: buildNode(depth + 1, maxDepth)
      };
    }
    
    const op = binaryOps[Math.floor(Math.random() * binaryOps.length)];
    return {
      type: 'binary',
      op,
      left: buildNode(depth + 1, maxDepth),
      right: buildNode(depth + 1, maxDepth)
    };
  }
  
  const targetDepth = variablesCount <= 2 ? 1 : (Math.random() < 0.5 ? 2 : 3);
  let ast = buildNode(0, targetDepth);
  
  // Asegura que tenga al menos una operación binaria si es un átomo simple
  if (ast.type === 'var' || (ast.type === 'unary' && ast.operand?.type === 'var')) {
    const secondVar = vars[Math.floor(Math.random() * vars.length)];
    const op = binaryOps[Math.floor(Math.random() * binaryOps.length)];
    ast = {
      type: 'binary',
      op,
      left: ast,
      right: { type: 'var', value: secondVar }
    };
  }
  
  function getNestingDepth(node: GeneratedNode): number {
    if (node.type === 'var') return 0;
    if (node.type === 'unary') {
      const childDepth = getNestingDepth(node.operand!);
      if (node.operand!.type !== 'var') {
        return 1 + childDepth;
      }
      return childDepth;
    }
    return 1 + Math.max(getNestingDepth(node.left!), getNestingDepth(node.right!));
  }
  
  function wrap(str: string, depth: number): string {
    if (depth === 1) return `(${str})`;
    if (depth === 2) return `[${str}]`;
    return `{${str}}`;
  }
  
  function stringify(node: GeneratedNode): string {
    if (node.type === 'var') return node.value!;
    if (node.type === 'unary') {
      const innerStr = stringify(node.operand!);
      if (node.operand!.type === 'var') {
        return `~${innerStr}`;
      } else {
        const depth = getNestingDepth(node.operand!);
        if (node.operand!.type === 'binary') {
          return `~${innerStr}`;
        }
        return `~${wrap(innerStr, depth + 1)}`;
      }
    }
    
    const leftStr = stringify(node.left!);
    const rightStr = stringify(node.right!);
    const op = node.op!;
    
    const depth = getNestingDepth(node);
    return wrap(`${leftStr}${op}${rightStr}`, depth);
  }
  
  return stringify(ast);
}

// ==========================================
// 2. COMPONENTE PRINCIPAL DE LA APLICACIÓN
// ==========================================

export default function App() {
  // Configuración del Tema
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const isLight = theme === 'light';

  // Configuración de la fórmula e inicialización por defecto con el ejemplo del usuario
  const [formulaInput, setFormulaInput] = useState<string>("((p v q) ⊃ ~r) · r");
  const [formula, setFormula] = useState<string>("((p v q) ⊃ ~r) · r");
  const [variables, setVariables] = useState<string[]>(['p', 'q', 'r']);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [ast, setAst] = useState<ASTNode | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, boolean>[]>([]);
  
  // Respuestas del usuario guardadas como: { [rowIndex]: { [tokenIndex]: "V"|"F"|"" } }
  const [userAnswers, setUserAnswers] = useState<Record<number, Record<number, string>>>({});
  const [autoFillVars, setAutoFillVars] = useState<boolean>(false);
  const [variableOrder] = useState<string>('reverse'); // 'reverse' = Russell-Whitehead, 'standard' = Tradicional
  const [joinNegations, setJoinNegations] = useState<boolean>(true); // Unir negaciones con variables (ej: ~p)
  
  // Estados de control de la UI
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<number, Record<number, boolean>>>({});
  const [alert, setAlert] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ejercicio'); // 'ejercicio' | 'importar' | 'teoria'
  const [csvImportText, setCsvImportText] = useState<string>("");
  const [randomVarsCount, setRandomVarsCount] = useState<number>(3);

  // Mapeo dinámico de colores y estilos según el Tema (Modo Claro de alto contraste por defecto)
  const c = {
    bg: isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-900 text-slate-100',
    header: isLight ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-800 bg-slate-950/60',
    navBg: isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800',
    navBtnActive: 'bg-indigo-600 text-white shadow-md',
    navBtnInactive: isLight ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
    card: isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/40 border-slate-800',
    cardTitle: isLight ? 'text-indigo-700' : 'text-indigo-400',
    inputLabel: isLight ? 'text-slate-700' : 'text-slate-400',
    input: isLight 
      ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600' 
      : 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500',
    keyboardBtn: isLight 
      ? 'bg-slate-50 hover:bg-slate-150 border-slate-250 text-slate-700 hover:border-slate-400 shadow-sm' 
      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:border-slate-700',
    presetBtn: isLight 
      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300 shadow-sm' 
      : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700',
    badge: isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-950 border-indigo-800/30 text-indigo-300',
    progressBg: isLight ? 'bg-slate-200' : 'bg-slate-900',
    tableHeaderRow: isLight ? 'bg-slate-100/80 border-b border-slate-200' : 'bg-slate-900/60 border-b border-slate-800',
    tableCellNum: isLight ? 'border-r border-slate-200 bg-slate-100 text-slate-600' : 'border-r border-slate-800 bg-slate-950/10 text-slate-500',
    tableCellParen: isLight ? 'bg-slate-100/50 text-slate-400 font-extrabold' : 'bg-slate-950/30 text-slate-700 font-extrabold',
    cellBtnEmpty: isLight 
      ? 'bg-slate-50 border-slate-300 text-slate-400 hover:bg-slate-150 hover:border-slate-400 hover:text-slate-600' 
      : 'bg-slate-900/20 border-slate-800 text-slate-400 hover:border-indigo-500/50',
    cellBtnAuto: isLight 
      ? 'bg-slate-100 border-slate-300 text-indigo-700 font-extrabold shadow-inner' 
      : 'bg-slate-900/80 border-slate-800/60 text-indigo-300/80 font-extrabold',
    footer: isLight ? 'border-t border-slate-200 bg-white text-slate-400' : 'border-t border-slate-800 bg-slate-950/40 text-slate-500',
  };

  const [showStarPrompt, setShowStarPrompt] = useState(false);

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setAlert(null), 6500);
    return () => clearTimeout(timer);
  }, [alert]);

  useEffect(() => {
    if (rowStates.length > 0 && tokens.length > 0) {
      syncAutoFilledVariables(autoFillVars, rowStates, tokens);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFillVars, rowStates, tokens]);

  const syncAutoFilledVariables = (
    autoFill: boolean,
    currentRows: Record<string, boolean>[],
    currentTokens: Token[]
  ) => {
    setUserAnswers((prev) => {
      const copy = { ...prev };
      currentRows.forEach((rowState, rIdx) => {
        if (!copy[rIdx]) copy[rIdx] = {};
        currentTokens.forEach((tok) => {
          if (tok.type === 'var') {
            if (autoFill) {
              copy[rIdx][tok.index] = rowState[tok.value] ? 'V' : 'F';
            } else if (copy[rIdx][tok.index] === undefined) {
              copy[rIdx][tok.index] = '';
            }
          }
        });
      });
      return copy;
    });
  };

  const handleGenerateTable = (
    rawFormula: string,
    order: string = variableOrder,
    showSuccessAlert = true
  ) => {
    const check = checkFormula(rawFormula);
    if (!check.valid || !check.variables || !check.tokens || !check.ast) {
      setAlert({ text: `Error de sintaxis: ${check.error}`, type: 'error' });
      return;
    }

    setFormula(rawFormula);
    setVariables(check.variables);
    setTokens(check.tokens);
    setAst(check.ast);

    const comb = generateCombinations(check.variables, order);
    setRowStates(comb);

    const cleanAnswers: Record<number, Record<number, string>> = {};
    const activeTokens = check.tokens.filter((t) => t.type !== 'paren');
    comb.forEach((rowState, rIdx) => {
      cleanAnswers[rIdx] = {};
      activeTokens.forEach((tok) => {
        if (tok.type === 'var' && autoFillVars) {
          cleanAnswers[rIdx][tok.index] = rowState[tok.value] ? 'V' : 'F';
        } else {
          cleanAnswers[rIdx][tok.index] = '';
        }
      });
    });

    setUserAnswers(cleanAnswers);
    setIsCorrect(null);
    setValidationErrors({});
    setShowStarPrompt(false);
    if (showSuccessAlert) {
      setAlert({ text: 'Nueva tabla de verdad generada con éxito.', type: 'success' });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedFormula = params.get('formula');
    if (sharedFormula) {
      setFormulaInput(sharedFormula);
      handleGenerateTable(sharedFormula, variableOrder, false);
    } else {
      handleGenerateTable(formula, variableOrder, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCellClick = (rIndex: number, tIndex: number) => {
    const currentVal = userAnswers[rIndex]?.[tIndex] || '';
    let nextVal = '';
    if (currentVal === '') nextVal = 'V';
    else if (currentVal === 'V') nextVal = 'F';

    setUserAnswers((prev) => {
      const copy = { ...prev };
      if (!copy[rIndex]) copy[rIndex] = {};
      copy[rIndex][tIndex] = nextVal;
      return copy;
    });

    if (validationErrors[rIndex]?.[tIndex]) {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        if (copy[rIndex]) delete copy[rIndex][tIndex];
        return copy;
      });
    }
  };

  const validateTable = () => {
    if (!ast) return;
    let errorsCount = 0;
    const newErrors: Record<number, Record<number, boolean>> = {};
    const activeTokens = tokens.filter((t) => t.type !== 'paren');

    // Si unimos negaciones, identificamos qué índices de variables están ocultos tras un ~
    const hiddenIndices = new Set<number>();
    if (joinNegations) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === 'op_neg' && tokens[i + 1]?.type === 'var') {
          hiddenIndices.add(tokens[i + 1].index);
        }
      }
    }

    rowStates.forEach((rowState, rIndex) => {
      newErrors[rIndex] = {};
      const correctTokenValues: Record<number, boolean> = {};
      evaluateAST(ast, rowState, correctTokenValues);

      activeTokens.forEach((tok) => {
        // Si el token está oculto (es la variable de un ~p unido), no lo validamos aquí
        if (hiddenIndices.has(tok.index)) return;

        const userVal = userAnswers[rIndex]?.[tok.index] || '';
        const correctBool = correctTokenValues[tok.index];
        const correctValStr = correctBool ? 'V' : 'F';

        if (userVal !== correctValStr) {
          newErrors[rIndex][tok.index] = true;
          errorsCount++;
        }
      });
    });

    setValidationErrors(newErrors);
    if (errorsCount === 0) {
      setIsCorrect(true);
      setShowStarPrompt(true);
      setAlert({
        text: '¡Felicidades! Todos los valores lógicos introducidos son correctos.',
        type: 'success',
      });
    } else {
      setIsCorrect(false);
      setShowStarPrompt(false);
      setAlert({
        text: `Se encontraron ${errorsCount} errores en la validación. Revisa las celdas marcadas en rojo.`,
        type: 'error',
      });
    }
  };

  const revealSolution = () => {
    if (!ast) return;
    const solvedAnswers: Record<number, Record<number, string>> = {};
    const activeTokens = tokens.filter((t) => t.type !== 'paren');

    const hiddenIndices = new Set<number>();
    if (joinNegations) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === 'op_neg' && tokens[i + 1]?.type === 'var') {
          hiddenIndices.add(tokens[i + 1].index);
        }
      }
    }

    rowStates.forEach((rowState, rIndex) => {
      solvedAnswers[rIndex] = {};
      const correctTokenValues: Record<number, boolean> = {};
      evaluateAST(ast, rowState, correctTokenValues);
      activeTokens.forEach((tok) => {
        if (hiddenIndices.has(tok.index)) return;
        solvedAnswers[rIndex][tok.index] = correctTokenValues[tok.index] ? 'V' : 'F';
      });
    });

    setUserAnswers(solvedAnswers);
    setIsCorrect(true);
    setValidationErrors({});
    setAlert({ text: 'Solución revelada. Todos los campos se han completado matemáticamente.', type: 'success' });
  };

  const clearAnswers = () => {
    const resetAnswers: Record<number, Record<number, string>> = {};
    const activeTokens = tokens.filter((t) => t.type !== 'paren');

    const hiddenIndices = new Set<number>();
    if (joinNegations) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === 'op_neg' && tokens[i + 1]?.type === 'var') {
          hiddenIndices.add(tokens[i + 1].index);
        }
      }
    }

    rowStates.forEach((rowState, rIndex) => {
      resetAnswers[rIndex] = {};
      activeTokens.forEach((tok) => {
        if (hiddenIndices.has(tok.index)) return;
        if (tok.type === 'var' && autoFillVars) {
          resetAnswers[rIndex][tok.index] = rowState[tok.value] ? 'V' : 'F';
        } else {
          resetAnswers[rIndex][tok.index] = '';
        }
      });
    });

    setUserAnswers(resetAnswers);
    setIsCorrect(null);
    setValidationErrors({});
    setShowStarPrompt(false);
    setAlert({ text: 'Respuestas limpiadas. Cuadrícula lista para reiniciar.', type: 'success' });
  };

  const exportCSV = () => {
    const activeTokens = tokens.filter((t) => t.type !== 'paren');
    const headers = activeTokens.map((t) => t.value).join(',');
    const csvRows = [headers];

    rowStates.forEach((_, rIndex) => {
      const rowVals = activeTokens.map((t) => userAnswers[rIndex]?.[t.index] || '');
      csvRows.push(rowVals.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tabla_verdad_russell_whitehead.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setAlert({ text: 'Archivo CSV exportado exitosamente.', type: 'success' });
  };

  const handleImportCSVText = () => {
    try {
      const lines = csvImportText
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length < 2) {
        setAlert({
          text: 'El CSV debe contener cabecera (primera línea) y al menos una fila con valores de verdad.',
          type: 'error',
        });
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim());
      const headerStr = headers.join(',');
      let targetFormula = '((p v q) ⊃ ~r) · r';

      if (headerStr === 'p,v,q,⊃,~,r,·,r') {
        targetFormula = '((p v q) ⊃ ~r) · r';
      } else {
        targetFormula = headers.join(' ').replace(/\s+/g, ' ').trim();
      }

      const check = checkFormula(targetFormula);
      if (!check.valid || !check.variables || !check.tokens || !check.ast) {
        setAlert({
          text: `No se pudo derivar una fórmula válida del CSV. Error: ${check.error}`,
          type: 'error',
        });
        return;
      }

      setFormulaInput(targetFormula);
      setFormula(targetFormula);
      setVariables(check.variables);
      setTokens(check.tokens);
      setAst(check.ast);

      const comb = generateCombinations(check.variables, variableOrder);
      setRowStates(comb);

      const answers: Record<number, Record<number, string>> = {};
      const activeTokens = check.tokens.filter((t) => t.type !== 'paren');
      const csvRowsData = lines.slice(1);

      comb.forEach((_, rIndex) => {
        answers[rIndex] = {};
        const csvRow = csvRowsData[rIndex] ? csvRowsData[rIndex].split(',').map((v) => v.trim()) : [];
        activeTokens.forEach((tok, colIdx) => {
          let cellVal = csvRow[colIdx] || '';
          if (cellVal.toUpperCase() === 'V' || cellVal === '1' || cellVal.toLowerCase() === 'true') {
            cellVal = 'V';
          } else if (cellVal.toUpperCase() === 'F' || cellVal === '0' || cellVal.toLowerCase() === 'false') {
            cellVal = 'F';
          } else {
            cellVal = '';
          }
          answers[rIndex][tok.index] = cellVal;
        });
      });

      setUserAnswers(answers);
      setIsCorrect(null);
      setValidationErrors({});
      setShowStarPrompt(false);
      setAlert({ text: 'CSV cargado y mapeado correctamente en la tabla interactiva.', type: 'success' });
      setActiveTab('ejercicio');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setAlert({ text: `Error procesando el CSV: ${message}`, type: 'error' });
    }
  };

  const insertSymbol = (symbol: string) => {
    setFormulaInput((prev) => prev + symbol);
  };

  const handleGenerateRandom = () => {
    const random = generateRandomFormula(randomVarsCount);
    setFormulaInput(random);
    handleGenerateTable(random, variableOrder);
  };

  const getProgressStats = () => {
    const activeTokens = tokens.filter((t) => t.type !== 'paren');
    
    const hiddenIndices = new Set<number>();
    if (joinNegations) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === 'op_neg' && tokens[i + 1]?.type === 'var') {
          hiddenIndices.add(tokens[i + 1].index);
        }
      }
    }

    const visibleActiveTokens = activeTokens.filter(tok => !hiddenIndices.has(tok.index));
    const totalCells = rowStates.length * visibleActiveTokens.length;
    if (totalCells === 0) return { percent: 0, count: 0, total: 0 };

    let filledCells = 0;
    rowStates.forEach((_, rIndex) => {
      visibleActiveTokens.forEach((tok) => {
        if (userAnswers[rIndex]?.[tok.index]) filledCells++;
      });
    });

    return {
      percent: Math.round((filledCells / totalCells) * 100),
      count: filledCells,
      total: totalCells,
    };
  };

  const progress = getProgressStats();
  
  // Genera los tokens que se mostrarán en la tabla, permitiendo unir negaciones con variables
  const displayTokens = (() => {
    if (!joinNegations) return tokens;
    const result: (Token & { isMerged?: boolean })[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const current = tokens[i];
      const next = tokens[i + 1];
      if (current.type === 'op_neg' && next && next.type === 'var') {
        result.push({
          ...current,
          value: current.value + next.value,
          isMerged: true
        });
        i++; // Saltamos el token de la variable
      } else {
        result.push(current);
      }
    }
    return result;
  })();

  const tableTokens = displayTokens;

  const starButtonClass = isLight
    ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
    : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-700/60 text-amber-200';

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white transition-colors duration-200 ${c.bg}`}>
      <header className={`border-b backdrop-blur sticky top-0 z-50 px-6 py-4 transition-colors duration-200 ${c.header}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isLight ? 'text-indigo-700' : 'bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200 bg-clip-text text-transparent'}`}>
                Tablas de Verdad - Simbología Russell-Whitehead
              </h1>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Tablero interactivo para crear, validar y analizar tablas de verdad
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={`font-bold py-2 px-3 rounded-xl border text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 ${starButtonClass}`}
            >
              ⭐ Star en GitHub
            </a>

            <button
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
              className={`p-2 rounded-xl border transition ${isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
              title={isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'}
            >
              {isLight ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>

            <nav className={`flex items-center rounded-lg p-1 border shadow-inner ${c.navBg}`}>
              <button
                onClick={() => setActiveTab('ejercicio')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'ejercicio' ? c.navBtnActive : c.navBtnInactive}`}
              >
                Tablero Interactivo
              </button>
              <button
                onClick={() => setActiveTab('importar')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'importar' ? c.navBtnActive : c.navBtnInactive}`}
              >
                Importar CSV
              </button>
              <button
                onClick={() => setActiveTab('teoria')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'teoria' ? c.navBtnActive : c.navBtnInactive}`}
              >
                Teoría y Símbolos
              </button>
            </nav>
          </div>
        </div>
      </header>

      {alert && (
        <div className="fixed top-20 right-6 z-50 max-w-md w-full animate-slide-in">
          <div
            className={`p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
              alert.type === 'success'
                ? isLight
                  ? 'bg-emerald-50/95 border-emerald-300 text-emerald-900'
                  : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : isLight
                  ? 'bg-rose-50/95 border-rose-300 text-rose-900'
                  : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex-1 text-sm font-medium leading-relaxed">{alert.text}</div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {activeTab === 'ejercicio' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className={`rounded-2xl border p-5 shadow-xl transition-all duration-200 ${c.card}`}>
                <h2 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${c.cardTitle}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Crear Ejercicio
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-semibold mb-2 ${c.inputLabel}`}>Escribe la fórmula:</label>
                    <input
                      type="text"
                      value={formulaInput}
                      onChange={(e) => setFormulaInput(e.target.value)}
                      placeholder="((p v q) ⊃ ~r) · r"
                      className={`w-full border rounded-xl px-4 py-3 font-mono text-sm focus:outline-none shadow-inner transition-colors duration-200 ${c.input}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${c.inputLabel}`}>Símbolos Russell-Whitehead:</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { sym: '~', label: 'negación', color: 'text-amber-500' },
                        { sym: ' · ', label: 'conjunción', color: 'text-emerald-500' },
                        { sym: ' v ', label: 'disyunción', color: 'text-sky-500' },
                        { sym: ' ⊃ ', label: 'condicional', color: 'text-indigo-500' },
                        { sym: ' ≡ ', label: 'equivalente', color: 'text-purple-500' },
                      ].map(({ sym, label, color }) => (
                        <button
                          key={sym}
                          onClick={() => insertSymbol(sym)}
                          className={`font-mono font-bold py-2 rounded-lg border transition flex flex-col items-center justify-center text-sm ${c.keyboardBtn} ${color}`}
                        >
                          <span className="text-base leading-none">{sym.trim() || '~'}</span>
                          <span className={`text-[9px] font-sans mt-0.5 opacity-70`}>{label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 mt-2">
                      {['p', 'q', 'r', 's', '(', ')'].map((sym) => (
                        <button
                          key={sym}
                          onClick={() => insertSymbol(sym)}
                          className={`font-mono font-semibold py-1.5 rounded-lg border transition text-sm text-center ${c.keyboardBtn}`}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`border-t pt-4 space-y-3 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${c.inputLabel}`}>Autocompletar variables base:</span>
                      <button
                        onClick={() => setAutoFillVars(!autoFillVars)}
                        className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors ${autoFillVars ? 'bg-indigo-600' : isLight ? 'bg-slate-300' : 'bg-slate-800'}`}
                      >
                        <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${autoFillVars ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${c.inputLabel}`}>Unir negaciones con variables (ej: ~p):</span>
                      <button
                        onClick={() => setJoinNegations(!joinNegations)}
                        className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors ${joinNegations ? 'bg-indigo-600' : isLight ? 'bg-slate-300' : 'bg-slate-800'}`}
                      >
                        <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${joinNegations ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className={`text-xs font-medium ${c.inputLabel}`}>Variables (aleatorio):</label>
                      <select
                        value={randomVarsCount}
                        onChange={(e) => setRandomVarsCount(Number(e.target.value))}
                        className={`border rounded-lg px-2 py-1 text-xs ${c.input}`}
                      >
                        {[2, 3, 4].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleGenerateRandom}
                        className={`flex-1 font-semibold py-2 px-3 rounded-xl border text-xs transition ${c.presetBtn}`}
                      >
                        Generar Ejercicio
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleGenerateTable(formulaInput)}
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition active:scale-[0.98] text-xs"
                  >
                    Reconstruir Tabla de Verdad
                  </button>
                </div>
              </div>

              {/* SECCIÓN COMPARTIR EJERCICIO */}
              <div className={`rounded-2xl border p-5 shadow-xl transition-all duration-200 ${c.card}`}>
                <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${c.cardTitle}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l5.132-2.566m0 0a3 3 0 10-2.23-5.547 3 3 0 002.23 5.547zm0 11.648l-5.132-2.566m0 0a3 3 0 102.23 5.547 3 3 0 00-2.23-5.547z" />
                  </svg>
                  Compartir Ejercicio
                </h2>
                <p className="text-xs opacity-75 mb-4 leading-relaxed">
                  Genera un enlace directo para que tus compañeros o profesores puedan resolver esta misma fórmula interactiva.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}${window.location.pathname}?formula=${encodeURIComponent(formula)}`;
                      navigator.clipboard.writeText(shareUrl);
                      setAlert({ text: "¡Enlace copiado al portapapeles! Listo para compartir.", type: 'success' });
                    }}
                    className={`w-full font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border ${c.presetBtn}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copiar Enlace Directo
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Twitter / X */}
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`¡Practica lógica Russell-Whitehead de manera interactiva con esta tabla de verdad! 🧠👇\n\n`)}&url=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?formula=${encodeURIComponent(formula)}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-black hover:bg-zinc-900 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 text-center"
                    >
                      <span className="font-extrabold font-sans">X</span>
                    </a>

                    {/* Telegram */}
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?formula=${encodeURIComponent(formula)}`)}&text=${encodeURIComponent(`¡Practica lógica proposicional interactiva de Principia Mathematica aquí! 🧠`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#229ED9] hover:bg-[#1f8fc2] text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 text-center"
                    >
                      <span>Telegram</span>
                    </a>

                    {/* Facebook */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?formula=${encodeURIComponent(formula)}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#1877F2] hover:bg-[#166fe3] text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 text-center"
                    >
                      <span>Facebook</span>
                    </a>
                  </div>
                </div>
              </div>

            </div>

            {/* TABLA DE VERDAD INTERACTIVA CENTRAL */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* FICHA TÉCNICA DEL EJERCICIO */}
              <div className={`rounded-2xl border p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-200 ${c.card}`}>
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">Ejercicio Activo</span>
                  <div className="text-lg md:text-xl font-mono font-bold flex items-center gap-2">
                    <span>{formula}</span>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs flex items-center gap-1">
                      <strong className="font-bold">Variables:</strong> {variables.join(', ')}
                    </span>
                    <span className="text-xs flex items-center gap-1">
                      <strong className="font-bold">Filas de verdad:</strong> {rowStates.length}
                    </span>
                  </div>
                </div>

                {/* BARRA DE PROGRESO */}
                <div className="flex flex-col gap-1.5 min-w-[150px]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold">Progreso:</span>
                    <span className="font-bold text-indigo-600">{progress.count} / {progress.total} celdas</span>
                  </div>
                  <div className={`w-full h-2 rounded-full border overflow-hidden ${c.progressBg} ${isLight ? 'border-slate-250' : 'border-slate-800'}`}>
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 animate-pulse"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* LA TABLA DE VERDAD INTERACTIVA */}
              <div className={`rounded-2xl border overflow-hidden shadow-xl transition-colors duration-200 ${c.card}`}>
                
                {/* BOTONES DE CABECERA DE LA TABLA */}
                <div className={`px-5 py-4 border-b flex flex-wrap gap-2 justify-between items-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Instrucciones:</span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${c.badge}`}>
                      Clic en una celda: Vacío ➜ V ➜ F ➜ Vacío
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {isCorrect === true && (
                      <span className="text-xs bg-emerald-100 border border-emerald-300 text-emerald-800 py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 shadow-sm animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Tabla 100% Correcta
                      </span>
                    )}
                    {isCorrect === false && (
                      <span className="text-xs bg-rose-100 border border-rose-300 text-rose-800 py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 shadow-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Errores detectados
                      </span>
                    )}
                    {showStarPrompt && (
                      <div className={`text-xs py-1.5 px-3 rounded-xl font-semibold flex items-center gap-2 border shadow-sm ${starButtonClass}`}>
                        <span>¿Te sirvió? Dejanos una ⭐ en GitHub</span>
                        <a
                          href={GITHUB_REPO_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-bold whitespace-nowrap"
                        >
                          Star ahora
                        </a>
                        <button
                          onClick={() => setShowStarPrompt(false)}
                          className="opacity-60 hover:opacity-100 ml-1"
                          aria-label="Cerrar"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* CONTENEDOR FLUIDO CON SCROLL LATERAL PARA PREVENIR ROTURAS EN MÓVIL */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className={`text-xs ${c.tableHeaderRow}`}>
                        <th className={`py-3 px-4 text-center font-bold w-12 ${c.tableCellNum}`}>#</th>
                        {tableTokens.map((tok, idx) => (
                          <th 
                            key={idx} 
                            className={`py-3 px-5 text-center font-mono font-black text-sm tracking-widest ${
                              tok.type === 'var' ? 'text-indigo-600' : tok.type === 'paren' ? c.tableCellParen : 'text-amber-600 bg-slate-200/20'
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <span>{tok.value}</span>
                              <span className="text-[8px] opacity-40 font-sans tracking-normal font-normal mt-0.5">
                                {tok.type === 'var' ? 'var' : tok.type === 'paren' ? 'par' : 'op'}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-slate-800/50'}`}>
                      {rowStates.map((rowState, rIndex) => (
                        <tr key={rIndex} className={`transition ${isLight ? 'hover:bg-slate-100/60' : 'hover:bg-slate-900/25'}`}>
                          <td className={`py-3 px-4 text-center text-xs font-mono font-bold ${c.tableCellNum}`}>
                            {rIndex + 1}
                          </td>
                          {tableTokens.map((tok, cIndex) => {
                            if (tok.type === 'paren') {
                              return (
                                <td key={cIndex} className="p-1.5 text-center bg-slate-950/5">
                                  <div className={`w-10 h-10 mx-auto flex items-center justify-center font-mono text-xs rounded-lg ${isLight ? 'text-slate-350' : 'text-slate-800'}`}>
                                    •
                                  </div>
                                </td>
                              );
                            }

                            const val = userAnswers[rIndex]?.[tok.index] || "";
                            const hasError = validationErrors[rIndex]?.[tok.index];
                            const isAutoVar = tok.type === 'var' && autoFillVars;

                            let bgClass = isLight ? "bg-slate-50" : "bg-slate-900/20";
                            let textClass = isLight ? "text-slate-800" : "text-slate-400";
                            let borderClass = isLight ? "border-slate-250" : "border-slate-800";

                            if (val === "V") {
                              bgClass = isLight ? "bg-emerald-100/90 border-emerald-300" : "bg-emerald-950/25 border-emerald-800";
                              textClass = isLight ? "text-emerald-800 font-extrabold" : "text-emerald-400 font-extrabold";
                            } else if (val === "F") {
                              bgClass = isLight ? "bg-rose-100/90 border-rose-300" : "bg-rose-950/25 border-rose-800";
                              textClass = isLight ? "text-rose-800 font-extrabold" : "text-rose-400 font-extrabold";
                            }

                            if (hasError) {
                              bgClass = isLight ? "bg-rose-100 border-rose-500" : "bg-rose-950/40 border-rose-500/80";
                              borderClass = "border-rose-500/80";
                              textClass = isLight ? "text-rose-900 font-black" : "text-rose-300 font-black";
                            }

                            return (
                              <td key={cIndex} className="p-1.5 text-center">
                                {isAutoVar ? (
                                  <div className={`w-10 h-10 mx-auto flex items-center justify-center font-mono text-sm rounded-lg border ${c.cellBtnAuto} cursor-not-allowed`}>
                                    {rowState[tok.value] ? "V" : "F"}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleCellClick(rIndex, tok.index)}
                                    className={`w-10 h-10 mx-auto flex items-center justify-center font-mono text-sm rounded-lg border shadow-sm transition active:scale-95 focus:outline-none ${bgClass} ${textClass} ${borderClass} hover:border-indigo-500/50`}
                                  >
                                    {val || <span className="opacity-15 font-sans font-light">?</span>}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* INFORMACIÓN DE CONFIGURACIÓN DEL MODO */}
                <div className={`px-5 py-3 border-t flex justify-end text-[11px] font-bold ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-950/40 border-slate-800 text-slate-500'}`}>
                  {joinNegations && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Negaciones unidas a variables
                    </span>
                  )}
                </div>

              </div>

              {/* BOTONERA ACCIONES PRINCIPALES */}
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={validateTable}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition active:scale-[0.98] text-xs flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Validar Resultados
                  </button>

                  <button 
                    onClick={revealSolution}
                    className={`font-semibold py-3 px-5 rounded-xl shadow border transition active:scale-[0.98] text-xs flex items-center gap-2 ${
                      isLight ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Revelar Solución
                  </button>

                  <button 
                    onClick={clearAnswers}
                    className={`border py-3 px-4 rounded-xl transition active:scale-[0.98] text-xs font-semibold ${
                      isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-850 hover:bg-slate-800 border-slate-850 text-slate-400'
                    }`}
                    title="Limpiar Respuestas"
                  >
                    Limpiar Todo
                  </button>
                </div>

                <button 
                  onClick={exportCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-xl shadow-md transition active:scale-[0.98] text-xs flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar CSV
                </button>
              </div>

            </div>

          </div>
        )}

        {/* PESTAÑA: IMPORTAR CSV */}
        {activeTab === 'importar' && (
          <div className={`rounded-2xl border p-6 shadow-xl max-w-4xl mx-auto w-full transition-colors duration-200 ${c.card}`}>
            <h2 className={`text-lg font-bold mb-2 flex items-center gap-2 ${c.cardTitle}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importar Ejercicio desde CSV
            </h2>
            <p className="text-xs opacity-75 mb-6 leading-relaxed">
              Pega debajo el texto plano de la matriz resuelta en formato CSV (con separadores por comas). 
              La aplicación lo procesará, detectará la fórmula de la cabecera e importará todos los valores de verdad interactivos a la cuadrícula.
            </p>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-2 ${c.inputLabel}`}>Contenido CSV:</label>
                <textarea
                  value={csvImportText}
                  onChange={(e) => setCsvImportText(e.target.value)}
                  placeholder={`p,v,q,⊃,~,r,·,r\nV,V,V,F,F,F,F,V\nF,V,V,F,F,F,F,V\nV,V,F,F,F,F,F,V\nF,F,F,V,F,F,V,V\nV,V,V,V,V,V,F,F\nF,V,V,V,V,V,F,F\nV,V,F,V,V,V,F,F\nF,F,F,V,V,V,F,F`}
                  rows={11}
                  className={`w-full border rounded-xl px-4 py-3 font-mono text-xs focus:outline-none shadow-inner transition-colors duration-200 ${c.input}`}
                />
              </div>

              <div className={`p-4 rounded-xl border text-xs space-y-2 ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                <h4 className="font-bold">Formato Esperado:</h4>
                <ul className="list-disc list-inside space-y-1 opacity-90">
                  <li>La primera fila debe contener la cabecera con variables y conectivas lógicas separadas por comas.</li>
                  <li>Las filas siguientes deben contener los valores de verdad correspondientes (<code className="font-mono font-bold">V</code> para verdadero, <code className="font-mono font-bold">F</code> para falso).</li>
                  <li>Las columnas no-variables de la cabecera serán mapeadas a su respectivo operador en el generador.</li>
                </ul>
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => {
                    setCsvImportText(`p,v,q,⊃,~,r,·,r\nV,V,V,F,F,F,F,V\nF,V,V,F,F,F,F,V\nV,V,F,F,F,F,F,V\nF,F,F,V,F,F,V,V\nV,V,V,V,V,V,F,F\nF,V,V,V,V,V,F,F\nV,V,F,V,V,V,F,F\nF,F,F,V,V,V,F,F`);
                  }}
                  className={`font-semibold py-2.5 px-4 rounded-xl border transition text-xs ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-350 text-slate-700 shadow-sm' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  Cargar Ejemplo Consigna
                </button>
                <button 
                  onClick={handleImportCSVText}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow transition text-xs flex items-center gap-1.5"
                >
                  Procesar & Renderizar Board
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: TEORÍA Y SIMBOLOGÍA */}
        {activeTab === 'teoria' && (
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
            
            {/* CARD: SIMBOLOGÍA DE RUSSELL-WHITEHEAD */}
            <div className={`rounded-2xl border p-6 shadow-xl transition-all duration-200 ${c.card}`}>
              <h2 className={`text-lg font-bold mb-3 flex items-center gap-2 ${c.cardTitle}`}>
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Simbología Lógica de Russell-Whitehead
              </h2>
              <p className="text-sm opacity-80 leading-relaxed mb-6">
                Utilizada por Alfred North Whitehead y Bertrand Russell en los históricos tomos de <em className="font-semibold text-indigo-600">Principia Mathematica</em> (1910-1913),
                esta notación es uno de los primeros sistemas estandarizados de lógica proposicional del siglo XX.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-850'}`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">Conectivas Principales</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold">Negación</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded border ${isLight ? 'bg-white border-slate-300 text-amber-600' : 'bg-slate-950 border-slate-800 text-amber-400'}`}>~ p</span>
                        <span className="opacity-75">equivalente a ¬p</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold">Conjunción</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded border ${isLight ? 'bg-white border-slate-300 text-emerald-600' : 'bg-slate-950 border-slate-800 text-emerald-400'}`}>p · q</span>
                        <span className="opacity-75">equivalente a p ∧ q</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold">Disyunción</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded border ${isLight ? 'bg-white border-slate-300 text-sky-600' : 'bg-slate-950 border-slate-800 text-sky-400'}`}>p v q</span>
                        <span className="opacity-75">equivalente a p ∨ q</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold">Condicional (Herradura)</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded border ${isLight ? 'bg-white border-slate-300 text-indigo-600' : 'bg-slate-950 border-slate-800 text-indigo-300'}`}>p ⊃ q</span>
                        <span className="opacity-75">equivalente a p → q</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pb-1">
                      <span className="font-bold">Bicondicional / Triple Barra</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded border ${isLight ? 'bg-white border-slate-300 text-purple-600' : 'bg-slate-950 border-slate-800 text-purple-400'}`}>p ≡ q</span>
                        <span className="opacity-75">equivalente a p ↔ q</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-850'}`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">La Notación por Puntos (Agrupación)</h3>
                  <p className="text-xs opacity-80 leading-relaxed mb-3">
                    En Principia Mathematica, Whitehead y Russell usaron <strong className="font-bold text-slate-800">puntos</strong> en lugar de paréntesis complejos para definir prioridades de conectivas.
                  </p>
                  <p className="text-xs opacity-80 leading-relaxed">
                    Un punto solo o un bloque de puntos ejerce una separación lógica más fuerte que los operadores inmediatos. 
                    Por ejemplo, <code className="font-mono text-indigo-600">p v q . ⊃ . ~r · r</code> indica que la herradura (<code className="font-mono text-indigo-600">⊃</code>) es el conector principal que une los bloques izquierdo y derecho, equivalente a <code className="font-mono text-indigo-600">((p v q) ⊃ ~r) · r</code> si interpretamos el punto del ejemplo como conector dominante.
                  </p>
                </div>
              </div>
            </div>

            {/* TABLAS DE REGLAS DE LÓGICA FORMAL */}
            <div className={`rounded-2xl border p-6 shadow-xl transition-all duration-200 ${c.card}`}>
              <h2 className="text-base font-bold mb-4">Tabla de Referencia Rápida para Validación</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                
                <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-850'}`}>
                  <h4 className="font-bold text-indigo-600 mb-2">~ (Negación)</h4>
                  <p className="opacity-80 leading-relaxed">Invierte el valor lógico.</p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] font-semibold text-slate-700">
                    <li>~ V = F</li>
                    <li>~ F = V</li>
                  </ul>
                </div>

                <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-850'}`}>
                  <h4 className="font-bold text-emerald-700 mb-2">· (Conjunción)</h4>
                  <p className="opacity-80 leading-relaxed">Verdadero solo si ambos miembros son V.</p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] font-semibold text-slate-700">
                    <li>V · V = V</li>
                    <li>V · F = F</li>
                    <li>F · V = F</li>
                    <li>F · F = F</li>
                  </ul>
                </div>

                <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-850'}`}>
                  <h4 className="font-bold text-sky-700 mb-2">v (Disyunción)</h4>
                  <p className="opacity-80 leading-relaxed">Falso solo si ambos miembros son F.</p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] font-semibold text-slate-700">
                    <li>V v V = V</li>
                    <li>V v F = V</li>
                    <li>F v V = V</li>
                    <li>F v F = F</li>
                  </ul>
                </div>

                <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-850'}`}>
                  <h4 className="font-bold text-indigo-700 mb-2">⊃ (Implicación / Condicional)</h4>
                  <p className="opacity-80 leading-relaxed">Falso solo cuando el antecedente es V y consecuente F.</p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] font-semibold text-slate-700">
                    <li>V ⊃ V = V</li>
                    <li>V ⊃ F = F</li>
                    <li>F ⊃ V = V</li>
                    <li>F ⊃ F = V</li>
                  </ul>
                </div>

                <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-850'}`}>
                  <h4 className="font-bold text-purple-700 mb-2">≡ (Bicondicional)</h4>
                  <p className="opacity-80 leading-relaxed">Verdadero si ambos lados tienen el mismo valor lógico.</p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] font-semibold text-slate-700">
                    <li>V ≡ V = V</li>
                    <li>V ≡ F = F</li>
                    <li>F ≡ V = F</li>
                    <li>F ≡ F = V</li>
                  </ul>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className={`py-12 text-center mt-12 text-xs transition-colors duration-200 border-t ${c.footer}`}>
        <div className="max-w-2xl mx-auto px-6">
          <p className="mb-4 font-bold text-sm bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            Hecho con 🔥 por Sergio Alderete
          </p>
          <p className="mb-6 leading-relaxed opacity-80 italic">
            "Para los estudiantes de la UBA que luchan con las tablas de verdad en Filosofía, CBC o Exactas. 
            Que la lógica de Russell y Whitehead les sea leve."
          </p>
          
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 opacity-75">
              <span className="font-bold">Sergio Alderete</span>
              <span className="w-1 h-1 rounded-full bg-slate-500"></span>
              <span>© 2026</span>
            </div>

            <div className="space-y-4">
              <p className="max-w-md mx-auto leading-relaxed">
                Este es un proyecto de código abierto. Si te ayudó a aprobar o a entender mejor la materia, 
                una estrella en GitHub es la mejor forma de decir gracias.
              </p>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 font-bold py-3 px-6 rounded-xl border text-xs transition active:scale-95 ${starButtonClass}`}
              >
                ⭐ Star en GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
