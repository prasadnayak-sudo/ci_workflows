/**
 * Default dependency-cruiser config — sab consumer repos ke liye.
 * Kisi repo ko alag chahiye to wo apni root mein .dependency-cruiser.cjs
 * rakh de; scripts pehle usi ko uthate hain.
 */
module.exports = {
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    // `import type { ... }` compile hone pe gayab ho jaata hai. Ye flag off ho to
    // shared types file "isolated" dikhti hai — jabki asal mein sabse zyada
    // blast radius usi ka hota hai.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
  },
}
