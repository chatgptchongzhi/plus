const q = (s,el=document)=>el.querySelector(s);
async function getJSON(p){ const r=await fetch(url(p)); if(!r.ok) throw new Error(p); return r.json(); }
function getParam(k){return new URLSearchParams(location.search).get(k)||''}
function buildLink(slug){return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`}

let SITE={}, POSTS=[];
init().catch(console.error);

async function init(){
  SITE = await getJSON('content/site.json');
  POSTS = await getJSON('content/index.json');
  renderNav();

  const tag = (getParam('tag')||'').toLowerCase();
  q('#tagTitle').textContent = tag ? `标签：${tag}` : '标签文章';

  const list = tag
    ? POSTS.filter(p=>(p.tags||[]).some(t=>t.toLowerCase()===tag))
    : POSTS;

  renderList(list);
  const about = q('#aboutBox'); if(about) about.innerHTML = `<h3>关于本站</h3>${SITE.sidebar?.about||''}`;
}

function renderNav(){
  const ul = q('#navList'); if(!ul) return;
  ul.innerHTML = (SITE.nav||[]).map(group=>{
    const items = (group.children||[]).map(c=>`<a href="${buildLink(c.slug)}">${c.label||c.slug}</a>`).join('');
    return `<li class="nav-item"><a href="javascript:void(0)">${group.label||'分类'}</a><div class="submenu">${items}</div></li>`;
  }).join('');
  [...ul.children].forEach(li=>{
    let t; const sub=li.querySelector('.submenu');
    li.addEventListener('mouseleave',()=>{ t=setTimeout(()=>{ if(sub) sub.style.display='none' },200); });
    li.addEventListener('mouseenter',()=>{ clearTimeout(t); if(sub) sub.style.display='block'; });
  });
}

function renderList(items){
  const box = q('#tagList');
  if(!items.length){ box.innerHTML='<p>暂无文章。</p>'; return; }
  box.innerHTML = items.map(p=>`
    <article class="article-card">
      <a href="${buildLink(p.slug)}"><img class="article-thumb" src="${p.cover||'/plus/images/banner-plus.jpg'}" alt="${p.title}"></a>
      <div class="article-content">
        <a class="article-title" href="${buildLink(p.slug)}">${p.title}</a>
        <div class="article-excerpt">${p.excerpt||''}</div>
        <div class="article-meta"><span>${p.date||''}</span><span>阅读 ${p.views??0}</span></div>
        <div class="article-tags">${(p.tags||[]).map(t=>`<a class="tag" href="${PREFIX}tags.html?tag=${encodeURIComponent(t)}">#${t}</a>`).join('')}</div>
      </div>
    </article>
  `).join('');
}
