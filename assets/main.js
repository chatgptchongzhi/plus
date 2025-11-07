// /plus/assets/main.js
// 首页：导航 / 推荐 / 列表（单一面板式文章流）/ 分页 / 搜索 / 右侧栏
// 新增：当 content/index.json 缺失或为空时，自动用 GitHub API 抓取 content/posts/*.md 生成列表（前端兜底）

const q  = (sel, el=document)=>el.querySelector(sel);
const qa = (sel, el=document)=>[...el.querySelectorAll(sel)];

async function getJSON(path){
  const r = await fetch(url(path), { cache: "no-store" });
  if(!r.ok) throw new Error(path+' load failed');
  return r.json();
}
function esc(s){return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}
function fmtDate(s){return s || '';}
function buildLink(slug){return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`}

let SITE={}, POSTS=[], SEARCH=[];
init().catch(e=>console.error(e));

async function init(){
  // 1) 读取站点配置
  SITE  = await getJSON('content/site.json');

  // 2) 读取文章索引，失败则自动从仓库抓取构建
  try {
    POSTS = await getJSON('content/index.json');
    if (!Array.isArray(POSTS) || POSTS.length === 0) {
      console.warn('[index.json] empty, fallback to GitHub API build');
      POSTS = await buildPostsFromRepo();
    }
  } catch (e) {
    console.warn('[index.json] not found, fallback to GitHub API build', e);
    POSTS = await buildPostsFromRepo();
  }

  // 3) 读取搜索数据（可缺省）
  try { SEARCH = await getJSON('content/search.json'); }
  catch(e){
    console.warn('[search.json] not found or invalid, fallback to build from POSTS');
    SEARCH = (POSTS||[]).map(p=>({ slug:p.slug, title:p.title, excerpt:p.excerpt||'', tags:p.tags||[] }));
  }

  // 4) 渲染
  renderNav();
  renderSidebar();
  renderWeChatFloat();
  renderRecommend();
  bindSearch();
  renderListWithPagination();

  const email = q('#siteEmail');
  if (email) email.textContent = SITE.email || '';
}

/* ============ 使用 GitHub API 的兜底构建 ============ */
/* 需要在 content/site.json 增加：
{
  "repo": { "owner": "chatgptchongzhi", "name": "plus", "branch": "main" }
}
*/
async function buildPostsFromRepo(){
  const repo = SITE.repo || {};
  const owner  = repo.owner || '';
  const name   = repo.name  || '';
  const branch = repo.branch|| 'main';

  if (!owner || !name){
    console.error('SITE.repo 缺少 owner/name，无法自动抓取 posts'); 
    return [];
  }

  const listURL = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/content/posts?ref=${encodeURIComponent(branch)}`;
  let files = [];
  try{
    const r = await fetch(listURL, { cache: "no-store" });
    if(!r.ok) throw new Error('list fetch failed');
    files = await r.json();
  }catch(e){
    console.error('拉取 posts 列表失败：', e);
    return [];
  }

  const mdFiles = Array.isArray(files) ? files.filter(f=>/\.md$/i.test(f.name)) : [];
  const rows = [];
  for (const f of mdFiles){
    const slug = f.name.replace(/\.md$/i,'');
    const rawURL = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/content/posts/${encodeURIComponent(f.name)}`;
    try{
      const r = await fetch(rawURL, { cache: "no-store" });
      if(!r.ok) continue;
      const md = await r.text();
      const { fm, body } = parseFrontMatter(md);

      const title = fm.title || slug;
      const date  = normalizeDate(fm.date || '');
      const tags  = asArray(fm.tags);
      const cats  = asArray(fm.categories || fm.category);
      const cover = fm.cover || '/plus/images/banner-plus.jpg';
      const top   = toBool(fm.top || false);
      const views = Number.isFinite(fm.views) ? fm.views : 0;
      const excerpt = (fm.excerpt ? String(fm.excerpt).trim() : stripMd(body)).slice(0,160);

      rows.push({
        slug, title, date, excerpt, tags,
        category: cats[0] || (tags[0] || 'ChatGPT'),
        cover, top, views
      });
    }catch(e){
      console.warn('拉取/解析失败：', f.name, e);
    }
  }

  // 置顶优先 + 时间倒序
  rows.sort((a,b)=>(b.top?1:0)-(a.top?1:0) || String(b.date).localeCompare(String(a.date)));
  return rows;
}

/* 轻量 Front-Matter 解析（与 article.js 兼容） */
function parseFrontMatter(mdText=''){
  const re = /^---\s*[\r\n]+([\s\S]*?)\r?\n---\s*[\r\n]*/;
  const m = mdText.match(re);
  if (!m) return { fm:{}, body: mdText };
  const raw = m[1] || '';
  const fm = {};
  raw.split(/\r?\n/).forEach(line=>{
    const idx = line.indexOf(':'); if (idx === -1) return;
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
    if (val === 'true')  { fm[key]=true;  return; }
    if (val === 'false') { fm[key]=false; return; }
    if (!Number.isNaN(Number(val)) && val.trim() !== '') { fm[key]=Number(val); return; }
    fm[key]=val;
  });
  const body = mdText.replace(re,'');
  return { fm, body };
}

function stripMd(md=''){
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[*-]\s+/gm, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function asArray(v){ if (!v) return []; return Array.isArray(v)? v : String(v).split(',').map(s=>s.trim()).filter(Boolean); }
function toBool(v){
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return !!v;
  const s = String(v).toLowerCase();
  return ['1','true','yes','y','on'].includes(s);
}
function normalizeDate(d){ if(!d) return ''; const s = String(d).slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s)? s : String(d); }

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

  // pageSize 落在 [3,30]
  let pageSize = Number(SITE.pageSize||8);
  if (!Number.isFinite(pageSize)) pageSize = 8;
  pageSize = Math.min(30, Math.max(3, pageSize));

  const source = Array.isArray(POSTS) ? POSTS : [];

  const list = q('#articleList');
  if (list) list.classList.add('article-list');

  if (!source.length){
    if (list) list.innerHTML = '<div style="color:#999;">（暂无文章或 index.json 构建中）</div>';
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
  html += btn(Math.max(1, cur-1), '‹', cur===1?'active-disabled':'');
  for(let i=0;i<pages.length;i++){
    const p = pages[i], prev = pages[i-1];
    if(i>0 && p-prev>1) html += ell;
    html += btn(p, p, p===cur?'active':'');
  }
  html += btn(Math.min(total, cur+1), '›', cur===total?'active-disabled':'');
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
