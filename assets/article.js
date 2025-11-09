// /plus/assets/article.js
// 文章页：加载文章、解析 Front-Matter、渲染导航/正文/目录/上下篇、可点击面包屑
// 新增：优先使用首页传来的 CUR.file（原始 md 文件名）兜底；若无/失败，再扫描目录按文件名或 FM.slug 匹配。

const q  = (sel, el=document)=>el.querySelector(sel);
const qa = (sel, el=document)=>[...el.querySelectorAll(sel)];
function getParam(k){ return new URLSearchParams(location.search).get(k)||''; }
function esc(s){ return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function fmtDate(s){ return s || ''; }
function buildLink(slug){ return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`; }

async function getJSON(path){
  const r = await fetch(url(path), { cache: 'no-store' });
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
  SITE  = await getJSON('content/site.json').catch(()=>({}));
  POSTS = await getJSON('content/index.json').catch(()=>([]));

  // 渲染导航
  renderNav();

  const slug = getParam('slug');
  CUR = (POSTS||[]).find(p=> (p.slug||'') === slug) || { slug };

  renderTitleAndMeta();
  await renderContent();   // ← 内含 file 优先兜底
  renderTOC();
  renderPrevNext();
  renderBreadcrumb();

  const emailEl = q('#siteEmail');
  if (emailEl) emailEl.textContent = SITE.email || '';
}

/* ---------------- 导航（与首页保持一致） ---------------- */
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

/* ---------------- 面包屑 ---------------- */
function renderBreadcrumb(){
  const el = q('#breadcrumb'); if(!el) return;
  const siteName = SITE.title || SITE.siteTitle || '木子AI';
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

/* ---------------- 正文渲染（优先使用 CUR.file 兜底；再目录扫描） ---------------- */
async function renderContent(){
  const box = q('#postContent'); if(!box) return;

  if (!CUR){
    box.innerHTML = '<p style="color:#999;">没有找到对应文章。</p>'; return;
  }

  const slug = CUR.slug;
  const file = CUR.file && String(CUR.file); // ★ main.js 自动发现时附带的原始 md 文件名
  let md = '';

  // 1) 本地：按 slug 读取 /plus/content/posts/${slug}.md
  try{
    const r = await fetch(url(`content/posts/${slug}.md`), { cache: 'no-store' });
    if(r.ok) md = await r.text();
  }catch(_){}

  // 2) 若有 CUR.file，则本地按原始文件名再试一次
  if(!md && file){
    try{
      const r = await fetch(url(`content/posts/${file}`), { cache: 'no-store' });
      if(r.ok) md = await r.text();
    }catch(_){}
  }

  // 3) 远端 raw（按 slug）
  if(!md){
    try{
      const repo   = SITE.repo   || '';
      const branch = SITE.branch || 'main';
      const repoSubdir = (SITE.repoSubdir || String(typeof PREFIX==='string'?PREFIX:'/plus/')).replace(/^\/|\/$/g,'');
      if (/^[^\/]+\/[^\/]+$/.test(repo) && repoSubdir){
        const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${encodeURIComponent(repoSubdir)}/content/posts/${encodeURIComponent(slug)}.md?ts=${Date.now()}`;
        const r2 = await fetch(rawUrl, { cache: 'no-store' });
        if(r2.ok) md = await r2.text();
      }
    }catch(_){}
  }

  // 4) 若有 CUR.file，则远端 raw 再按原始文件名尝试一次
  if(!md && file){
    try{
      const repo   = SITE.repo   || '';
      const branch = SITE.branch || 'main';
      const repoSubdir = (SITE.repoSubdir || String(typeof PREFIX==='string'?PREFIX:'/plus/')).replace(/^\/|\/$/g,'');
      if (/^[^\/]+\/[^\/]+$/.test(repo) && repoSubdir){
        const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${encodeURIComponent(repoSubdir)}/content/posts/${encodeURIComponent(file)}?ts=${Date.now()}`;
        const r2b = await fetch(rawUrl, { cache: 'no-store' });
        if(r2b.ok) md = await r2b.text();
      }
    }catch(_){}
  }

  // 5) 仍无：目录扫描（匹配文件名或 FM.slug）
  if(!md){
    try{
      const repo   = SITE.repo   || '';
      const branch = SITE.branch || 'main';
      const repoSubdir = (SITE.repoSubdir || String(typeof PREFIX==='string'?PREFIX:'/plus/')).replace(/^\/|\/$/g,'');
      if (/^[^\/]+\/[^\/]+$/.test(repo) && repoSubdir){
        const dirApi = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(repoSubdir)}/content/posts?ref=${encodeURIComponent(branch)}&ts=${Date.now()}`;
        const listRes = await fetch(dirApi, { cache: 'no-store' });
        if (listRes.ok){
          const list = await listRes.json();
          const mdFiles = (Array.isArray(list)?list:[]).filter(it=>/\.md$/i.test(it.name));

          // 优先直接名字等于 slug 的
          let hit = mdFiles.find(f=> f.name.replace(/\.md$/i,'') === slug);

          // 否则抽样读头部找 FM.slug
          if (!hit){
            for (const f of mdFiles){
              try{
                const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${encodeURIComponent(repoSubdir)}/content/posts/${encodeURIComponent(f.name)}?ts=${Date.now()}`;
                const r3 = await fetch(rawUrl, { cache: 'no-store' });
                if(!r3.ok) continue;
                const text = await r3.text();
                const { fm } = parseFrontMatter(text);
                const fmSlug = (fm && (fm.slug||'')).toString().trim();
                if (fmSlug && fmSlug === slug){
                  hit = f; md = text; break;
                }
              }catch(_){}
            }
          }

          // 命中文件名但还没拿到正文，再读一次
          if (hit && !md){
            const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${encodeURIComponent(repoSubdir)}/content/posts/${encodeURIComponent(hit.name)}?ts=${Date.now()}`;
            const r4 = await fetch(rawUrl, { cache: 'no-store' });
            if(r4.ok) md = await r4.text();
          }
        }
      }
    }catch(e){
      console.warn('[article] fallback by original filename failed:', e);
    }
  }

  // 6) 渲染
  const parsed = parseFrontMatter(md||'');
  if (parsed && parsed.fm && Object.keys(parsed.fm).length){
    const fm = parsed.fm;
    if (fm.title) CUR.title = fm.title;
    if (fm.date)  CUR.date  = fm.date;
    if (fm.tags)  CUR.tags  = Array.isArray(fm.tags)? fm.tags : [fm.tags];
    if (fm.categories) CUR.categories = Array.isArray(fm.categories)? fm.categories : [fm.categories];
    if (fm.category)   CUR.category   = fm.category;
    if (fm.cover) CUR.cover = fm.cover;
    if (typeof fm.top !== 'undefined') CUR.top = fm.top;
    if (fm.excerpt && !CUR.excerpt) CUR.excerpt = fm.excerpt;
  }
  const body = parsed ? parsed.body : (md||'');

  if (window.marked){
    box.innerHTML = window.marked.parse(body || '');
  }else{
    box.textContent = body || '';
  }
  if (window.marked){
    box.innerHTML = window.marked.parse(body || '');
  }else{
    box.textContent = body || '';
  }

  // ★ 这里新加一行：重新渲染标题和 meta
  renderTitleAndMeta();

  // 标签
  const tags = CUR.tags || CUR.tag || [];

  // 标签
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
