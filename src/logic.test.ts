import { describe, it, expect } from 'vitest';
import {
  normalizeFormula,
  tokenize,
  parse,
  evaluateAST,
  findNegatedVariables,
  generateCombinations,
  checkFormula,
  generateRandomFormula
} from './App.tsx';

describe('normalizeFormula', () => {
  it('debería normalizar operadores estándar Russell-Whitehead correctamente', () => {
    expect(normalizeFormula('¬p')).toBe('~p');
    expect(normalizeFormula('-p')).toBe('~p');
    expect(normalizeFormula('p * q')).toBe('p · q');
    expect(normalizeFormula('p & q')).toBe('p · q');
    expect(normalizeFormula('p ^ q')).toBe('p · q');
    expect(normalizeFormula('p . q')).toBe('p · q');
    expect(normalizeFormula('p + q')).toBe('p v q');
    expect(normalizeFormula('p V q')).toBe('p v q');
    expect(normalizeFormula('p -> q')).toBe('p ⊃ q');
    expect(normalizeFormula('p > q')).toBe('p ⊃ q');
    expect(normalizeFormula('p <-> q')).toBe('p ≡ q');
    expect(normalizeFormula('p = q')).toBe('p ≡ q');
  });

  it('debería colapsar múltiples espacios en uno solo', () => {
    expect(normalizeFormula('p    v    q')).toBe('p v q');
  });
});

describe('tokenize', () => {
  it('debería tokenizar variables y operadores con sus índices correspondientes', () => {
    const tokens = tokenize('(p v ~q)');
    expect(tokens).toHaveLength(6);
    expect(tokens[0]).toEqual({ type: 'paren', value: '(', index: 0 });
    expect(tokens[1]).toEqual({ type: 'var', value: 'p', index: 1 });
    expect(tokens[2]).toEqual({ type: 'op_or', value: 'v', index: 3 });
    expect(tokens[3]).toEqual({ type: 'op_neg', value: '~', index: 5 });
    expect(tokens[4]).toEqual({ type: 'var', value: 'q', index: 6 });
    expect(tokens[5]).toEqual({ type: 'paren', value: ')', index: 7 });
  });

  it('debería tokenizar corchetes [] y llaves {} correctamente', () => {
    const tokens = tokenize('{[p]}');
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toEqual({ type: 'paren', value: '{', index: 0 });
    expect(tokens[1]).toEqual({ type: 'paren', value: '[', index: 1 });
    expect(tokens[2]).toEqual({ type: 'var', value: 'p', index: 2 });
    expect(tokens[3]).toEqual({ type: 'paren', value: ']', index: 3 });
    expect(tokens[4]).toEqual({ type: 'paren', value: '}', index: 4 });
  });

  it('debería ignorar caracteres no reconocidos silenciosamente', () => {
    const tokens = tokenize('p #@ v q');
    expect(tokens).toHaveLength(3);
    expect(tokens[0].value).toBe('p');
    expect(tokens[1].value).toBe('v');
    expect(tokens[2].value).toBe('q');
  });
});

describe('parse (Precedencia de Operadores)', () => {
  it('la negación (~) debería tener prioridad sobre la conjunción (·)', () => {
    const tokens = tokenize('~p · q');
    const ast = parse(tokens);
    // Equivalente a (~p) · q, por lo que el nodo principal es binario '·'
    expect(ast.type).toBe('binary');
    expect((ast as any).op).toBe('·');
    expect((ast as any).left.type).toBe('unary');
    expect((ast as any).left.op).toBe('~');
    expect((ast as any).right.type).toBe('var');
  });

  it('la conjunción (·) debería tener prioridad sobre la disyunción (v)', () => {
    const tokens = tokenize('p v q · r');
    const ast = parse(tokens);
    // Equivalente a p v (q · r), el nodo principal es binario 'v'
    expect(ast.type).toBe('binary');
    expect((ast as any).op).toBe('v');
    expect((ast as any).left.type).toBe('var');
    expect((ast as any).right.type).toBe('binary');
    expect((ast as any).right.op).toBe('·');
  });

  it('la disyunción (v) debería tener prioridad sobre el condicional (⊃)', () => {
    const tokens = tokenize('p v q ⊃ r');
    const ast = parse(tokens);
    // Equivalente a (p v q) ⊃ r, el nodo principal es '⊃'
    expect(ast.type).toBe('binary');
    expect((ast as any).op).toBe('⊃');
    expect((ast as any).left.type).toBe('binary');
    expect((ast as any).left.op).toBe('v');
    expect((ast as any).right.type).toBe('var');
  });

  it('el condicional (⊃) debería tener prioridad sobre el bicondicional (≡)', () => {
    const tokens = tokenize('p ⊃ q ≡ r');
    const ast = parse(tokens);
    // Equivalente a (p ⊃ q) ≡ r, el nodo principal es '≡'
    expect(ast.type).toBe('binary');
    expect((ast as any).op).toBe('≡');
    expect((ast as any).left.type).toBe('binary');
    expect((ast as any).left.op).toBe('⊃');
  });

  it('debería arrojar error en caso de paréntesis no cerrados', () => {
    const tokens = tokenize('((p v q)');
    expect(() => parse(tokens)).toThrow(/Se esperaba un paréntesis de cierre/);
  });

  it('debería arrojar error en caso de llaves/corchetes discrepantes o cruzados', () => {
    const tokens1 = tokenize('[p v q)');
    expect(() => parse(tokens1)).toThrow(/Símbolo discrepante: se abrió con '\[' pero se intenta cerrar con '\)'/);

    const tokens2 = tokenize('{p · q]');
    expect(() => parse(tokens2)).toThrow(/Símbolo discrepante: se abrió con '\{' pero se intenta cerrar con '\]'/);
  });

  it('debería parsear correctamente corchetes y llaves bien balanceadas', () => {
    const tokens = tokenize('{[p v q] · r}');
    const ast = parse(tokens);
    expect(ast.type).toBe('binary');
    expect((ast as any).op).toBe('·');
  });

  it('debería arrojar error en caso de operadores flotantes sin variables', () => {
    const tokens = tokenize('p v');
    expect(() => parse(tokens)).toThrow(/Fórmula incompleta o con operadores sin variables/);
  });
});

describe('evaluateAST', () => {
  it('debería evaluar negaciones de manera correcta', () => {
    const tokens = tokenize('~p');
    const ast = parse(tokens);
    const tokenValues: Record<number, boolean> = {};

    const resT = evaluateAST(ast, { p: true }, tokenValues);
    expect(resT).toBe(false);

    const resF = evaluateAST(ast, { p: false }, tokenValues);
    expect(resF).toBe(true);
  });

  it('debería evaluar conjunciones de manera correcta', () => {
    const tokens = tokenize('p · q');
    const ast = parse(tokens);
    const tokenValues: Record<number, boolean> = {};

    expect(evaluateAST(ast, { p: true, q: true }, tokenValues)).toBe(true);
    expect(evaluateAST(ast, { p: true, q: false }, tokenValues)).toBe(false);
    expect(evaluateAST(ast, { p: false, q: true }, tokenValues)).toBe(false);
    expect(evaluateAST(ast, { p: false, q: false }, tokenValues)).toBe(false);
  });

  it('debería evaluar disyunciones de manera correcta', () => {
    const tokens = tokenize('p v q');
    const ast = parse(tokens);
    const tokenValues: Record<number, boolean> = {};

    expect(evaluateAST(ast, { p: true, q: true }, tokenValues)).toBe(true);
    expect(evaluateAST(ast, { p: true, q: false }, tokenValues)).toBe(true);
    expect(evaluateAST(ast, { p: false, q: true }, tokenValues)).toBe(true);
    expect(evaluateAST(ast, { p: false, q: false }, tokenValues)).toBe(false);
  });

  it('debería evaluar condicionales / implicación material de manera correcta', () => {
    const tokens = tokenize('p ⊃ q');
    const ast = parse(tokens);
    const tokenValues: Record<number, boolean> = {};

    expect(evaluateAST(ast, { p: true, q: true }, tokenValues)).toBe(true);
    expect(evaluateAST(ast, { p: true, q: false }, tokenValues)).toBe(false); // Único caso falso
    expect(evaluateAST(ast, { p: false, q: true }, tokenValues)).toBe(true);
    expect(evaluateAST(ast, { p: false, q: false }, tokenValues)).toBe(true);
  });

  it('debería evaluar bicondicionales / equivalencia de manera correcta', () => {
    const tokens = tokenize('p ≡ q');
    const ast = parse(tokens);
    const tokenValues: Record<number, boolean> = {};

    expect(evaluateAST(ast, { p: true, q: true }, tokenValues)).toBe(true);
    expect(evaluateAST(ast, { p: true, q: false }, tokenValues)).toBe(false);
    expect(evaluateAST(ast, { p: false, q: true }, tokenValues)).toBe(false);
    expect(evaluateAST(ast, { p: false, q: false }, tokenValues)).toBe(true);
  });
});

describe('findNegatedVariables', () => {
  it('debería mapear variables directamente negadas a la posición del operador negación', () => {
    const tokens = tokenize('p v ~r');
    const ast = parse(tokens);
    const map = findNegatedVariables(ast);

    // En 'p v ~r':
    // 'p' [0], 'v' [2], '~' [4], 'r' [5]
    // El mapa debe contener el índice de r (5) mapeado al de ~ (4)
    expect(map[5]).toBe(4);
    expect(map[0]).toBeUndefined(); // 'p' no está directamente negada
  });
});

describe('generateCombinations', () => {
  const vars = ['p', 'q', 'r'];

  it('debería generar 2^n filas ordenadas al estilo Russell-Whitehead (LSB first)', () => {
    const comb = generateCombinations(vars, 'reverse');
    expect(comb).toHaveLength(8);

    // El estilo Russell-Whitehead alterna p (índice 0) cada fila, y r (índice 2, MSB) en la mitad superior/inferior
    expect(comb[0]).toEqual({ p: true, q: true, r: true });
    expect(comb[1]).toEqual({ p: false, q: true, r: true });
    expect(comb[2]).toEqual({ p: true, q: false, r: true });
    expect(comb[3]).toEqual({ p: false, q: false, r: true });
    expect(comb[4]).toEqual({ p: true, q: true, r: false });
    expect(comb[5]).toEqual({ p: false, q: true, r: false });
    expect(comb[6]).toEqual({ p: true, q: false, r: false });
    expect(comb[7]).toEqual({ p: false, q: false, r: false });
  });

  it('debería generar 2^n filas ordenadas al estilo académico tradicional (MSB first)', () => {
    const comb = generateCombinations(vars, 'standard');
    expect(comb).toHaveLength(8);

    // El estilo tradicional varía r (último índice) cada fila, y p (MSB) en la mitad superior/inferior
    expect(comb[0]).toEqual({ p: true, q: true, r: true });
    expect(comb[1]).toEqual({ p: true, q: true, r: false });
    expect(comb[2]).toEqual({ p: true, q: false, r: true });
    expect(comb[3]).toEqual({ p: true, q: false, r: false });
    expect(comb[4]).toEqual({ p: false, q: true, r: true });
    expect(comb[5]).toEqual({ p: false, q: true, r: false });
    expect(comb[6]).toEqual({ p: false, q: false, r: true });
    expect(comb[7]).toEqual({ p: false, q: false, r: false });
  });
});

describe('checkFormula', () => {
  it('debería devolver un resultado válido para fórmulas sintácticamente correctas', () => {
    const res = checkFormula('((p v q) ⊃ ~r) · r');
    expect(res.valid).toBe(true);
    expect(res.variables).toEqual(['p', 'q', 'r']);
    expect(res.ast).toBeDefined();
  });

  it('debería devolver un resultado no válido con mensaje de error si no hay variables', () => {
    const res = checkFormula('( ~ · )');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Escribe al menos una variable proposicional (ej. p, q, r).');
  });

  it('debería devolver un resultado no válido con error de parseo si la sintaxis es rota', () => {
    const res = checkFormula('p v v q');
    expect(res.valid).toBe(false);
    expect(res.error).toBeDefined();
  });
});

describe('generateRandomFormula', () => {
  it('debería generar una fórmula sintácticamente válida con variables correctas', () => {
    // Generar varias fórmulas para probar la aleatoriedad
    for (let i = 0; i < 15; i++) {
      const formula = generateRandomFormula(3);
      expect(typeof formula).toBe('string');
      expect(formula.length).toBeGreaterThan(1);
      
      const check = checkFormula(formula);
      expect(check.valid).toBe(true);
      // Las variables deben ser un subconjunto de p, q, r
      check.variables?.forEach(v => {
        expect(['p', 'q', 'r']).toContain(v);
      });
    }
  });

  it('debería respetar la cantidad máxima de variables pedida', () => {
    const formula2 = generateRandomFormula(2);
    const check2 = checkFormula(formula2);
    check2.variables?.forEach(v => {
      expect(['p', 'q']).toContain(v);
    });

    const formula4 = generateRandomFormula(4);
    const check4 = checkFormula(formula4);
    check4.variables?.forEach(v => {
      expect(['p', 'q', 'r', 's']).toContain(v);
    });
  });

  it('debería aplicar el orden de anidamiento de brackets {[()]} según la profundidad', () => {
    // Generamos fórmulas y buscamos que se cumpla el orden de profundidad {[()]}
    // Un paréntesis interno () no debe contener corchetes [] ni llaves {} dentro de él.
    // Un corchete [] solo puede contener variables o paréntesis () dentro de él.
    // Una llave {} puede contener cualquiera de los anteriores.
    for (let i = 0; i < 20; i++) {
      const formula = generateRandomFormula(4);
      
      // Si la fórmula tiene llaves {}, éstas deben contener corchetes [] o paréntesis ().
      if (formula.includes('{')) {
        // Encontrar lo que está dentro de las llaves externas
        const openBrace = formula.indexOf('{');
        const closeBrace = formula.lastIndexOf('}');
        const innerContent = formula.slice(openBrace + 1, closeBrace);
        
        // El contenido dentro de { } puede tener [] o ()
        // Pero no debería haber llaves de apertura dentro del contenido
        expect(innerContent).not.toContain('{');
      }

      // Si la fórmula tiene corchetes [], el contenido de los corchetes NO puede contener llaves {},
      // y solo puede contener paréntesis () o variables simples
      if (formula.includes('[')) {
        let idx = 0;
        while (true) {
          const openBracket = formula.indexOf('[', idx);
          if (openBracket === -1) break;
          // Encontrar el corchete de cierre correspondiente
          let depth = 1;
          let closeBracket = openBracket + 1;
          while (closeBracket < formula.length && depth > 0) {
            if (formula[closeBracket] === '[') depth++;
            if (formula[closeBracket] === ']') depth--;
            if (depth === 0) break;
            closeBracket++;
          }
          
          const innerContent = formula.slice(openBracket + 1, closeBracket);
          expect(innerContent).not.toContain('{');
          expect(innerContent).not.toContain('}');
          expect(innerContent).not.toContain('[');
          idx = openBracket + 1;
        }
      }

      // Si la fórmula tiene paréntesis (), el contenido interno NO puede contener [], {}, (, ni )
      if (formula.includes('(')) {
        let idx = 0;
        while (true) {
          const openParen = formula.indexOf('(', idx);
          if (openParen === -1) break;
          
          let depth = 1;
          let closeParen = openParen + 1;
          while (closeParen < formula.length && depth > 0) {
            if (formula[closeParen] === '(') depth++;
            if (formula[closeParen] === ')') depth--;
            if (depth === 0) break;
            closeParen++;
          }
          
          const innerContent = formula.slice(openParen + 1, closeParen);
          expect(innerContent).not.toContain('{');
          expect(innerContent).not.toContain('}');
          expect(innerContent).not.toContain('[');
          expect(innerContent).not.toContain(']');
          expect(innerContent).not.toContain('(');
          idx = openParen + 1;
        }
      }
    }
  });
});
