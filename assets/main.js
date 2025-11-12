
// /plus/assets/main.js
// 首页：导航 / 推荐 / 列表（单一面板式文章流）/ 分页 / 搜索 / 右侧栏
// 自动发现 posts（GitHub API 扫描 {repoSubdir}/content/posts/*.md 或 content/posts/*.md），与 index.json 合并去重。
// 不再强依赖页面注入的 url()/PREFIX/BUILD_VERSION，内部自带兜底。

/* ---------------- 安全 URL 工具（兜底） ---------------- */
(function ensureGlobals(){
  if (typeof window.BUILD_VERSION === 'undefined') {
    window.BUILD_VERSION = Date.now();
  }
  if (typeof window.PREFIX !== 'string' || !/^\/.+\/$/.test(window.PREFIX)) {
    // 默认按 /plus/ 作为站点子路径
    window.PREFIX = '/plus/';
  }
  if (typeof window.url !== 'function') {
    window.url = function(p){ return `${window.PREFIX}${p}?v=${window.BUILD_VERSION}`; };
  }
})();

/* ---------------- 工具 ---------------- */
const q  = (sel, el=document)=>el.querySelector(sel);
const qa = (sel, el=document)=>[...el.querySelectorAll(sel)];

async function getJSON(path){
  const r = await fetch(url(path), { cache: 'no-store' });
  if(!r.ok) throw new Error(path+' load failed');
  return r.json();
}
function esc(s){return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}
function fmtDate(s){
  if (!s) return '';
  s = String(s).trim();

  // 识别 20251110 或 20251110 15:35:20 这种写法
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\s+(\d{2}:\d{2}:\d{2}))?$/);
  if (m) {
    const datePart = `${m[1]}-${m[2]}-${m[3]}`;     // 2025-11-10
    return m[4] ? `${datePart} ${m[4]}` : datePart; // 拼上时间：2025-11-10 15:35:20
  }

  // 如果本来就是 2025-07-28 或 2025-07-28 15:35:20，就直接原样返回
  return s;
}

function buildLink(slug){return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`}

/* -------- Front-Matter 解析：返回 { fm, body } -------- */
function parseFrontMatter(mdText){
  if (!mdText) return { fm:{}, body:'' };
  const re = /^---\s*[\r\n]+([\s\S]*?)\r?\n---\s*[\r\n]*/;
  const m = mdText.match(re);
  if (!m) return { fm:{}, body: mdText };

  const raw = m[1] || '';
  const fm = {};
  raw.split(/\r?\n/).forEach(line=>{
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx+1).trim();

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (/^\[.*\]$/.test(val)) {
      fm[key] = val.replace(/^\[/,'').replace(/\]$/,'')
        .split(',').map(s=>s.trim().replace(/^['"]|['"]$/g,'')).filter(Boolean);
      return;
    }
    if (val.includes(',') && (key==='tags' || key==='categories')) {
      fm[key] = val.split(',').map(s=>s.trim()).filter(Boolean);
      return;
    }
    if (val === 'true')  { fm[key]=true;  return; }
    if (val === 'false') { fm[key]=false; return; }
    if (!Number.isNaN(Number(val)) && val.trim() !== '') { fm[key] = Number(val); return; }
    fm[key] = val;
  });

  const body = mdText.replace(re, '');
  return { fm, body };
}

/* 从 markdown 推断 excerpt（若无 fm.excerpt） */
function deriveExcerptFromBody(body){
  if (!body) return '';
  const p = body.split(/\n{2,}/).map(s=>s.trim()).find(s=>s && !/^#{1,6}\s+/.test(s));
  if (!p) return '';
  return p
    .replace(/!\[[^\]]*\]\([^)]+\)/g,'')
    .replace(/\[[^\]]*\]\([^)]+\)/g,(m)=>m.replace(/\[|\]|\([^)]+\)/g,''))
    .replace(/`{1,3}[^`]+`{1,3}/g,'')
    .replace(/[*_~>#-]+/g,'')
    .slice(0,140);
}

/* ---------------- 全局状态 ---------------- */
let SITE={}, POSTS=[], SEARCH=[];

init().catch(e=>{
  console.error('[main.init] failed:', e);
  // 兜底：只用 index.json 渲染，避免整页空白
  fallbackRenderWithIndexOnly().catch(err=>console.error('[fallback] failed:', err));
});

/* ---------------- 入口 ---------------- */
async function init(){
  // 1) 读取站点配置
  SITE  = await getJSON('content/site.json').catch(()=>({}));
  const email = q('#siteEmail'); if (email) email.textContent = SITE.email || '';

  // 2) 文章来源：index.json +（可选）自动发现
  POSTS = await loadPosts();

  // 3) 搜索索引：优先 search.json；缺失则由 POSTS 生成
  try { SEARCH = await getJSON('content/search.json'); }
  catch (_) { SEARCH = buildSearchFromPosts(POSTS); }

  // 暴露，便于自检脚本查看
  window.SITE = SITE;
  window.POSTS = POSTS;

  // 4) 渲染
  renderNav();
  renderSidebar();
  renderWeChatFloat();
  renderRecommend();
  bindSearch();
  renderListWithPagination();
}

/* 兜底：只用 index.json 渲染首页（当 autoDiscover 出错时） */
async function fallbackRenderWithIndexOnly(){
  SITE  = await getJSON('content/site.json').catch(()=>({}));
  POSTS = await getJSON('content/index.json').catch(()=>[]);
  window.SITE = SITE;
  window.POSTS = POSTS;
  renderNav(); renderSidebar(); renderWeChatFloat(); renderRecommend(); bindSearch(); renderListWithPagination();
}

/* ---------------- 加载文章：index.json + 可选自动发现 ---------------- */
async function loadPosts(){
  let indexPosts = [];
  try { indexPosts = await getJSON('content/index.json'); } catch(_) { indexPosts = []; }

  if (!SITE.autoDiscoverPosts) {
    return normalizePosts(indexPosts);
  }

  const repo   = SITE.repo   || '';              // e.g. "chatgptchongzhi/plus"
  const branch = SITE.branch || 'main';

  // 允许空字符串 ""：为空时表示“仓库根目录”，不回退为 'plus'
  const repoSubdir = (SITE.repoSubdir === undefined
    ? String(typeof PREFIX==='string'?PREFIX:'/plus/').replace(/^\/|\/$/g,'')
    : SITE.repoSubdir);

  // 只校验 repo 合法；允许 repoSubdir 为 ""（仓库根）
  if (!/^[^\/]+\/[^\/]+$/.test(repo)) {
    console.warn('[autoDiscoverPosts] invalid repo, fallback to index.json');
    return normalizePosts(indexPosts);
  }

  const cacheMin = Math.max(1, Number(SITE.autoDiscoverCacheMinutes || 10));
  const cacheKey = `AUTO_POSTS_${repo}@${branch}/${repoSubdir}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < cacheMin * 60 * 1000) {
        return mergeBySlug(normalizePosts(data), normalizePosts(indexPosts));
      }
    }
  } catch(_) {}

  try {
    const discovered = await discoverPostsViaGitHub(repo, branch, repoSubdir);
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: discovered })); } catch(_){}
    return mergeBySlug(normalizePosts(discovered), normalizePosts(indexPosts));
  } catch (e) {
    console.warn('[autoDiscoverPosts] failed, fallback to index.json', e);
    return normalizePosts(indexPosts);
  }
}

/* ✅ 使用 git/trees API：稳定获取 {subdir}/content/posts/*.md（subdir 可为空 = 仓库根） */
async function discoverPostsViaGitHub(repo, branch = 'main', subdir = 'plus'){
  // 1) 拉取整个分支的文件树（递归）
  const treeApi = `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const r = await fetch(treeApi, { cache: 'no-store' });
  if (!r.ok) throw new Error('GitHub git/trees failed: ' + r.status);
  const j = await r.json();
  const tree = Array.isArray(j.tree) ? j.tree : [];

  // 2) 根据 subdir 计算前缀；subdir 为空时前缀就是 'content/posts/'
  const base   = (subdir || '').replace(/^\/|\/$/g, '');                // '' 或 'plus'
  const prefix = (base ? `${base}/` : '') + 'content/posts/';

  // 只保留 posts 下的 .md
  const files = tree
    .filter(n => n.type === 'blob' && n.path.startsWith(prefix) && /\.md$/i.test(n.path))
    .map(n => n.path.slice(prefix.length)); // 纯文件名：xxx.md

  // 3) 并行取 raw 内容，解析 Front-Matter（而不是一个一个顺序来）
  const tasks = files.map(async (name) => {
    const slug = name.replace(/\.md$/i,'');
    const basePart = base ? `${encodeURIComponent(base)}/` : '';
    const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${basePart}content/posts/${encodeURIComponent(name)}`;

    try{
      const res = await fetch(rawUrl, { cache: 'no-store' });
      if (!res.ok) return null;

      const md = await res.text();
      const { fm, body } = parseFrontMatter(md);

      return {
        file: name,                                  // 记录原始 md 文件名（文章页兜底用）
        slug: fm.slug || slug,
        title: fm.title || slug,
        date: fm.date || '',
        tags: Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []),
        categories: Array.isArray(fm.categories) ? fm.categories : (fm.categories ? [fm.categories] : []),
        category: fm.category || (Array.isArray(fm.categories) && fm.categories[0]) || '',
        cover: fm.cover || '/plus/images/banner-plus.jpg',
        top: !!fm.top,
        excerpt: fm.excerpt || deriveExcerptFromBody(body),
        views: fm.views || 0
      };
    }catch(_){
      return null;
    }
  });

  const posts = (await Promise.all(tasks)).filter(Boolean);
  return posts;
}


/* 规范化 post 字段；过滤无 slug 的项 */
function normalizePosts(arr){
  return (Array.isArray(arr)?arr:[])
    .map(p=>({
      file: p.file || '',   // 允许后续兜底
      slug: p.slug || '',
      title: p.title || p.slug || '',
      date: p.date || '',
      tags: Array.isArray(p.tags)? p.tags : (p.tags ? [p.tags] : []),
      categories: Array.isArray(p.categories)? p.categories : (p.categories ? [p.categories] : []),
      category: p.category || (Array.isArray(p.categories)&&p.categories[0]) || '',
      cover: p.cover || '/plus/images/banner-plus.jpg',
      top: !!p.top,
      excerpt: p.excerpt || '',
      views: p.views || 0
    }))
    .filter(p=>p.slug);
}

/* 以 slug 合并：a 覆盖 b（自动发现优先），b 兜底（index.json） */
function mergeBySlug(a,b){
  const map = new Map();
  for (const p of [...b, ...a]) {
    map.set(p.slug, { ...map.get(p.slug), ...p });
  }
  return [...map.values()];
}

/* 若没有 search.json，则用 POSTS 构建简单索引 */
function buildSearchFromPosts(posts){
  return (Array.isArray(posts)?posts:[]).map(p=>({
    slug: p.slug,
    title: p.title || '',
    excerpt: p.excerpt || '',
    tags: p.tags || []
  }));
}
/* ---------------- 搜索框：输入关键字即时过滤列表 ---------------- */
function bindSearch(){
  const input = q('#searchInput');
  const pagination = q('#pagination');

  // 页面上没有搜索框就直接退出，避免再报错
  if (!input) return;

  input.addEventListener('input', () => {
    const kw = input.value.trim().toLowerCase();

    // 关键字清空：恢复正常分页列表
    if (!kw){
      if (pagination) pagination.style.display = '';
      renderListWithPagination();
      return;
    }

    // 用关键词在 POSTS 里筛选标题 / 摘要 / 标签
    const source = Array.isArray(POSTS) ? POSTS : [];
    const matched = source.filter(p => {
      const text = `${p.title||''} ${p.excerpt||''} ${(p.tags||[]).join(' ')}`.toLowerCase();
      return text.includes(kw);
    });

    // 显示筛选结果，并隐藏分页区域
    renderList(matched);
    if (pagination) pagination.style.display = 'none';
  });
}

/* ---------------- 导航（全站一致） ---------------- */
function renderNav(){
  const ul = q('#navList');
  if(!ul) return;
  const groups = SITE.nav || [];
  if (!Array.isArray(groups) || groups.length===0){
    ul.innerHTML = '';
    return;
  }
  ul.innerHTML = groups.map(group=>{
    const items = (group.children||[])
      .map(c=>`<a href="${buildLink(c.slug)}">${esc(c.label||c.slug)}</a>`)
      .join('');
    return `<li class="nav-item">
      <a href="javascript:void(0)">${esc(group.label||'分类')}</a>
      <div class="submenu">${items}</div>
    </li>`;
  }).join('');

  qa('.nav-item', ul).forEach(li=>{
    let t; const sub = q('.submenu', li);
    li.addEventListener('mouseleave',()=>{ t=setTimeout(()=>{ if(sub) sub.style.display='none'; },200); });
    li.addEventListener('mouseenter',()=>{ clearTimeout(t); if(sub) sub.style.display='block'; });
  });
}

/* ---------------- 推荐区：置顶优先，再按日期 ---------------- */
function renderRecommend(){
  const grid = q('#recommendGrid'); if(!grid) return;
  const source = Array.isArray(POSTS) ? POSTS : [];
  if (!source.length){ grid.innerHTML = '<div style="color:#999;padding:8px 0;">（暂无推荐内容）</div>'; return; }

  const rec = [...source]
    .sort((a, b) => {
  // 置顶优先
  if (a.top && !b.top) return -1;
  if (b.top && !a.top) return 1;

  // 日期倒序（新文章在前）
  const da = new Date(a.date).getTime() || 0;
  const db = new Date(b.date).getTime() || 0;
  return db - da;
})

    .slice(0, SITE.recommendCount||4);

  grid.innerHTML = rec.map(p=>`
    <a class="rec-item" href="${buildLink(p.slug)}">
      <img src="${p.cover||'/plus/images/banner-plus.jpg'}" alt="${esc(p.title)}">
      <div>
        <div class="title">${esc(p.title)}</div>
        <div class="rec-meta">${fmtDate(p.date)} · 阅读 ${p.views??0}</div>
      </div>
    </a>`).join('');
}

/* ---------------- 列表 + 分页（单一面板式文章流） ---------------- */
function renderListWithPagination(){
  const qs = new URLSearchParams(location.search);
  const ps = Number(qs.get('page')||'1');

  const categoryFilter = (qs.get('category')||'').trim().toLowerCase();

  let pageSize = Number(SITE.pageSize||8);
  if (!Number.isFinite(pageSize)) pageSize = 8;
  pageSize = Math.min(30, Math.max(3, pageSize));

  const list = q('#articleList');
  if (list) list.classList.add('article-list');

  let source = Array.isArray(POSTS) ? POSTS : [];
  if (categoryFilter) {
    source = source.filter(p=>{
      const c1 = (p.category||'').toLowerCase();
      const cs = (Array.isArray(p.categories)?p.categories:[]).map(x=>String(x||'').toLowerCase());
      return c1===categoryFilter || cs.includes(categoryFilter);
    });
  }

  if (!source.length){
    if (list) list.innerHTML = '<div style="color:#999;">（暂无文章）</div>';
    const p = q('#pagination'); if(p) p.innerHTML='';
    return;
  }

  const sorted = [...source].sort((a, b) => {
  // 置顶优先
  if (a.top && !b.top) return -1;
  if (b.top && !a.top) return 1;

  // 日期倒序（新文章在前）
  const da = new Date(a.date).getTime() || 0;
  const db = new Date(b.date).getTime() || 0;
  return db - da;
});

  const total = Math.ceil(sorted.length / pageSize);
  const start = (ps-1)*pageSize;
  const pageItems = sorted.slice(start, start+pageSize);

  renderList(pageItems);
  renderPagination(ps,total,categoryFilter);
}

function renderList(items){
  const list = q('#articleList'); if(!list) return;
  if (!items.length){ list.innerHTML = '<div style="color:#999;">（暂无文章）</div>'; return; }

  list.innerHTML = items.map(p=>`
    <article class="article-card">
      <a class="article-thumb-link" href="${buildLink(p.slug)}" aria-label="${esc(p.title)}">
        <img class="article-thumb" src="${p.cover||'/plus/images/banner-plus.jpg'}" alt="${esc(p.title)}">
      </a>
      <div class="article-content">
        <!-- 标题 -->
        <a class="article-title" href="${buildLink(p.slug)}">${esc(p.title)}</a>
        <!-- 元信息行（放到标题下面） -->
        <div class="article-meta">
  <span class="meta-icon meta-icon-user"></span>木子-联系微信：ef98ee&nbsp;&nbsp;&nbsp;发布于 ${fmtDate(p.date)}
</div>
        <!-- 摘要 -->
        <div class="article-excerpt">${esc(p.excerpt||'')}</div>
        <!-- 标签 -->
        <div class="article-tags">
          ${(p.tags||[]).map(t=>`<a class="tag" href="${PREFIX}?q=${encodeURIComponent(t)}">${esc('#'+t)}</a>`).join('')}
        </div>
      </div>
    </article>`).join('');
}


/* 稳健分页：数字 + 省略号；总页数<=1时隐藏容器 */
function renderPagination(cur,total,categoryFilter){
  const c = q('#pagination'); if(!c) return;

  if(total<=1){ c.innerHTML=''; return; }

  const link = p => `${PREFIX}?page=${p}${categoryFilter?`&category=${encodeURIComponent(categoryFilter)}`:''}`;
  const btn  = (p,txt,cls='')=>`<a class="page-btn ${cls}" href="${link(p)}" data-page="${p}">${txt}</a>`;
  const ell  = `<span class="page-ellipsis">…</span>`;

  const pages = [];
  const add = p => { if(p>=1 && p<=total && !pages.includes(p)) pages.push(p); };
  add(1); add(2);
  for(let i=cur-2;i<=cur+2;i++) add(i);
  add(total-1); add(total);
  pages.sort((a,b)=>a-b);

  let html = '';
  html += btn(Math.max(1, cur-1), '‹', cur===1?'active-disabled':'');   // 上一页
  for(let i=0;i<pages.length;i++){
    const p = pages[i], prev = pages[i-1];
    if(i>0 && p-prev>1) html += ell;
    html += btn(p, p, p===cur?'active':'');
  }
  html += btn(Math.min(total, cur+1), '›', cur===total?'active-disabled':''); // 下一页
  c.innerHTML = html;

  qa('.page-btn', c).forEach(a=>{
    const href = a.getAttribute('href');
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      window.scrollTo(0,0);
      location.href = href;
    });
  });
}

/* ---------------- 右侧栏 ---------------- */
function renderSidebar(){
  const sidebar    = q('.sidebar');                       // 整个右侧栏容器
  const aboutBox   = q('#sideBox1') || q('#aboutBox');
  const adBox      = q('#sideBox2') || q('#adBox');
  const contactBox = q('#contactBox');

  // 1）关于本站：只保留标题 + 文案（不再塞正方形进去）
  if (aboutBox){
    aboutBox.innerHTML = `<h3>关于本站</h3><div>${SITE.sidebar?.about || '专注 ChatGPT / Sora 教程与充值引导。'}</div>`;
  }

  // 2）在“关于本站”下面，额外插入一块【正方形卡片】
  if (sidebar && !q('.sidebar-square-card', sidebar)){
    const squareCard = document.createElement('div');
    squareCard.className = 'card sidebar-square-card';
    squareCard.innerHTML = `<div class="sidebar-square"></div>`;

    // 优先插在 aboutBox 后面；如果找不到，就插在 adBox/联系卡片前面
    if (aboutBox && aboutBox.parentElement === sidebar){
      if (aboutBox.nextSibling){
        sidebar.insertBefore(squareCard, aboutBox.nextSibling);
      } else {
        sidebar.appendChild(squareCard);
      }
    } else {
      const ref = (adBox && adBox.parentElement === sidebar) ? adBox
                 : (contactBox && contactBox.parentElement === sidebar) ? contactBox
                 : null;
      if (ref){
        sidebar.insertBefore(squareCard, ref);
      } else {
        sidebar.appendChild(squareCard);
      }
    }
  }

  // 3）推广卡片（保持不变）
  if (adBox){
    const ad = SITE.sidebar?.ad || {};
    adBox.innerHTML = `<h3>${esc(ad.title||'推广')}</h3>
      <div class="ad">
        <img src="${ad.image||'/plus/images/banner-plus.jpg'}" alt="">
        <div><div>${esc(ad.title||'广告')}</div><div>${esc(ad.price||'')}</div></div>
        <a class="btn" href="${ad.buttonLink||'#'}" target="_blank">${esc(ad.buttonText||'了解更多')}</a>
      </div>`;
  }

  // 4）联系木子（保持不变）
  if (contactBox){
    const c = SITE.sidebar?.contact || {};
    contactBox.innerHTML = `<h3>${esc(c.title||'联系木子')}</h3>
      <div>微信：${esc(SITE.wechatId||'')}</div>
      <img src="${SITE.wechatQrcode||'/plus/images/qrcode-wechat.png'}" alt="微信二维码">`;
  }
}




/* ---------------- 悬浮微信按钮占位图（仅首页） ---------------- */
function renderWeChatFloat(){
  const img = q('#wfImg');
  if(img) img.src = SITE.wechatQrcode || '/plus/images/qrcode-wechat.png';
}
