// 검증에서 실제 TypeScript 구현을 실행합니다. 계산식을 복사하지 않습니다.
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = function (module, filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};
