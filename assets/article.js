/* ---------- 文章页加载器：统一读取 HTML，失败再回退 MD ---------- */

/* 用首页里已经注入的 withBase()；如果没有则做一个极简兜底 */
window.withBase = window.withBase || (function () {
  function detectBase() {
    var p = location.pathname;
    var i = p.indexOf('/plus/');
    var base = i >= 0 ? p.slice(0, i + '/plus/'.length) : '/';
    return base === '/' ? '' : base.replace(/\/$/, '');
  }
  return function (url) {
    if (!url) return '';
    if (/^https?:|^data:|^mailto:|^#/.test(url)) return url;
    var base = window.__BASE_PATH__ || (window.__BASE_PATH__ = detectBase());
    url = url.replace(/^\.?\//, '');
    return base ? base + '/' + url : '/' + url;
  };
})();

/* 小工具 */
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const getParam = k => new URL(location.href).searchParams.get(k) || '';

/* 读取文本（强制不走缓存） */
async function fetchText(path) {
  const url = withBase(path + (path.includes('?') ? '&' : '?') + 'v=' + Date.now());
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('load ' + url + ' ' + res.status);
  return res.text();
}

/* very simple markdown → html 兜底（只在 .md 才用） */
function md2html(md) {
  // 如果页面已引入 marked，则直接用 marked
  if (window.marked) return window.marked.parse(md);
  // 备用的极简转换（仅 H2/H3/段落）
  return md
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^(?!<h\d>)([^\n]+)\n/gm, '<p>$1</p>\n');
}

/* 生成 TOC（基于 #articleBody 的 h2/h3） */
function buildTOC() {
  const toc = $('#toc');
  const heads = $$('#articleBody h2, #articleBody h3');
  if (!toc || !heads.length) return;
  let html = '<ul>';
  heads.forEach((h, idx) => {
    if (!h.id) h.id = 'h-' + (idx + 1);
    const tag = h.tagName.toLowerCase();
    const cls = tag === 'h3' ? ' class="sub"' : '';
    html += `<li${cls}><a href="#${h.id}">${h.textContent.trim()}</a></li>`;
  });
  html += '</ul>';
  toc.innerHTML = html;

  // 如果你用了 tocbot，这里也可以初始化：
  // if (window.tocbot) {
  //   tocbot.init({ tocSelector:'#toc', contentSelector:'#articleBody', headingSelector:'h2, h3' });
  // }
}

/* 面包屑（简单版） */
function renderBreadcrumb(title) {
  const bc = $('#breadcrumb');
  if (!bc) return;
  const safe = (title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  bc.innerHTML = `木子AI » ${safe || ''}`;
}

/* 右侧栏（直接复用首页 main.js 里的 renderSidebar。如果没加载到，也做个兜底） */
async function ensureSidebar() {
  if (typeof window.renderSidebar === 'function') {
    try { await window.renderSidebar(); return; } catch(e){}
  }
  // 兜底：给二维码等一个默认地址，避免 404
  const qrcode = $('#qrcode');
  if (qrcode) qrcode.src = withBase('images/qrcode-wechat.png');
}

/* 主流程：按 slug 加载 HTML，失败再回退 .md */
async function loadArticle() {
  const bodyEl = $('#articleBody');
  if (!bodyEl) return;

  const slug = getParam('slug').trim();
  if (!slug) {
    bodyEl.innerHTML = '<p style="color:#888">未提供 slug 参数。</p>';
    return;
  }

  // 优先读 HTML
  const htmlPath = `content/posts/${slug}.html`;
  const mdPath   = `content/posts/${slug}.md`;

  try {
    const html = await fetchText(htmlPath);
    bodyEl.innerHTML = html;
    // 从文档第一 h1/h2 拿一个标题用于面包屑
    const h = bodyEl.querySelector('h1, h2');
    renderBreadcrumb(h ? h.textContent : slug);
  } catch (e1) {
    // 回退读 MD
    try {
      const md = await fetchText(mdPath);
      bodyEl.innerHTML = md2html(md);
      const h = bodyEl.querySelector('h1, h2');
      renderBreadcrumb(h ? h.textContent : slug);
    } catch (e2) {
      bodyEl.innerHTML = `<p style="color:#888">未找到本文内容，请确认 <code>${htmlPath}</code> 或 <code>${mdPath}</code> 是否存在。</p>`;
      renderBreadcrumb(slug);
    }
  }

  // 目录
  buildTOC();
}

/* 初始化：导航、侧栏、文章 */
(async function init() {
  // 页脚年份
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  // 导航（复用首页函数）
  if (typeof window.renderNav === 'function') {
    try { await window.renderNav(); } catch(e){}
  }

  await ensureSidebar();
  await loadArticle();
})();
