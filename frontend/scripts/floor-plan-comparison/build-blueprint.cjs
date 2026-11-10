const path = require('node:path');
const work = path.resolve(process.argv[2] || '/tmp/floor-plan-comparison');
const ts = require(path.join(work, 'blueprint-runtime/node_modules/typescript'));
const program = ts.createProgram([path.join(work, 'blueprint3d-master/src/blueprint3d.ts')], {
  outFile: path.join(work, 'blueprint.js'), target: ts.ScriptTarget.ES5, noEmitOnError: true, skipLibCheck: true,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
}));
if (program.emit().emitSkipped) throw Error('Blueprint3Dのビルドに失敗しました。');
console.log('Blueprint3D: 診断0でビルドしました。');
