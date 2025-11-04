/* ===== Base Path & URL helpers ===== */
(function () {
  function detectBase() {
    // 以 /plus/ 为例，若路径中包含该段则加此前缀
    var p = location.pathname;
    var idx = p.indexOf('/plus/');
    var base = idx >= 0 ? p.slice(0, idx + '/plus/'.length) : '/';
    return base === '/' ? '' : base.replace(/\/$/, '');
  }
  window.withBase = function (url) {
    if (!url) return '';
    if (/^https?:|^data:|^mailto:|^#/.test(url)) return url;
    var base = window.__BASE_PATH__ || (window.__BASE_PATH__ = detectBase());
    url = url.replace(/^\.?\//, '');
    return base ? base + '/' + url : '/' + url;
  };
  // 自动修正带 data-wb 的链接（根据仓库前缀补全）
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-wb]').forEach(function (a) {
      var href = a.getAttribute('href') || 'index.html';
      a.setAttribute('href', withBase(href));
    });
  });
})();

/* ===== 简易工具 ===== */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const debounce = (fn, wait = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
};
const fmtDate = (s) => (s ? new Date(s.replace(/-/g, '/')).toISOString().slice(0, 10) : '');

/* ===== 读取 JSON（强制不走缓存） ===== */
async function fetchJSON(path) {
  const url = withBase(path + (path.includes('?') ? '&' : '?') + 'v=' + Date.now());
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('load ' + url + ' ' + res.status);
  return res.json();
}

/* ===== 导航渲染（含200ms防闪退 + 直链转 slug） ===== */
async function renderNav() {
  const nav = $('#navbar');
  if (!nav) return;

  const data = await fetchJSON('content/data/navigation.json');

  // 把 content/posts/xxx.html 自动改成 article.html?slug=xxx
  function fixUrl(u) {
    if (!u) return '#';
    const m1 = u.match(/^content\/posts\/([^\.\/]+)\.html$/i);
    if (m1) return 'article.html?slug=' + m1[1];
    return u; // 已是 slug 或外链/锚点
  }

  nav.innerHTML = (data.items || [])
    .map(
      (grp, i) => `
    <div class="nav-group">
      <div class="nav-item" data-idx="${i}">${grp.title || ''}</div>
      <div class="dropdown" id="dd-${i}">
        ${(grp.children || [])
          .map((c) => `<a href="${withBase(fixUrl(c.url))}">${c.title || ''}</a>`)
          .join('')}
      </div>
    </div>`
    )
    .join('');

  // 防闪退 hover 延迟隐藏（每组单独管理）
  $$('.nav-group').forEach((g) => {
    const item = g.querySelector('.nav-item');
    const dd = g.querySelector('.dropdown');
    let hideTimer = null;
    const show = () => { clearTimeout(hideTimer); dd.style.display = 'block'; };
    const hide = () => { hideTimer = setTimeout(() => (dd.style.display = 'none'), 200); };
    item.addEventListener('mouseenter', show);
    item.addEventListener('mouseleave', hide);
    dd.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    dd.addEventListener('mouseleave', hide);
  });
}

/* ===== 右侧栏渲染 ===== */
async function renderSidebar() {
  const site = await fetchJSON('content/data/siteinfo.json').catch(() => ({}));
  const setText = (sel, text) => { const el = $(sel); if (el) el.textContent = text || ''; };
  const setHref = (sel, href) => { const el = $(sel); if (el && href) el.href = withBase(href); };
  const setSrc  = (sel, src)  => { const el = $(sel); if (el && src) el.src = withBase(src); };

  setText('#siteDesc', site.description || '');
  setText('#wxId', site.wechat || '');
  const mail = $('#siteEmail');
  if (mail) {
    mail.textContent = site.email || '';
    mail.href = site.email ? 'mailto:' + site.email : 'javascript:void(0)';
  }
  setText('#adTitle', site.ad?.title || '广告');
  setText('#adPrice', site.ad?.price || '');
  setSrc('#adImage', site.ad?.image || 'images/ad1.png');
  const btn = $('#adBtn');
  if (btn) {
    btn.textContent = site.ad?.button?.text || '了解更多';
    btn.href = withBase(site.ad?.button?.link || '#');
  }
  setSrc('#qrcode', 'images/qrcode-wechat.png');
}

/* ===== 搜索索引 ===== */
async function loadSearchIndex() {
  const idx = await fetchJSON('content/data/search.json');
  return (idx || []).map((x) => ({
    ...x,
    date: fmtDate(x.date),
    tags: x.tags || [],
    categories: x.categories || [],
    top: !!x.top,
  }));
}

/* ===== 删除 posts 正文后自动过滤（存在性检查：.md -> .html） ===== */
async function filterExistingPosts(list) {
  async function headOk(url) {
    try {
      const res = await fetch(withBase(url), { method: 'HEAD', cache: 'no-store' });
      return res.ok;
    } catch (_) {
      return false;
    }
  }
  const results = await Promise.all(
    list.map(async (p) => {
      // 先尝试 .md，再尝试 .html（按你的仓库实际正文格式来）
      const md  = `content/posts/${p.slug}.md`;
      const htm = `content/posts/${p.slug}.html`;
      if (await headOk(md))  return p;
      if (await headOk(htm)) return p;
      return null; // 文件不存在 -> 过滤掉
    })
  );
  return results.filter(Boolean);
}

/* ===== 推荐区（最新 4 条，或有 top 优先） ===== */
function renderRecommend(list) {
  const box = $('#recommendGrid');
  if (!box) return;
  const sorted = [...list]
    .sort((a, b) => {
      if (a.top && !b.top) return -1;
      if (!a.top && b.top) return 1;
      return (b.date || '').localeCompare(a.date || '');
    })
    .slice(0, 4);
  box.innerHTML = sorted
    .map(
      (p) => `
    <div class="reco-item">
      <div class="reco-thumb">
        <a href="${withBase('article.html?slug=' + encodeURIComponent(p.slug))}">
          <img src="${withBase(p.cover || 'images/banner-plus.jpg')}" alt="${p.title}" onerror="this.style.display='none'">
        </a>
      </div>
      <div class="reco-meta">
        <div class="reco-title">
          <a href="${withBase('article.html?slug=' + encodeURIComponent(p.slug))}">${p.title}</a>
        </div>
        <div class="reco-extra">${p.date || ''} · <span class="bsz" data-slug="${p.slug}">阅读量↑</span></div>
      </div>
    </div>`
    )
    .join('');
}

/* ===== 列表 + 分页 ===== */
function getPageFromURL() {
  const u = new URL(location.href);
  return Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
}
function setPageToURL(page) {
  const u = new URL(location.href);
  u.searchParams.set('page', page);
  history.replaceState(null, '', u.pathname + u.search);
}
function renderList(all, page = 1, perPage = 6) {
  const start = (page - 1) * perPage;
  const items = all.slice(start, start + perPage);
  const box = $('#listContainer');
  if (!box) return;

  box.innerHTML = items
    .map(
      (p) => `
    <article class="list-card">
      <a class="list-thumb" href="${withBase('article.html?slug=' + encodeURIComponent(p.slug))}">
        <img src="${withBase(p.cover || 'images/banner-plus.jpg')}" alt="${p.title}" onerror="this.style.display='none'">
      </a>
      <div class="list-main">
        <h3 class="list-title"><a href="${withBase('article.html?slug=' + encodeURIComponent(p.slug))}">${p.title}</a></h3>
        <div class="article-meta">
          <span>${p.date || ''}</span>
          <span>分类：${(p.categories || []).join(' / ')}</span>
          <span>阅读：<span class="bsz" data-slug="${p.slug}">—</span></span>
        </div>
        <p class="article-excerpt">${p.excerpt || ''}</p>
        <div class="article-tags">
          ${(p.tags || [])
            .map((t) => `<a class="tag-pill" href="${withBase('tags.html?name=' + encodeURIComponent(t))}">#${t}</a>`)
            .join('')}
        </div>
      </div>
    </article>`
    )
    .join('');

  // 分页
  const total = Math.ceil(all.length / perPage);
  const pag = $('#pagination');
  if (!pag) return;

  const mkNum = (n, active) =>
    `<a class="page-num ${active ? 'active' : ''}" href="${withBase('index.html?page=' + n)}" data-go="${n}">${n}</a>`;
  let html = '';
  html += `<a class="page-btn" href="${withBase('index.html?page=' + Math.max(1, page - 1))}" data-go="${Math.max(1, page - 1)}">上一页</a>`;
  for (let i = 1; i <= total; i++) html += mkNum(i, i === page);
  html += `<a class="page-btn" href="${withBase('index.html?page=' + Math.min(total, page + 1))}" data-go="${Math.min(total, page + 1)}">下一页</a>`;
  pag.innerHTML = html;

  // 拦截点击以保持单页刷新（可选）
  pag.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-go]');
    if (!a) return;
    e.preventDefault();
    const n = parseInt(a.dataset.go, 10);
    setPageToURL(n);
    renderList(all, n, perPage);
    scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ===== 搜索 ===== */
function filterByKeyword(list, kw) {
  if (!kw) return list;
  kw = kw.toLowerCase();
  return list.filter((p) => {
    return (p.title || '').toLowerCase().includes(kw) ||
      (p.excerpt || '').toLowerCase().includes(kw) ||
      (p.tags || []).join(',').toLowerCase().includes(kw);
  });
}

/* ===== 初始化（所有 await 都在这里） ===== */
(async function init() {
  // 年份
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  // 导航与侧栏
  try { await renderNav(); } catch (e) { console.error('renderNav failed:', e); }
  try { await renderSidebar(); } catch (e) { console.error('renderSidebar failed:', e); }

  // 索引 + 过滤掉已删除正文的条目
  let index = [];
  try {
    const rawIndex = await loadSearchIndex();
    index = await filterExistingPosts(rawIndex);
  } catch (e) {
    console.error('load index failed:', e);
    index = []; // 兜底
  }

  // 搜索联动
  const input = $('#searchInput');
  const apply = () => {
    const kw = (input?.value || '').trim();
    const filtered = filterByKeyword(index, kw).sort(
      (a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || (b.date || '').localeCompare(a.date || '')
    );
    const hint = $('#searchHint');
    if (hint) {
      hint.style.display = kw ? 'block' : 'none';
      hint.textContent = kw ? `找到 ${filtered.length} 条与「${kw}」相关的内容` : '';
    }
    renderRecommend(filtered);
    renderList(filtered, getPageFromURL(), 6);
  };
  if (input) input.addEventListener('input', debounce(apply, 300));

  // 初始渲染
  const page = getPageFromURL();
  const sorted = [...index].sort(
    (a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || (b.date || '').localeCompare(a.date || '')
  );
  renderRecommend(sorted);
  renderList(sorted, page, 6);

  // 悬浮微信（存在就启用）
  const float = $('#wxFloat'), pop = $('#wxFloatPop');
  if (float && pop) {
    float.addEventListener('mouseenter', () => (pop.style.display = 'block'));
    float.addEventListener('mouseleave', () => (pop.style.display = 'none'));
  }
})();
