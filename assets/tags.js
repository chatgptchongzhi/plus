(function(){
  function detectBase(){
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
  window.$ = s=>document.querySelector(s);
})();
const fmtDate = s => s ? new Date(s.replace(/-/g,'/')).toISOString().slice(0,10) : '';
async function fetchJSON(p){ const r = await fetch(withBase(p)); if(!r.ok) throw new Error(p); return r.json(); }

function getTag(){
  const u = new URL(location.href);
  return u.searchParams.get('name')||'';
}
function renderList(all, page=1, perPage=8){
  const start=(page-1)*perPage, items=all.slice(start, start+perPage);
  const box = $('#listContainer');
  box.innerHTML = items.map(p=>`
  <article class="list-card">
    <a class="list-thumb" href="${withBase('article.html?slug='+encodeURIComponent(p.slug))}">
      <img src="${withBase(p.cover || 'images/banner-plus.jpg')}" alt="${p.title}" onerror="this.style.display='none'">
    </a>
    <div class="list-main">
      <h3 class="list-title"><a href="${withBase('article.html?slug='+encodeURIComponent(p.slug))}">${p.title}</a></h3>
      <div class="article-meta"><span>${p.date||''}</span><span>分类：${(p.categories||[]).join(' / ')}</span></div>
      <p class="article-excerpt">${p.excerpt||''}</p>
      <div class="article-tags">
        ${(p.tags||[]).map(t=>`<a class="tag-pill" href="${withBase('tags.html?name='+encodeURIComponent(t))}">#${t}</a>`).join('')}
      </div>
    </div>
  </article>`).join('');

  const total = Math.ceil(all.length/perPage);
  const pag = $('#pagination');
  let html = `<a class="page-btn" href="#" data-go="${Math.max(1,page-1)}">上一页</a>`;
  for(let i=1;i<=total;i++){
    html += `<a class="page-num ${i===page?'active':''}" href="#" data-go="${i}">${i}</a>`;
  }
  html += `<a class="page-btn" href="#" data-go="${Math.min(total,page+1)}">下一页</a>`;
  pag.innerHTML = html;

  pag.onclick = e=>{
    const a = e.target.closest('a[data-go]');
    if(!a) return;
    e.preventDefault();
    const n = parseInt(a.dataset.go,10);
    renderList(all, n, perPage);
    scrollTo({top:0, behavior:'smooth'});
  };
}

async function renderSidebar(){
  const site = await fetchJSON('content/data/siteinfo.json');
  $('#sidebar').innerHTML = `
    <section class="card side-card">
      <h3>关于本站</h3>
      <p>${site.description||''}</p>
      <ul class="site-meta">
        <li>微信：${site.wechat||''}</li>
        <li>邮箱：<a href="mailto:${site.email||''}">${site.email||''}</a></li>
      </ul>
    </section>
    <section class="card side-card ad-card">
      <h3>${site.ad?.title||'广告'}</h3>
      <div class="ad-img-wrap">
        <img src="${withBase(site.ad?.image || 'images/ad1.png')}" alt="ad" onerror="this.style.display='none'">
      </div>
      <div class="ad-price">${site.ad?.price||''}</div>
      <a class="btn btn-primary" href="${withBase(site.ad?.button?.link||'#')}" target="_blank" rel="noopener">
        ${site.ad?.button?.text||'查看详情'}
      </a>
    </section>
  `;
}

async function renderNav(){
  const nav = $('#navbar');
  const data = await fetchJSON('content/data/navigation.json');
  nav.innerHTML = data.items.map((grp,i)=>`
    <div class="nav-group">
      <div class="nav-item" data-idx="${i}">${grp.title}</div>
      <div class="dropdown" id="dd-${i}">
        ${grp.children.map(c=>`<a href="${withBase(c.url)}">${c.title}</a>`).join('')}
      </div>
    </div>`).join('');
  // 防闪退
  document.querySelectorAll('.nav-group').forEach((g,i)=>{
    const item = g.querySelector('.nav-item');
    const dd = g.querySelector('.dropdown');
    let t=null; const show=()=>{clearTimeout(t); dd.style.display='block'};
    const hide=()=>{t=setTimeout(()=>dd.style.display='none',200)};
    item.addEventListener('mouseenter',show);
    item.addEventListener('mouseleave',hide);
    dd.addEventListener('mouseenter',()=>clearTimeout(t));
    dd.addEventListener('mouseleave',hide);
  });
}

(async function init(){
  await renderNav();
  await renderSidebar();
  const tag = getTag();
  document.title = `#${tag} | 木子AI`;
  $('#tagTitle').textContent = `#${tag}`;
  const idx = await fetchJSON('content/data/search.json');
  const list = idx.filter(p => (p.tags||[]).includes(tag))
                  .sort((a,b)=> (b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));
  renderList(list, 1, 8);
})();
