(function () {
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const $  = (s, r=document) => r.querySelector(s);
  const fetchJSON = (p) => fetch(p+`?v=${Date.now()}`, {cache:'no-store'}).then(r=>r.json());

  function setSiteInfo(s){
    if(s.siteTitle){ document.title=s.siteTitle; $$('[data-site=title]').forEach(e=>e.textContent=s.siteTitle); }
    $$('[data-site=description]').forEach(e=>e.textContent=s.description||'');
    $$('[data-site=wechat]').forEach(e=>e.textContent=s.wechat||'');
    $$('[data-site=email]').forEach(e=>e.textContent=s.email||'');
    $$('[data-site=adText]').forEach(e=>e.textContent=s.adText||'');
    $$('[data-site=about]').forEach(e=>e.textContent=s.about||'');
    $$('[data-site=email-link]').forEach(a=>{ if(s.email) a.href=`mailto:${s.email}` });
    $$('[data-site=year]').forEach(e=>e.textContent=new Date().getFullYear());
  }

  function buildNav(nav){
    const items = Array.isArray(nav)?nav:(nav?.items||[]);
    const navEl = $('#nav');
    navEl.innerHTML = items.map(m => {
      const kids = (m.children||m.items||[]).map(k => `<a href="${k.url||'#'}">${k.title||k.name}</a>`).join('');
      return `<div class="nav-item"><a href="${m.url||'#'}">${m.title||m.name||''}</a>${kids?`<div class="sub">${kids}</div>`:''}</div>`;
    }).join('');
  }

  // 渲染 2×2 推荐
  function renderRecommend(list){
    const box = $('#recommend-grid');
    const top4 = list.slice(0,4);
    box.innerHTML = top4.map(p=>`
      <a class="rec-item" href="article.html?slug=${encodeURIComponent(p.slug)}">
        <img class="rec-cover" src="${p.cover||'images/banner-plus.jpg'}" alt="${p.title}" />
        <div class="rec-info">
          <h3 class="rec-title">${p.title}</h3>
          <div class="rec-meta">${p.date} · 阅读<span id="pv_${p.slug}"></span></div>
        </div>
      </a>
    `).join('');
  }

  // 列表 + 分页
  const state = { page:1, size:6, q:'', tag:null, all:[] };

  function filterPosts(){
    let arr = [...state.all];
    if(state.q){
      const q = state.q.toLowerCase();
      arr = arr.filter(p => (p.title+p.excerpt+(p.tags||[]).join(',')).toLowerCase().includes(q));
    }
    if(state.tag){
      arr = arr.filter(p => (p.tags||[]).includes(state.tag));
    }
    return arr;
  }

  function renderList(){
    const arr = filterPosts();
    const total = Math.ceil(arr.length / state.size) || 1;
    state.page = Math.min(state.page, total);
    const start = (state.page-1)*state.size;
    const pageItems = arr.slice(start, start+state.size);

    $('#article-list').innerHTML = pageItems.map(p=>`
      <article class="article-card">
        <a href="article.html?slug=${encodeURIComponent(p.slug)}"><img class="article-thumb" src="${p.cover||'images/banner-plus.jpg'}" alt="${p.title}"></a>
        <div class="article-content">
          <a class="article-title" href="article.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a>
          <p class="article-excerpt">${p.excerpt||''}</p>
          <div class="article-meta">
            <span>作者：${p.author||'木子AI'}</span>
            <span>日期：${p.date}</span>
            <span>阅读：<span id="pv_${p.slug}"></span></span>
          </div>
          <div class="article-tags">
            ${(p.tags||[]).map(t=>`<a class="tag" href="?tag=${encodeURIComponent(t)}">#${t}</a>`).join('')}
          </div>
        </div>
      </article>
    `).join('');

    // 分页
    const pag = $('#pagination');
    const btn = (label, page, active=false, disabled=false) =>
      `<button class="page-btn ${active?'active':''}" ${disabled?'disabled':''} data-page="${page}">${label}</button>`;
    const pages = Array.from({length: total}, (_,i)=>i+1).map(p=>btn(p, p, p===state.page)).join('');
    pag.innerHTML = btn('上一页', Math.max(1,state.page-1), false, state.page===1) + pages + btn('下一页', Math.min(total,state.page+1), false, state.page===total);
    pag.onclick = (e)=>{
      const b=e.target.closest('.page-btn'); if(!b) return;
      const p=Number(b.dataset.page); if(!isNaN(p)){ state.page=p; renderList(); window.scrollTo({top:0,behavior:'smooth'}) }
    };
  }

  function wireSearch(){
    const ipt = $('#searchInput');
    const url = new URL(location.href);
    state.tag = url.searchParams.get('tag');
    ipt.addEventListener('input', ()=>{ state.q = ipt.value.trim(); state.page=1; renderList(); });
    if(state.tag) renderList();
  }

  // 初始化
  Promise.all([
    fetchJSON('content/data/siteinfo.json').then(setSiteInfo),
    fetchJSON('content/data/navigation.json').then(buildNav),
    fetchJSON('content/data/posts.json')
  ]).then(([_,__,posts])=>{
    // 按时间倒序
    posts.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    state.all = posts;
    renderRecommend(posts);
    renderList();
    wireSearch();
  }).catch(console.error);
})();
