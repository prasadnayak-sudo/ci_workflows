/**
 * dependency-cruiser config
 * Do kaam karta hai:
 *  1. `depcruise src --validate` -> imports sahi hain ya nahi (Checking imports job)
 *  2. `depcruise src --output-type json` -> import graph, jiss se impact report banti hai
 */
module.exports = {
  forbidden: [
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment:
        'Is file ka import resolve hi nahi hota - path galat hai, ya package install nahi hai. ' +
        'Build ya runtime par yahi tootta hai.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular import. Module init order par depend karne lagta hai, isliye kabhi-kabhi ' +
        'undefined milta hai aur test order badalne par fail hota hai.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' }, // TS path alias (@/components) resolve karne ke liye
    // `import type { ... }` compile hone pe gayab ho jaata hai. Ye flag off ho to
    // shared types file "isolated" dikhti hai — jabki asal mein sabse zyada
    // blast radius usi ka hota hai.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
  },
}
