// /plus/assets/main.js
// 首页：导航 / 推荐 / 列表（单一面板式文章流）/ 分页 / 搜索 / 右侧栏
// 额外：当 index.json 未覆盖新文章时，自动从 GitHub API 扫描 /plus/content/posts/*.md
//       解析 Front-Matter 动态补全，做到“只增一篇 .md 就能出现在首页”。

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

// 解析 Markdown 顶部 Front-Matter，返回 {fm, body}
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
      fm[key] = val.replace(/^\[/,'').replace(/\]$/,'').split(',').map(s=>s.trim().replace(/^['"]|['"]$/g,'')).filter(Boolean);
      return;
    }
    if (val.includes(',') && (key==='tags' || key==='categories')) {
      fm[key] = val.split(',').map(s=>s.trim()).filter(Boolean);
      return;
    }
    if (val === 'true')  { fm[key]=true; return; }
    if (val === 'false') { fm[key]=false; return; }
    if (!Number.isNaN(Number(val)) && val.trim() !== '') { fm[key]=Number(val); return; }
    fm[key] = val;
  });
  const body = mdText.replace(re, '');
  return { fm, body };
}

// —— 自动发现 posts：从 GitHub API 列出 /plus/content/posts/*.md 并解析 FM ——
// 说明：无需 token，受未登录 API 频率限制（约 60 次/小时/源 IP）；适合你的站点规模。
// 如需更高频或更快速度，后续可以加一个 GitHub Actions 生成 index.json 的方案（可选）。
async function discoverPostsFromGitHub(){
  try{
    // 从当前 URL 推断 owner 和 repo，以及 posts 目录相对路径
    // 你的仓库结构是 repo 根目录里有一个 "plus/" 文件夹，所以 API 目录为 "plus/content/posts"
    const owner = (location.hostname.split('.')[0] || '').toLowerCase();
    // e.g. /plus/xxxx  → 第一段是 "plus"
    const firstSeg = (location.pathname.split('/').filter(Boolean)[0] || 'plus');
    const repo = owner ? 'plus' : ''; // 如果是 username.github.io 项目站，repo 往往是项目名；本例已知为 plus
    // 当用自定义域名或本地预览时，owner 推断可能为空，退化到显式路径方案
    const repoPath = 'plus'; // 你的代码仓库根下确实有 plus 目录
    const apiOwner = owner || 'chatgptchongzhi'; // 兜底：你的实际 owner（可改成你自己的）
    const apiRepo  = repo || 'plus';

    // 列出目录文件
    const listUrl = `https://api.github.com/repos/${apiOwner}/${apiRepo}/contents/${repoPath}/content/posts?ref=main`;
    const listRes = await fetch(listUrl, { headers: { 'Accept': 'application/vnd.github+json' }});
    if(!listRes.ok) throw new Error('GitHub API list failed');
    const files = await listRes.json();
    const mdfiles = (Array.isArray(files)?files:[]).filter(f=>/\.md$/i.test(f.name));

    // 逐个读取原文（raw）以解析 Front-Matter
    const results = [];
    for(const f of mdfiles){
      const slug = f.name.replace(/\.md$/i,'');
      // raw 内容直链（主分支 main）
      const rawUrl = `https://raw.githubusercontent.com/${apiOwner}/${apiRepo}/main/${repoPath}/content/posts/${encodeURIComponent(f.name)}`;
      const r = await fetch(rawUrl);
      if(!r.ok) continue;
      const md = await r.text();
      const { fm } = parseFrontMatter(md);
      results.push({
        slug,
        title: fm.title || slug,
        date:  fm.date  || '',
        excerpt: fm.excerpt || fm.description || '',
        tags: Array.isArray(fm.tags)? fm.tags : (fm.tags ? [fm.tags] : []),
        cover: fm.cover || '/plus/images/banner-plus.jpg',
        top:   typeof fm.top==='boolean' ? fm.top : false,
        views: 0
      });
    }
    return results;
  }catch(e){
    console.warn('discoverPostsFromGitHub() failed:', e);
    return [];
  }
}

let SITE={}, POSTS=[], SEARCH=[];
init().catch(e=>console.error(e));

async function init(){
  // 基础数据
  SITE  = await getJSON('content/site.json');
  // 先尝试从 index.json 读取
  let idx = [];
  try{
    const raw = await getJSON('content/index.json');
    idx = Array.isArray(raw) ? raw : Array.isArray(raw.posts) ? raw.posts : [];
  }catch(_){ idx = []; }

  // 自动补全：把 GitHub API 扫描到的文章，与 index.json 做“去重合并”
  let auto = await discoverPostsFromGitHub();
  if (idx.length === 0 && auto.length === 0){
    // 再尝试旧路径（兼容老结构）
    try{
      const raw = await getJSON('content/data/index.json');
      idx = Array.isArray(raw) ? raw : Array.isArray(raw.posts) ? raw.posts : [];
    }catch(_){}
  }
  // 合并（以 index.json 为准，自动发现补充缺失的 slug）
  const map = new Map();
  [...idx, ...auto].forEach(p=>{
    if(!p || !p.slug) return;
    if(!map.has(p.slug)) map.set(p.slug, p);
  });
  POSTS = [...map.values()];

  // search.json 容错
  try { SEARCH = await getJSON('content/search.json'); }
  catch(e){ console.warn('[search.json] not found or invalid, fallback to []'); SEARCH=[]; }

  // 渲染
  renderNav();
  renderSidebar();
  renderWeChatFloat();
  renderRecommend();
  bindSearch();
  renderListWithPagination();

  const email = q('#siteEmail');
  if (email) email.textContent = SITE.email || '';
}

/* ============ 导航 ============ */
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

/* ============ 推荐区 ============ */
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

/* ============ 列表 + 分页（单一面板式文章流） ============ */
function renderListWithPagination(){
  const ps = Number(new URLSearchParams(location.search).get('page')||'1');
  let pageSize = Number(SITE.pageSize||8);
  if (!Number.isFinite(pageSize)) pageSize = 8;
  pageSize = Math.min(30, Math.max(3, pageSize));

  const source = Array.isArray(POSTS) ? POSTS : [];

  const list = q('#articleList');
  if (list) list.classList.add('article-list');

  if (!source.length){
    if (list) list.innerHTML = '<div style="color:#999;">（暂无文章或 index.json / GitHub API 加载失败）</div>';
    const p = q('#pagination'); if(p) p.innerHTML='';
    return;
  }

  const sorted = [...source].sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));
  const total = Math.ceil(sorted.length / pageSize);
  const start = (ps-1)*pageSize;
  const pageItems = sorted.slice(start, start+pageSize);

  renderList(pageItems);
  renderPagination(ps,total);
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

/* —— 稳健分页：数字 + 省略号；总页数<=1时隐藏容器 —— */
function renderPagination(cur,total){
  const c = q('#pagination'); if(!c) return;

  if(total<=1){ c.innerHTML=''; return; }

  const link = p => `${PREFIX}?page=${p}`;
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

/* ============ 右侧栏 ============ */
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

/* ============ 搜索 ============ */
function bindSearch(){
  const i = q('#searchInput'); if(!i) return;
  let timer=null;
  i.addEventListener('input', e=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      const kw = (e.target.value||'').trim().toLowerCase();
      if(!kw){ renderListWithPagination(); return; }
      const res = (SEARCH||[]).filter(s=>
        (s.title||'').toLowerCase().includes(kw) ||
        (s.excerpt||'').toLowerCase().includes(kw) ||
        (s.tags||[]).some(t=>t.toLowerCase().includes(kw))
      ).map(s=>POSTS.find(p=>p.slug===s.slug)).filter(Boolean);
      renderList(res);
      const p = q('#pagination'); if(p) p.innerHTML='';  // 搜索时隐藏分页
    }, 300);
  });
}

/* ============ 悬浮微信按钮占位图（仅首页） ============ */
function renderWeChatFloat(){
  const img = q('#wfImg');
  if(img) img.src = SITE.wechatQrcode || '/plus/images/qrcode-wechat.png';
}
