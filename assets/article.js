// /plus/assets/article.js
// 文章页：加载 MD 或 body、渲染 TOC、Breadcrumb、Meta、上下篇 + 全站微信悬浮按钮
const q = (s, el = document) => el.querySelector(s);
async function getJSON(p) { const r = await fetch(url(p)); if (!r.ok) throw new Error(p); return r.json(); }
function getParam(k) { return new URLSearchParams(location.search).get(k) || ''; }
function esc(s) { return (s ?? '').toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function buildLink(slug) { return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`; }

let SITE = {}, POSTS = [];
init().catch(console.error);

async function init() {
  // 1) 读取站点配置与文章清单
  SITE = await getJSON('content/site.json');
  POSTS = await getJSON('content/index.json');
  renderNav();

  // 2) 页脚邮箱（可选）
  const se = q('#siteEmail'); 
  if (se) se.textContent = SITE.email || '';

  // 3) 全站微信悬浮按钮
  initWeChatFloat(SITE);

  // 4) 取 slug
  const slug = getParam('slug');
  if (!slug) { 
    q('#postContent').innerHTML = '<p>缺少 slug 参数。</p>'; 
    return; 
  }

  // 5) 找到当前文章的 meta
  const meta = (POSTS || []).find(p => p.slug === slug);
  if (!meta) { 
    q('#postContent').innerHTML = '<p>文章不存在或已删除。</p>'; 
    return; 
  }

  // 6) 取正文：优先 index.json 的 body；没有再读 posts/<slug>.md
  let md = (meta && meta.body) || '';
  let attrs = {};
  if (!md) {
    const res = await fetch(url(`content/posts/${slug}.md`));
    if (!res.ok) { 
      q('#postContent').innerHTML = '<p>正文缺失。</p>'; 
      return; 
    }
    const raw = await res.text();
    const fm = parseFrontMatter(raw);
    attrs = fm.attrs || {};
    md = fm.content || raw;
  } else {
    // body 模式下头部信息从 meta 来
    attrs = {};
  }

  // 7) 标题/时间等属性
  const title = (attrs.title || meta.title || '文章');
  const date  = (attrs.date  || meta.date  || '');
  const merged = { ...meta, ...attrs, title, date };

  // 8) Markdown -> HTML（marked 存在则用，否则兜底）
  const html = (window.marked && window.marked.parse) 
    ? window.marked.parse(md) 
    : mdToHtmlFallback(md);
  q('#postTitle').textContent = title;
  q('#postContent').innerHTML = html;

  // 9) 文章部件
  renderBreadcrumb(merged, slug);
  renderMetaBar(merged);
  renderTopAds();
  renderPrevNext(slug);

  // 10) 右侧 TOC
  buildTOC('#postContent', '#toc', (SITE.tocLevels || ['h2', 'h3']));
}

// ============== 导航（含防闪退） ==============
function renderNav() {
  const ul = q('#navList'); if (!ul) return;
  ul.innerHTML = (SITE.nav || []).map(group => {
    const items = (group.children || []).map(c => `<a href="${buildLink(c.slug)}">${esc(c.label || c.slug)}</a>`).join('');
    return `<li class="nav-item">
      <a href="javascript:void(0)">${esc(group.label || '分类')}</a>
      <div class="submenu">${items}</div>
    </li>`;
  }).join('');
  // 防闪退：延迟隐藏
  [...ul.children].forEach(li => {
    let t; const sub = li.querySelector('.submenu');
    li.addEventListener('mouseleave', () => { t = setTimeout(() => { if (sub) sub.style.display = 'none'; }, 200); });
    li.addEventListener('mouseenter', () => { clearTimeout(t); if (sub) sub.style.display = 'block'; });
  });
}

// ============== 面包屑 ==============
function renderBreadcrumb(attrs, slug) {
  const sep = SITE.breadcrumbSeparator || '»';
  const cat = (attrs.categories && attrs.categories[0]) || 'ChatGPT';
  const html = [
    `<a href="${PREFIX}">首页</a>`,
    `<a href="${PREFIX}tags.html?tag=${encodeURIComponent(cat)}">${esc(cat)}</a>`,
    `<span>${esc(attrs.title || '正文')}</span>`
  ].join(` <span class="sep">${sep}</span> `);
  q('#breadcrumb').innerHTML = html;

  // JSON-LD
  const base = SITE.siteUrl || (location.origin + PREFIX);
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "首页", "item": base },
      { "@type": "ListItem", "position": 2, "name": cat, "item": `${base}tags.html?tag=${encodeURIComponent(cat)}` },
      { "@type": "ListItem", "position": 3, "name": attrs.title || '正文' }
    ]
  };
  const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld);
  document.head.appendChild(s);
}

// ============== 元信息条 ==============
function renderMetaBar(attrs) {
  const left = `<span rel="author">${esc(SITE.author || '作者')}</span> · 微信：${esc(SITE.wechatId || '')}`;
  const right = `<time datetime="${esc(attrs.date || '')}">${esc(attrs.date || '')}</time>`;
  q('#metaBar').innerHTML = `<div>${left}</div><div>${right}</div>`;
}

// ============== 顶部广告 ==============
function renderTopAds() {
  const box = q('#topAds'); if (!box) return;
  const ads = (SITE.ads && SITE.ads.articleTop) || [];
  box.innerHTML = ads.slice(0, 2).map(a => `
    <div class="ad">
      <img src="${a.image || '/plus/images/banner-plus.jpg'}" alt="">
      <div><div><b>${esc(a.title || '广告')}</b></div><div>${esc(a.desc || '')}</div></div>
      <a class="btn" target="_blank" href="${a.buttonLink || '#'}">${esc(a.buttonText || '了解更多')}</a>
    </div>
  `).join('');
}

// ============== 上一篇 / 下一篇 ==============
function renderPrevNext(slug) {
  const sorted = [...POSTS].sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || (b.date || '').localeCompare(a.date || ''));
  const idx = sorted.findIndex(p => p.slug === slug);
  const prev = sorted[idx - 1], next = sorted[idx + 1];
  q('#postNav').innerHTML = `
    <div class="pagination">
      ${prev ? `<a class="page-btn" href="${buildLink(prev.slug)}">上一篇：${esc(prev.title)}</a>` : ''}
      ${next ? `<a class="page-btn" href="${buildLink(next.slug)}">下一篇：${esc(next.title)}</a>` : ''}
    </div>
  `;
}

// ============== Front-matter 解析 ==============
function parseFrontMatter(text) {
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end > 0) {
      const raw = text.slice(3, end).trim();
      const content = text.slice(end + 4).trim();
      const attrs = {};
      raw.split('\n').forEach(line => {
        const m = line.match(/^(\w+):\s*(.*)$/);
        if (m) {
          const k = m[1]; let v = m[2].trim();
          if (v.startsWith('[') && v.endsWith(']')) { try { v = JSON.parse(v.replace(/'/g, '"')); } catch { } }
          attrs[k] = v.replace(/^"(.*)"$/, '$1');
        }
      });
      return { attrs, content };
    }
  }
  return { attrs: {}, content: text };
}

// ============== Markdown 兜底渲染 ==============
function mdToHtmlFallback(md) {
  let html = md
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n{2,}/g, '</p><p>');
  return `<p>${html}</p>`;
}

// ============== 生成 TOC（无 tocbot 时也可用） ==============
function buildTOC(contentSel, tocSel, levels) {
  const cont = q(contentSel); const toc = q(tocSel); if (!cont || !toc) return;
  const sel = levels.join(',');
  const hs = [...cont.querySelectorAll(sel)];
  if (!hs.length) { toc.innerHTML = '<div>（无小节）</div>'; return; }
  hs.forEach((h, i) => { if (!h.id) h.id = 'h-' + i; });
  toc.innerHTML = hs.map(h => {
    const tag = h.tagName.toLowerCase();
    const pad = tag === 'h3' ? ' style="padding-left:12px"' : '';
    return `<a${pad} href="#${h.id}">${esc(h.textContent)}</a>`;
  }).join('');
}

// ============== 微信悬浮按钮（全站） ==============
function initWeChatFloat(site) {
  try {
    // 若已存在则不重复渲染
    if (document.querySelector('.wechat-float')) return;

    const cfg = site.wechat || {};
    const icon = cfg.icon || '';            // e.g. /plus/images/wechat-float.png
    const qr   = cfg.qrcode || '';          // e.g. /plus/images/qrcode-wechat.png
    const txt  = cfg.text || ('微信：' + (site.wechatId || ''));
    const pos  = cfg.position || { right: 35, bottom: 150 };

    // 容器
    const wrap = document.createElement('div');
    wrap.className = 'wechat-float';
    wrap.style.right  = (pos.right ?? 35) + 'px';
    wrap.style.bottom = (pos.bottom ?? 150) + 'px';

    // 图标或回退
    if (icon) {
      const im = document.createElement('img');
      im.className = 'icon';
      im.alt = 'WeChat';
      im.src = icon;
      // 图标加载失败 → 回退
      im.onerror = () => { im.remove(); addFallback(); };
      wrap.appendChild(im);
    } else {
      addFallback();
    }
    function addFallback() {
      const s = document.createElement('span');
      s.className = 'fallback';
      s.textContent = '微信';
      wrap.appendChild(s);
    }

    // 二维码面板（固定 311×403）
    const panel = document.createElement('div');
    panel.className = 'qr';
    panel.innerHTML = qr ? `<img src="${qr}" alt="${esc(txt)}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#888;">未配置二维码</div>`;
    wrap.appendChild(panel);

    // 交互：PC 悬停、移动端点击
    let touchMode = false;
    wrap.addEventListener('mouseenter', () => { if (!touchMode) wrap.classList.add('show'); });
    wrap.addEventListener('mouseleave', () => { if (!touchMode) wrap.classList.remove('show'); });
    wrap.addEventListener('click', () => {
      touchMode = true;
      wrap.classList.toggle('show');
    });

    document.body.appendChild(wrap);
  } catch (e) {
    console.error('WeChat float init error:', e);
  }
}
