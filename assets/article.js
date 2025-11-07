// /plus/assets/article.js
// 文章页：加载文章、解析 Front-Matter、渲染正文/目录/上下篇、可点击面包屑
// ★ 本版新增：渲染顶部主菜单（#navList），配合 CSS 的 .navbar{position:fixed}，确保首页与文章页导航始终固定在顶部且显示文字

const q  = (sel, el=document)=>el.querySelector(sel);
const qa = (sel, el=document)=>[...el.querySelectorAll(sel)];
function getParam(k){ return new URLSearchParams(location.search).get(k)||''; }
function esc(s){ return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function fmtDate(s){ return s || ''; }
function buildLink(slug){ return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`; }

async function getJSON(path){
  const r = await fetch(url(path));
  if(!r.ok) throw new Error('load failed: '+path);
  return r.json();
}

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
    if (val === 'true') { fm[key]=true; return; }
    if (val === 'false'){ fm[key]=false; return; }
    if (!Number.isNaN(Number(val)) && val.trim() !== '') { fm[key] = Number(val); return; }
    fm[key] = val;
  });

  const body = mdText.replace(re, '');
  return { fm, body };
}

let SITE={}, POSTS=[], CUR=null;

init().catch(e=>{
  console.error(e);
  const pc = q('#postContent');
  if (pc) pc.innerHTML = '<p style="color:#c00;">文章加载失败，请稍后重试。</p>';
});

async function init(){
  SITE  = await getJSON('content/site.json');
  POSTS = await getJSON('content/index.json');

  // 渲染顶部主菜单（确保文章页导航有文字）
  renderNav();

  // 顶部搜索框（文章页用的是 #searchJump）
  bindSearchJump();

  // 页脚邮箱
  const emailEl = q('#siteEmail');
  if (emailEl) emailEl.textContent = SITE.email || '';

  const slug = getParam('slug');
  CUR = (POSTS||[]).find(p=> (p.slug||'') === slug);

  renderTitleAndMeta();
  await renderContent();     // 解析 FM 并合并 CUR
  renderTOC();
  renderPrevNext();
  renderBreadcrumb();
}

/* ---------------- 顶部主菜单（与首页一致的渲染逻辑） ---------------- */
function renderNav(){
  const ul = q('#navList');
  if(!ul) return;

  const nav = Array.isArray(SITE.nav) ? SITE.nav : [];
  if (!nav.length){
    ul.innerHTML = ''; // 无数据则留空，避免占位的空 li
    return;
  }

  ul.innerHTML = nav.map(group=>{
    const items = (group.children||[])
      .map(c=>`<a href="${buildLink(c.slug)}">${esc(c.label||c.slug)}</a>`)
      .join('');
    return `<li class="nav-item">
      <a href="javascript:void(0)">${esc(group.label||'分类')}</a>
      <div class="submenu">${items}</div>
    </li>`;
  }).join('');

  // 防闪退的悬停展开
  qa('.nav-item', ul).forEach(li=>{
    let t; const sub = q('.submenu', li);
    li.addEventListener('mouseleave',()=>{ t=setTimeout(()=>{ if(sub) sub.style.display='none'; },200); });
    li.addEventListener('mouseenter',()=>{ clearTimeout(t); if(sub) sub.style.display='block'; });
  });
}

/* ---------------- 顶部搜索（文章页的 input#searchJump） ---------------- */
function bindSearchJump(){
  const i = q('#searchJump');
  if(!i) return;
  i.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
      const kw = (i.value||'').trim();
      // 跳回首页并携带搜索词（首页 main.js 会即时过滤）
      location.href = `${PREFIX}?q=${encodeURIComponent(kw)}`;
    }
  });
}

/* ---------------- 面包屑（分类可点击过滤首页） ---------------- */
function renderBreadcrumb(){
  const el = q('#breadcrumb'); if(!el) return;

  const siteName = SITE.title || '木子AI';
  const homeHref = `${PREFIX}`;

  const cat = (()=>{
    if (!CUR) return 'ChatGPT';
    if (CUR.category) return CUR.category;
    if (Array.isArray(CUR.categories) && CUR.categories.length) return CUR.categories[0];
    if (CUR.section) return CUR.section;
    if (Array.isArray(CUR.tags) && CUR.tags.length) return CUR.tags[0];
    return 'ChatGPT';
  })();

  const title = CUR ? (CUR.title || CUR.slug || '') : document.title;

  el.innerHTML = `
    <span style="color:#888">当前位置：</span>
    <a href="${homeHref}">${esc(siteName)}</a>
    <span> » </span>
    <a href="${PREFIX}?category=${encodeURIComponent(cat)}">${esc(cat)}</a>
    <span> » </span>
    <span>${esc(title)}</span>
  `;
}

/* ---------------- 标题 + Meta ---------------- */
function renderTitleAndMeta(){
  const h1 = q('#postTitle');
  const meta = q('#metaBar');
  if (!CUR){
    if (h1) h1.textContent = '文章未找到';
    if (meta) meta.textContent = '';
    return;
  }
  if (h1) h1.textContent = CUR.title || CUR.slug || '';
  if (meta){
    const left = `<span>${fmtDate(CUR.date)}</span>`;
    const right = `<span>阅读 ${CUR.views ?? 0}</span>`;
    meta.innerHTML = `<div>${left}</div><div>${right}</div>`;
  }
}

/* ---------------- 正文渲染 + 标签展示 ---------------- */
async function renderContent(){
  const box = q('#postContent'); if(!box) return;

  let md = '';
  if (!CUR){
    box.innerHTML = '<p style="color:#999;">没有找到对应文章。</p>'; return;
  }
  const mdPath = `content/posts/${CUR.slug}.md`;
  try{
    const r = await fetch(url(mdPath));
    if(r.ok) md = await r.text();
  }catch(_){}

  if(!md && CUR.body) md = CUR.body;

  const parsed = parseFrontMatter(md);
  if (parsed && parsed.fm && Object.keys(parsed.fm).length){
    const fm = parsed.fm;
    if (fm.title) CUR.title = fm.title;
    if (fm.date)  CUR.date  = fm.date;
    if (fm.tags)  CUR.tags  = Array.isArray(fm.tags)? fm.tags : [fm.tags];
    if (fm.categories) CUR.categories = Array.isArray(fm.categories)? fm.categories : [fm.categories];
    if (fm.category)   CUR.category   = fm.category;
    if (fm.cover) CUR.cover = fm.cover;
    if (typeof fm.top !== 'undefined') CUR.top = fm.top;
  }
  const body = parsed ? parsed.body : md;

  if (window.marked){
    box.innerHTML = window.marked.parse(body || '');
  }else{
    box.textContent = body || '';
  }

  // 正文下方：标签 pills
  const tags = CUR.tags || CUR.tag || [];
  const wrapId = 'postTagsWrap';
  let wrap = document.getElementById(wrapId);
  if (!wrap){
    wrap = document.createElement('div');
    wrap.id = wrapId;
    wrap.className = 'article-tags';
    wrap.style.marginTop = '16px';
    box.insertAdjacentElement('afterend', wrap);
  }
  wrap.innerHTML = (Array.isArray(tags) && tags.length)
    ? tags.map(t=>`<a class="tag" href="${PREFIX}?q=${encodeURIComponent(t)}">${esc('#'+t)}</a>`).join('')
    : '';
}

/* ---------------- 目录（tocbot） ---------------- */
function renderTOC(){
  const tocEl = q('#toc');
  const box = q('#postContent');
  if(!tocEl || !box) return;

  if (window.tocbot){
    try{
      window.tocbot.destroy?.();
      window.tocbot.init({
        tocSelector: '#toc',
        contentSelector: '#postContent',
        headingSelector: 'h1, h2, h3',
        collapseDepth: 6,
        hasInnerContainers: false
      });
    }catch(e){ console.warn('tocbot init failed', e); }
  }
}

/* ---------------- 上一篇 / 下一篇 ---------------- */
function renderPrevNext(){
  const nav = q('#postNav'); if(!nav) return;
  if(!CUR){ nav.innerHTML=''; return; }

  const sorted = [...POSTS].sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));
  const i = sorted.findIndex(p=>p.slug===CUR.slug);
  const prev = i>0 ? sorted[i-1] : null;
  const next = i<sorted.length-1 ? sorted[i+1] : null;

  nav.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;margin-top:16px">
      <div>${prev?`上一篇：<a href="${buildLink(prev.slug)}">${esc(prev.title)}</a>`:''}</div>
      <div>${next?`下一篇：<a href="${buildLink(next.slug)}">${esc(next.title)}</a>`:''}</div>
    </div>
  `;
}
