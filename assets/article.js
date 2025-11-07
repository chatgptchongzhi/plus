// /plus/assets/article.js
// 文章页：加载文章、渲染正文/目录/上下篇、面包屑（当前位置： 木子AI » 类目 » 当前文章标题）

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

let SITE={}, POSTS=[], CUR=null;

init().catch(e=>{
  console.error(e);
  const pc = q('#postContent');
  if (pc) pc.innerHTML = '<p style="color:#c00;">文章加载失败，请稍后重试。</p>';
});

async function init(){
  // 读取站点与文章索引
  SITE  = await getJSON('content/site.json');
  POSTS = await getJSON('content/index.json');

  const slug = getParam('slug');
  CUR = (POSTS||[]).find(p=> (p.slug||'') === slug);

  // 标题 / meta / 正文
  renderTitleAndMeta();
  await renderContent();

  // 目录（如果 loaded）
  renderTOC();

  // 上/下一篇
  renderPrevNext();

  // 面包屑（当前位置： 木子AI » 类目 » 当前文章标题）
  renderBreadcrumb();
}

/* ---------------- 面包屑 ---------------- */
function renderBreadcrumb(){
  const el = q('#breadcrumb'); if(!el) return;

  const siteName = SITE.title || '木子AI';
  const homeHref = `${PREFIX}`;
  // 优先取文章 category，其次 section / categories[0]，再无则默认 ChatGPT
  const cat = (CUR && (CUR.category || CUR.section || (Array.isArray(CUR.categories)&&CUR.categories[0]))) || 'ChatGPT';

  // 当前文章标题
  const title = CUR ? (CUR.title || CUR.slug || '') : document.title;

  el.innerHTML = `
    <span style="color:#888">当前位置：</span>
    <a href="${homeHref}">${esc(siteName)}</a>
    <span> » </span>
    <span>${esc(cat)}</span>
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

/* ---------------- 正文渲染 ---------------- */
async function renderContent(){
  const box = q('#postContent'); if(!box) return;

  if (!CUR){
    box.innerHTML = '<p style="color:#999;">没有找到对应文章。</p>';
    return;
  }

  // 优先从 /content/posts/${slug}.md 读取；如果索引里内嵌 body，也可直接使用
  const mdPath = `content/posts/${CUR.slug}.md`;
  let md = '';
  try{
    const r = await fetch(url(mdPath));
    if(r.ok) md = await r.text();
  }catch(_){/* 忽略 */}

  if(!md && CUR.body) md = CUR.body;

  // 使用 marked 渲染（存在则用，不在也不报错）
  if (window.marked){
    box.innerHTML = window.marked.parse(md || '');
  }else{
    box.textContent = md || '';
  }
}

/* ---------------- 目录（tocbot） ---------------- */
function renderTOC(){
  const tocEl = q('#toc');
  const box = q('#postContent');
  if(!tocEl || !box) return;

  if (window.tocbot){
    try{
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

  // 用 index.json 的排序（置顶优先 + 时间倒序）找到当前索引位置
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
