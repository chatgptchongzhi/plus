// 文章页：加载 MD、渲染 TOC、Breadcrumb、Meta、上下篇
const q = (s,el=document)=>el.querySelector(s);
async function getJSON(p){ const r=await fetch(url(p)); if(!r.ok) throw new Error(p); return r.json(); }
function getParam(k){return new URLSearchParams(location.search).get(k)||''}
function esc(s){return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function buildLink(slug){return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`}

let SITE={}, POSTS=[];
init().catch(console.error);

async function init(){
  SITE = await getJSON('content/site.json');
  POSTS = await getJSON('content/index.json');
  renderNav();

  const slug = getParam('slug');
  if(!slug){ q('#postContent').innerHTML='<p>缺少 slug 参数。</p>'; return; }

  // 读取 MD
  const res = await fetch(url(`content/posts/${slug}.md`));
  if(!res.ok){ q('#postContent').innerHTML='<p>文章不存在或已删除。</p>'; return; }
  const md = await res.text();

  const fm = parseFrontMatter(md);
  const html = (window.marked?.parse ? window.marked.parse(fm.content) : mdToHtmlFallback(fm.content));
  q('#postTitle').textContent = fm.attrs.title || findMeta(slug)?.title || '文章';
  q('#postContent').innerHTML = html;

  renderBreadcrumb(fm.attrs, slug);
  renderMetaBar(fm.attrs);
  renderTopAds();
  renderPrevNext(slug);

  // 右侧 TOC
  buildTOC('#postContent', '#toc', (SITE.tocLevels||['h2','h3']));

  // 页脚邮箱
  const se = q('#siteEmail'); if(se) se.textContent = SITE.email || '';
}

function renderNav(){
  const ul = q('#navList'); if(!ul) return;
  ul.innerHTML = (SITE.nav||[]).map(group=>{
    const items = (group.children||[]).map(c=>`<a href="${buildLink(c.slug)}">${esc(c.label||c.slug)}</a>`).join('');
    return `<li class="nav-item">
      <a href="javascript:void(0)">${esc(group.label||'分类')}</a>
      <div class="submenu">${items}</div>
    </li>`;
  }).join('');
  // 防闪退
  [...ul.children].forEach(li=>{
    let t; const sub = li.querySelector('.submenu');
    li.addEventListener('mouseleave',()=>{ t=setTimeout(()=>{ if(sub) sub.style.display='none' },200); });
    li.addEventListener('mouseenter',()=>{ clearTimeout(t); if(sub) sub.style.display='block'; });
  });
}

function findMeta(slug){ return (POSTS||[]).find(p=>p.slug===slug); }

function renderBreadcrumb(attrs, slug){
  const sep = SITE.breadcrumbSeparator || '»';
  const meta = findMeta(slug) || {};
  const cat = (meta.categories && meta.categories[0]) || (attrs.categories && attrs.categories[0]) || 'ChatGPT';
  const html = [
    `<a href="${PREFIX}">首页</a>`,
    `<a href="${PREFIX}tags.html?tag=${encodeURIComponent(cat)}">${esc(cat)}</a>`,
    `<span>${esc(attrs.title || meta.title || '正文')}</span>`
  ].join(` <span class="sep">${sep}</span> `);
  q('#breadcrumb').innerHTML = html;

  // JSON-LD
  const ld = {
    "@context":"https://schema.org",
    "@type":"BreadcrumbList",
    "itemListElement":[
      {"@type":"ListItem","position":1,"name":"首页","item": SITE.siteUrl || (location.origin+PREFIX)},
      {"@type":"ListItem","position":2,"name":cat,"item": (SITE.siteUrl || (location.origin+PREFIX)) + `tags.html?tag=${encodeURIComponent(cat)}`},
      {"@type":"ListItem","position":3,"name":attrs.title || meta.title || '正文'}
    ]
  };
  const s = document.createElement('script'); s.type='application/ld+json'; s.textContent=JSON.stringify(ld);
  document.head.appendChild(s);
}

function renderMetaBar(attrs){
  const left = `<span rel="author">${esc(SITE.author||'作者')}</span> · 微信：${esc(SITE.wechatId||'')}`;
  const right = `<time datetime="${esc(attrs.date||'')}">${esc(attrs.date||'')}</time>`;
  q('#metaBar').innerHTML = `<div>${left}</div><div>${right}</div>`;
}

function renderTopAds(){
  const box = q('#topAds'); if(!box) return;
  const ads = (SITE.ads && SITE.ads.articleTop) || [];
  box.innerHTML = ads.slice(0,2).map(a=>`
    <div class="ad">
      <img src="${a.image||'/plus/images/banner-plus.jpg'}" alt="">
      <div><div><b>${esc(a.title||'广告')}</b></div><div>${esc(a.desc||'')}</div></div>
      <a class="btn" target="_blank" href="${a.buttonLink||'#'}">${esc(a.buttonText||'了解更多')}</a>
    </div>
  `).join('');
}

function renderPrevNext(slug){
  const sorted = [...POSTS].sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));
  const idx = sorted.findIndex(p=>p.slug===slug);
  const prev = sorted[idx-1], next = sorted[idx+1];
  q('#postNav').innerHTML = `
    <div class="pagination">
      ${prev? `<a class="page-btn" href="${buildLink(prev.slug)}">上一篇：${esc(prev.title)}</a>`:''}
      ${next? `<a class="page-btn" href="${buildLink(next.slug)}">下一篇：${esc(next.title)}</a>`:''}
    </div>
  `;
}

// --- 简易 Front-matter 解析 ---
function parseFrontMatter(text){
  if(text.startsWith('---')){
    const end = text.indexOf('\n---',3);
    if(end>0){
      const raw = text.slice(3,end).trim();
      const content = text.slice(end+4).trim();
      const attrs = {};
      raw.split('\n').forEach(line=>{
        const m = line.match(/^(\w+):\s*(.*)$/);
        if(m){ const k=m[1]; let v=m[2].trim();
          if(v.startsWith('[')&&v.endsWith(']')){ try{ v=JSON.parse(v.replace(/'/g,'"')); }catch{} }
          attrs[k]=v.replace(/^"(.*)"$/,'$1');
        }
      });
      return {attrs, content};
    }
  }
  return {attrs:{}, content:text};
}

// --- 简易 Markdown 兜底渲染（如果没加载到 marked） ---
function mdToHtmlFallback(md){
  let html = md
    .replace(/^### (.*)$/gm,'<h3>$1</h3>')
    .replace(/^## (.*)$/gm,'<h2>$1</h2>')
    .replace(/^# (.*)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\n{2,}/g,'</p><p>');
  return `<p>${html}</p>`;
}

// --- 生成 TOC（无 tocbot 时也可用） ---
function buildTOC(contentSel, tocSel, levels){
  const cont = q(contentSel); const toc = q(tocSel); if(!cont||!toc) return;
  const sel = levels.join(',');
  const hs = [...cont.querySelectorAll(sel)];
  if(!hs.length){ toc.innerHTML='<div>（无小节）</div>'; return; }
  hs.forEach((h,i)=>{ if(!h.id) h.id='h-'+i; });
  toc.innerHTML = hs.map(h=>{
    const tag = h.tagName.toLowerCase();
    const pad = tag==='h3' ? ' style="padding-left:12px"' : '';
    return `<a${pad} href="#${h.id}">${esc(h.textContent)}</a>`;
  }).join('');
}
