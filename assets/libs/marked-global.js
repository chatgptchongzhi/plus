// /plus/assets/libs/marked-global.js
// 把 ESM 的 marked 导出挂到 window.marked，供非模块脚本使用
import * as M from '/plus/assets/libs/marked.min.js';
const m = (M && (M.marked || M.default || M)) || null;
if (m) {
  window.marked = m;
  // 某些版本默认导出是函数；补上 parse 以兼容你现有 article.js 的用法
  if (typeof window.marked === 'function' && !window.marked.parse && M.parse) {
    window.marked.parse = M.parse;
  }
} else {
  console.error('[marked-global] 无法从 ESM 导入 marked');
}
