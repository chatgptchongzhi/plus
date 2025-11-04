/* ===== Base Path & URL helpers ===== */
(function(){
  function detectBase(){
    // 以 /plus/ 为例，若路径中包含该段则加此前缀
    var p = location.pathname;
    var idx = p.indexOf('/plus/');
    var base = idx >= 0 ? p.slice(0, idx + '/plus/'.length) : '/';
    return base === '/' ? '' : base.replace(/\/$/,'');
  }
  window.withBase = function(url){
    if(!url) return '';
    if(/^https?:|^data:|^mailto:|^#/.test(url)) return url;
    var base = window.__BASE_PATH__ || (window.__BASE_PATH__ = detectBase());
    url = url.replace(/^\.?\//,'');
    return base ? base + '/' + url : '/' + url;
  };
  // 将带 data-wb 的链接修正
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[data-wb]').forEach(function(a){
      var href = a.getAttribute('href') || 'index.html';
      a.setAttribute('href', withBase(href));
    });
  });
})();

/* ===== 简易工具 ===== */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const debounce = (fn, wait=300) => {
  let t; return (...args)=>{clearTimeout(t); t=setTimeout(()=>fn(...args), wait)};
};
const fmtDate = s => s ? new Date(s.replace(/-/g,'/')).toISOString().slice(0,10) : '';

/* ===== 读取站点数据 ===== */
/* ===== 读取站点数据（强制不走缓存） ===== */
async function fetchJSON(path){
  const url = withBase(path + (path.includes('?') ? '&' : '?') + 'v=' + Date.now());
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('load ' + url + ' ' + res.status);
  return res.json();
}


/* ===== 导航渲染（含200ms防闪退） ===== */
/* ===== 导航渲染（含200ms防闪退，自动修正直链为 slug） ===== */
async function renderNav(){
  const nav = $('#navbar');
  if (!nav) return;

  const data = await fetchJSON('content/data/navigation.json');

  // 把 content/posts/xxx.html 自动改成 article.html?slug=xxx
  function fixUrl(u){
    if (!u) return '#';
    const m1 = u.match(/^content\/posts\/([^\.\/]+)\.html$/i);
    if (m1) return 'article.html?slug=' + m1[1];
    return u; // 已是 slug 或外链/锚点
  }

  nav.innerHTML = (data.items || []).map((grp,i)=>`
    <div class="nav-group">
      <div class="nav-item" data-idx="${i}">${grp.title || ''}</div>
      <div class="dropdown" id="dd-${i}">
        ${(grp.children || []).map(c=>`
          <a href="${withBase(fixUrl(c.url))}">${c.title || ''}</a>
        `).join('')}
      </div>
    </div>
  `).join('');

  // 防闪退 hover 延迟隐藏
  $$('.nav-group').forEach((g)=>{
    const item = g.querySelector('.nav-item');
    const dd   = g.querySelector('.dropdown');
    let hideTimer=null;
    const show=()=>{ clearTimeout(hideTimer); dd.style.display='block'; };
    const hide=()=>{ hideTimer=setTimeout(()=> dd.style.display='none',200); };
    item.addEventListener('mouseenter', show);
    item.addEventListener('mouseleave', hide);
    dd.addEventListener('mouseenter', ()=>clearTimeout(hideTimer));
    dd.addEventListener('mouseleave', hide);
  });
}


/* ===== 右侧栏渲染 ===== */
async function renderSidebar(){
  const site = await fetchJSON('content/data/siteinfo.json');
  $('#siteDesc').textContent = site.description || '';
  $('#wxId').textContent = site.wechat || '';
  $('#siteEmail').textContent = site.email || '';
  $('#adTitle').textContent = site.ad?.title || '广告';
  $('#adPrice').textContent = site.ad?.price || '';
  $('#adImage').src = withBase(site.ad?.image || 'images/ad1.png');
  const btn = $('#adBtn');
  btn.textContent = site.ad?.button?.text || '了解更多';
  btn.href = withBase(site.ad?.button?.link || '#');
  $('#qrcode').src = withBase('images/qrcode-wechat.png');
}

/* ===== 搜索索引 ===== */
async function loadSearchIndex(){
  // 直接读取 search.json；若缺失个别字段，运行时补齐
  const idx = await fetchJSON('content/data/search.json');
  return idx.map(x=>({
    ...x,
    date: fmtDate(x.date),
    tags: x.tags || [],
    categories: x.categories || [],
    top: !!x.top
  }));
}
/* ===== 过滤：只保留仍然存在的正文文件 ===== */
async function filterExistingPosts(list){
  const results = await Promise.all(list.map(async (p) => {
    // 只检查有 slug 的条目
    if (!p || !p.slug) return null;
    // 检查对应的静态正文是否还在：content/posts/<slug>.html
    const url = withBase(`content/posts/${encodeURIComponent(p.slug)}.html?v=${Date.now()}`);
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return res.ok ? p : null; // 200 就保留，否则丢弃
    } catch (e) {
      return null;
    }
  }));
  return results.filter(Boolean);
}

/* ===== 推荐区（最新 4 条，或有 top 优先） ===== */
function renderRecommend(list){
  // 先按 top，再按 date 倒序
  const sorted = [...list].sort((a,b)=>{
    if(a.top && !b.top) return -1;
    if(!a.top && b.top) return 1;
    return (b.date||'').localeCompare(a.date||'');
  }).slice(0,4);
  $('#recommendGrid').innerHTML = sorted.map(p=>`
    <div class="reco-item">
      <div class="reco-thumb">
        <a href="${withBase('article.html?slug='+encodeURIComponent(p.slug))}">
          <img src="${withBase(p.cover || 'images/banner-plus.jpg')}" alt="${p.title}" onerror="this.style.display='none'">
        </a>
      </div>
      <div class="reco-meta">
        <div class="reco-title">
          <a href="${withBase('article.html?slug='+encodeURIComponent(p.slug))}">${p.title}</a>
        </div>
        <div class="reco-extra">${p.date||''} · <span class="bsz" data-slug="${p.slug}">阅读量↑</span></div>
      </div>
    </div>
  `).join('');
}

/* ===== 列表 + 分页 ===== */
function getPageFromURL(){
  const u = new URL(location.href);
  return Math.max(1, parseInt(u.searchParams.get('page')||'1',10));
}
function setPageToURL(page){
  const u = new URL(location.href);
  u.searchParams.set('page', page);
  history.replaceState(null,'', u.pathname + u.search);
}
function renderList(all, page=1, perPage=6){
  const start = (page-1)*perPage;
  const items = all.slice(start, start+perPage);
  const box = $('#listContainer');
  box.innerHTML = items.map(p=>`
    <article class="list-card">
      <a class="list-thumb" href="${withBase('article.html?slug='+encodeURIComponent(p.slug))}">
        <img src="${withBase(p.cover || 'images/banner-plus.jpg')}" alt="${p.title}" onerror="this.style.display='none'">
      </a>
      <div class="list-main">
        <h3 class="list-title"><a href="${withBase('article.html?slug='+encodeURIComponent(p.slug))}">${p.title}</a></h3>
        <div class="article-meta">
          <span>${p.date||''}</span>
          <span>分类：${(p.categories||[]).join(' / ')}</span>
          <span>阅读：<span class="bsz" data-slug="${p.slug}">—</span></span>
        </div>
        <p class="article-excerpt">${p.excerpt||''}</p>
        <div class="article-tags">
          ${(p.tags||[]).map(t=>`<a class="tag-pill" href="${withBase('tags.html?name='+encodeURIComponent(t))}">#${t}</a>`).join('')}
        </div>
      </div>
    </article>
  `).join('');

  // 分页
  const total = Math.ceil(all.length / perPage);
  const pag = $('#pagination');
  const mkNum = (n, active)=> `<a class="page-num ${active?'active':''}" href="${withBase('index.html?page='+n)}" data-go="${n}">${n}</a>`;
  let html = '';
  html += `<a class="page-btn" href="${withBase('index.html?page='+Math.max(1, page-1))}" data-go="${Math.max(1,page-1)}">上一页</a>`;
  for(let i=1;i<=total;i++) html += mkNum(i, i===page);
  html += `<a class="page-btn" href="${withBase('index.html?page='+Math.min(total, page+1))}" data-go="${Math.min(total,page+1)}">下一页</a>`;
  pag.innerHTML = html;

  // 拦截点击以保持单页刷新（可选）
  pag.addEventListener('click', (e)=>{
    const a = e.target.closest('a[data-go]');
    if(!a) return;
    e.preventDefault();
    const n = parseInt(a.dataset.go,10);
    setPageToURL(n);
    renderList(all, n, perPage);
    scrollTo({top:0, behavior:'smooth'});
  });
}

/* ===== 搜索 ===== */
function filterByKeyword(list, kw){
  if(!kw) return list;
  kw = kw.toLowerCase();
  return list.filter(p=>{
    return (p.title||'').toLowerCase().includes(kw)
      || (p.excerpt||'').toLowerCase().includes(kw)
      || (p.tags||[]).join(',').toLowerCase().includes(kw);
  });
}
// 兜底：过滤掉已经被删除的文章（根据 slug 去探测对应 html 是否还存在）
async function filterExistingPosts(posts) {
  const checks = posts.map(async p => {
    const path = `content/posts/${p.slug}.html`;
    try {
      const res = await fetch(withBase(path) + `?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      return res.ok ? p : null;  // 200 保留，404/403 等丢弃
    } catch {
      return null;
    }
  });
  const results = await Promise.all(checks);
  return results.filter(Boolean);
}

/* ===== 初始化 ===== */
(async function init(){
  $('#year').textContent = new Date().getFullYear();
  await renderNav();
  await renderSidebar();
let index = await loadSearchIndex();
index = await filterExistingPosts(index);  

  // 搜索联动
  const input = $('#searchInput');
  const apply = ()=>{
    const kw = input.value.trim();
    const filtered = filterByKeyword(index, kw).sort((a,b)=>
      (b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||'')
    );
    $('#searchHint').style.display = kw ? 'block':'none';
    $('#searchHint').textContent = kw ? `找到 ${filtered.length} 条与「${kw}」相关的内容` : '';
    renderRecommend(filtered);
    renderList(filtered, getPageFromURL(), 6);
  };
  input.addEventListener('input', debounce(apply, 300));

  // 初始渲染
  const page = getPageFromURL();
  const sorted = index.sort((a,b)=> (b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));
  renderRecommend(sorted);
  renderList(sorted, page, 6);

  // 悬浮微信
  const float = $('#wxFloat'), pop = $('#wxFloatPop');
  float.addEventListener('mouseenter', ()=> pop.style.display='block');
  float.addEventListener('mouseleave', ()=> pop.style.display='none');
})();
