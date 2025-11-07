// /plus/assets/main.js
// 首页：导航 / 推荐 / 列表（单一面板式文章流）/ 分页 / 搜索 / 右侧栏
// 新增：可选“自动发现 posts”（GitHub API 扫描 content/posts/*.md），落盘缓存 + 回退到 index.json。

/* ---------------- 工具 ---------------- */
const q  = (sel, el=document)=>el.querySelector(sel);
const qa = (sel, el=document)=>[...el.querySelectorAll(sel)];

async function getJSON(path){
  const r = await fetch(url(path));
  if(!r.ok) throw new Error(path+' load failed');
  return r.json();
}
function esc(s){return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}
function fmtDate(s){return s || '';}
function buildLink(slug){return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`}

/* Front-Matter 解析：返回 { fm, body } */
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

    // 去掉首尾引号
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    // 数组形式 [a, b]
    if (/^\[.*\]$/.test(val)) {
      fm[key] = val.replace(/^\[/,'').replace(/\]$/,'')
        .split(',').map(s=>s.trim().replace(/^['"]|['"]$/g,'')).filter(Boolean);
      return;
    }
    // 逗号分隔 a, b
    if (val.includes(',') && (key==='tags' || key==='categories')) {
      fm[key] = val.split(',').map(s=>s.trim()).filter(Boolean);
      return;
    }
    // 布尔/数字
    if (val === 'true')  { fm[key]=true;  return; }
    if (val === 'false') { fm[key]=false; return; }
    if (!Number.isNaN(Number(val)) && val.trim() !== '') {
      fm[key] = Number(val);
      return;
    }
    fm[key] = val;
  });

  const body = mdText.replace(re, ''); // 移除头部
  return { fm, body };
}

/* 从 markdown 推断 excerpt（若无 fm.excerpt） */
function deriveExcerptFromBody(body){
  if (!body) return '';
  // 找第一段非空文本，去掉 Markdown 语法痕迹
  const p = body.split(/\n{2,}/).map(s=>s.trim()).find(s=>s && !/^#{1,6}\s+/.test(s));
  if (!p) return '';
  return p
    .replace(/!\[[^\]]*\]\([^)]+\)/g,'')      // 图片
    .replace(/\[[^\]]*\]\([^)]+\)/g,(m)=>m.replace(/\[|\]|\([^)]+\)/g,'')) // 链接文本
    .replace(/`{1,3}[^`]+`{1,3}/g,'')         // 行内代码
    .replace(/[*_~>#-]+/g,'')                 // 简单清理
    .slice(0,140);
}

/* ---------------- 全局状态 ---------------- */
let SITE={}, POSTS=[], SEARCH=[];

init().catch(e=>console.error(e));

/* ---------------- 入口 ---------------- */
async function init(){
  // 1) 读取站点配置
  SITE  = await getJSON('content/site.json').catch(()=>({}));
  const email = q('#siteEmail'); if (email) email.textContent = SITE.email || '';

  // 2) 文章来源：优先 index.json；若 SITE.autoDiscoverPosts 则尝试 GitHub API 自动发现
  POSTS = await loadPosts();

  // 3) 搜索索引：优先 search.json；缺失则由 POSTS 生成
  try {
    SEARCH = await getJSON('content/search.json');
  } catch (e) {
    SEARCH = buildSearchFromPosts(POSTS);
  }

  // 4) 渲染
  renderNav();
  renderSidebar();
  renderWeChatFloat();
  renderRecommend();
  bindSearch();
  renderListWithPagination();
}

/* ---------------- 加载文章：index.json + 可选自动发现 ---------------- */
async function loadPosts(){
  let indexPosts = [];
  // 先尝试 index.json（即使后面要自动发现，也可用于兜底/去重）
  try {
    indexPosts = await getJSON('content/index.json');
  } catch (_) {
    indexPosts = [];
  }

  // 如果未开启自动发现，直接用 index.json
  if (!SITE.autoDiscoverPosts) {
    return normalizePosts(indexPosts);
  }

  // 自动发现（GitHub API 扫描）
  const repo   = SITE.repo   || '';     // e.g. "chatgptchongzhi/plus"
  const branch = SITE.branch || 'main';
  if (!/^[^\/]+\/[^\/]+$/.test(repo)) {
    console.warn('[autoDiscoverPosts] invalid repo, fallback to index.json');
    return normalizePosts(indexPosts);
  }

  // 读取缓存
  const cacheMin = Math.max(1, Number(SITE.autoDiscoverCacheMinutes || 10));
  const cacheKey = `AUTO_POSTS_${repo}@${branch}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < cacheMin * 60 * 1000) {
        // 合并 index.json + 缓存（以 slug 去重，自动发现优先）
        return mergeBySlug(normalizePosts(data), normalizePosts(indexPosts));
      }
    }
  } catch(_) {}

  // 真正扫描目录
  try {
    const discovered = await discoverPostsViaGitHub(repo, branch);
    // 写缓存
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: discovered })); } catch(_){}
    // 合并并返回
    return mergeBySlug(normalizePosts(discovered), normalizePosts(indexPosts));
  } catch (e) {
    console.warn('[autoDiscoverPosts] failed, fallback to index.json', e);
    return normalizePosts(indexPosts);
  }
}

/* GitHub API 扫描 content/posts 目录，解析每篇 md 的 FM */
async function discoverPostsViaGitHub(repo, branch='main'){
  const dirApi = `https://api.github.com/repos/${repo}/contents/content/posts?ref=${encodeURIComponent(branch)}`;
  const listRes = await fetch(dirApi);
  if (!listRes.ok) throw new Error('GitHub API list failed: '+listRes.status);
  const list = await listRes.json();
  const files = (Array.isArray(list)?list:[]).filter(it=>/\.md$/i.test(it.name));

  const posts = [];
  // 逐篇取 raw 内容
  for (const f of files){
    const name = f.name;                       // e.g. aaa-bbb.md
    const slug = name.replace(/\.md$/i,'');    // 默认 slug
    const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/content/posts/${encodeURIComponent(name)}`;
    try{
      const res = await fetch(rawUrl);
      if (!res.ok) continue;
      const md = await res.text();
      const { fm, body } = parseFrontMatter(md);

      const p = {
        slug: fm.slug || slug,
        title: fm.title || slug,
        date: fm.date || '',
        tags: Array.isArray(fm.tags)? fm.tags : (fm.tags ? [fm.tags] : []),
        categories: Array.isArray(fm.categories)? fm.categories : (fm.categories ? [fm.categories] : []),
        category: fm.category || (Array.isArray(fm.categories)&&fm.categories[0]) || '',
        cover: fm.cover || '/plus/images/banner-plus.jpg',
        top: !!fm.top,
        excerpt: fm.excerpt || deriveExcerptFromBody(body),
        views: fm.views || 0
      };
      posts.push(p);
    }catch(_){}
  }
  return posts;
}

/* 规范化 post 字段；过滤无 slug 的项 */
function normalizePosts(arr){
  return (Array.isArray(arr)?arr:[])
    .map(p=>({
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

/* 以 slug 合并：a 优先，b 兜底 */
function mergeBySlug(a,b){
  const map = new Map();
  for (const p of [...b, ...a]) { // 让 a 覆盖 b
    map.set(p.slug, { ...map.get(p.slug), ...p });
  }
  return [...map.values()];
}

/* 若没有 search.json，则用 POSTS 构建简单搜索索引 */
function buildSearchFromPosts(posts){
  return (Array.isArray(posts)?posts:[]).map(p=>({
    slug: p.slug,
    title: p.title || '',
    excerpt: p.excerpt || '',
    tags: p.tags || []
  }));
}

/* ---------------- 导航 ---------------- */
function renderNav(){
  const ul = q('#navList');
  if(!ul) return;
  ul.innerHTML = (SITE.nav||[]).map(group=>{
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
    .sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''))
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

  // 允许按分类过滤（来自面包屑点击）
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

  const sorted = [...source].sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));
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
        <a class="article-title" href="${buildLink(p.slug)}">${esc(p.title)}</a>
        <div class="article-excerpt">${esc(p.excerpt||'')}</div>
        <div class="article-meta"><span>${fmtDate(p.date)}</span><span>阅读 ${p.views??0}</span></div>
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

  // 点击先回顶，再跳转，避免二页初始就显示“回到顶部”
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
  const aboutBox   = q('#aboutBox');
  const adBox      = q('#adBox');
  const contactBox = q('#contactBox');

  if (aboutBox){
    aboutBox.innerHTML = `<h3>关于本站</h3><div>${SITE.sidebar?.about || '专注 ChatGPT / Sora 教程与充值引导。'}</div>`;
  }
  if (adBox){
    const ad = SITE.sidebar?.ad || {};
    adBox.innerHTML = `<h3>${esc(ad.title||'推广')}</h3>
      <div class="ad">
        <img src="${ad.image||'/plus/images/banner-plus.jpg'}" alt="">
        <div><div>${esc(ad.title||'广告')}</div><div>${esc(ad.price||'')}</div></div>
        <a class="btn" href="${ad.buttonLink||'#'}" target="_blank">${esc(ad.buttonText||'了解更多')}</a>
      </div>`;
  }
  if (contactBox){
    const c = SITE.sidebar?.contact || {};
    contactBox.innerHTML = `<h3>${esc(c.title||'联系木子')}</h3>
      <div>微信：${esc(SITE.wechatId||'')}</div>
      <img src="${SITE.wechatQrcode||'/plus/images/qrcode-wechat.png'}" alt="微信二维码">`;
  }
}

/* ---------------- 搜索：输入时即时过滤 ---------------- */
function bindSearch(){
  const i = q('#searchInput'); if(!i) return;
  let timer=null;
  i.addEventListener('input', e=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      const kw = (e.target.value||'').trim().toLowerCase();
      if(!kw){
        renderListWithPagination();
        return;
      }
      const pool = (SEARCH && SEARCH.length)? SEARCH : buildSearchFromPosts(POSTS);
      const res = pool.filter(s=>
        (s.title||'').toLowerCase().includes(kw) ||
        (s.excerpt||'').toLowerCase().includes(kw) ||
        (s.tags||[]).some(t=>String(t).toLowerCase().includes(kw))
      ).map(s=>POSTS.find(p=>p.slug===s.slug)).filter(Boolean);

      renderList(res);
      const p = q('#pagination'); if(p) p.innerHTML='';  // 搜索时隐藏分页
    }, 300);
  });
}

/* ---------------- 悬浮微信按钮占位图（仅首页） ---------------- */
function renderWeChatFloat(){
  const img = q('#wfImg');
  if(img) img.src = SITE.wechatQrcode || '/plus/images/qrcode-wechat.png';
}
