// 打包成「双击即玩」的单文件 HTML：不需要任何服务器 / 不依赖网络
// 用法：node tools/build-html.mjs
// 原理：把 src/ 下的 ES Module 内联成一个 <script>，输出项目根目录的 三国小兵军团.html
// 说明：screens 之间是循环依赖（布阵 → 战斗 → 结算 → 布阵），所以对同一个「强连通分量」内的
//       import 生成惰性引用（和浏览器 ES Module 的 live binding 行为一致），其余直接解构。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const ENTRY = 'main.js';
const OUT = path.join(ROOT, '三国小兵军团.html');

const modules = new Map(); // id -> { code, exports, deps }

function normalize(spec, fromId) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec));
}

function load(id) {
  if (modules.has(id)) return;
  const file = path.join(SRC, ...id.split('/'));
  if (!fs.existsSync(file)) throw new Error(`找不到模块：${id}（${file}）`);
  let code = fs.readFileSync(file, 'utf8');
  const deps = [];
  const imports = [];

  // 先记下 import 语句，等算完强连通分量再决定「直接解构」还是「惰性引用」
  code = code.replace(/import\s*\{([^}]*)\}\s*from\s*'([^']+)';/g, (m, names, spec) => {
    const depId = normalize(spec, id);
    deps.push(depId);
    const list = names
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    imports.push({ depId, names: list });
    return `/*__IMPORT__${imports.length - 1}__*/`;
  });

  const exported = [];
  code = code.replace(/export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/g, (m, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  code = code.replace(/export\s*\{([^}]*)\}\s*;/g, (m, names) => {
    names
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((n) => exported.push(n));
    return '';
  });

  if (/\b(?:import|export)\b/.test(code)) throw new Error(`模块 ${id} 里还有没处理掉的 import/export`);

  modules.set(id, { code, exports: exported, deps, imports });
  for (const d of deps) load(d);
}

load(ENTRY);

// 音效内联：把 assets/audio 下的音效与占位 BGM 转成 data URI，单文件双击也有声音。
// 真实 BGM（glorious_morning.*）通常有几 MB，不内联，仍按相对路径加载（和 HTML 放在同一目录）。
const AUDIO_MIME = {
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
};
const audioMap = {};
function collectAudio(dir, base) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { collectAudio(full, `${base}/${entry.name}`); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    if (!AUDIO_MIME[ext]) continue;
    if (/^glorious_morning\./i.test(entry.name)) continue;
    if (fs.statSync(full).size > 1024 * 1024) continue;
    audioMap[`${base}/${entry.name}`] = `data:${AUDIO_MIME[ext]};base64,${fs.readFileSync(full).toString('base64')}`;
  }
}
collectAudio(path.join(ROOT, 'assets', 'audio'), 'assets/audio');

// Tarjan 求强连通分量（只用来判断哪些 import 需要惰性引用）
const sccOf = new Map();
let index = 0;
const idx = new Map();
const low = new Map();
const onStack = new Set();
const stack = [];
const sccSize = [];

function strongConnect(id) {
  idx.set(id, index);
  low.set(id, index);
  index++;
  stack.push(id);
  onStack.add(id);
  for (const d of modules.get(id).deps) {
    if (!idx.has(d)) {
      strongConnect(d);
      low.set(id, Math.min(low.get(id), low.get(d)));
    } else if (onStack.has(d)) {
      low.set(id, Math.min(low.get(id), idx.get(d)));
    }
  }
  if (low.get(id) === idx.get(id)) {
    const comp = [];
    let w;
    do {
      w = stack.pop();
      onStack.delete(w);
      comp.push(w);
    } while (w !== id);
    const cid = sccSize.length;
    sccSize.push(comp.length);
    for (const n of comp) sccOf.set(n, cid);
  }
}

for (const id of modules.keys()) if (!idx.has(id)) strongConnect(id);

// 生成每个模块的工厂函数
const defs = [];
for (const [id, mod] of modules.entries()) {
  let code = mod.code;
  code = code.replace(/\/\*__IMPORT__(\d+)__\*\//g, (m, i) => {
    const imp = mod.imports[Number(i)];
    const cyclic = sccOf.get(id) === sccOf.get(imp.depId) && sccSize[sccOf.get(id)] > 1;
    const ref = `__m(${JSON.stringify(imp.depId)})`;
    if (cyclic) {
      // 循环依赖：惰性引用（真正用到时（点按钮跳转）再取）
      return imp.names
        .map((n) => `const ${n} = __lazy(function () { return ${ref}; }, ${JSON.stringify(n)});`)
        .join(' ');
    }
    return imp.names.length ? `const { ${imp.names.join(', ')} } = ${ref};` : `${ref};`;
  });

  defs.push(`__defs[${JSON.stringify(id)}] = function () {`);
  defs.push(code);
  defs.push(`return { ${mod.exports.join(', ')} };`);
  defs.push('};');
}

const bundle = [
  '(function () {',
  `var __AUDIO_EMBED = ${JSON.stringify(audioMap)};`,
  'var __defs = {}, __boxes = {};',
  'function __m(id) {',
  '  var b = __boxes[id];',
  '  if (!b) b = __boxes[id] = { built: false, ns: null };',
  '  if (!b.built) {',
  '    if (!__defs[id]) throw new Error("内部模块不存在：" + id);',
  '    b.built = true;',
  '    b.ns = __defs[id]();',
  '  }',
  '  return b.ns;',
  '}',
  'function __lazy(getNs, name) {',
  '  return new Proxy(function () {}, {',
  '    construct: function (t, args) { return Reflect.construct(getNs()[name], args); },',
  '    apply: function (t, thisArg, args) { return Reflect.apply(getNs()[name], thisArg, args); },',
  '    get: function (t, prop) {',
  '      var target = getNs()[name];',
  '      var val = target ? target[prop] : undefined;',
  '      return typeof val === "function" ? val.bind(target) : val;',
  '    },',
  '  });',
  '}',
  defs.join('\n'),
  `__m(${JSON.stringify(ENTRY)});`,
  '})();',
].join('\n');

const css = `html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #06080c; }
    #stage { position: fixed; inset: 0; }
    canvas { width: 100%; height: 100%; display: block; touch-action: none; -webkit-tap-highlight-color: transparent; }`;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<title>汉末行伍征战记 · 试玩版（单文件）</title>
<style>
${css}
</style>
</head>
<body>
<div id="stage"><canvas id="game"></canvas></div>
<script>
${bundle}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`已生成 ${path.basename(OUT)}（${Math.round(html.length / 1024)} KB，${modules.size} 个模块，双击即可玩，不需要服务器）`);
