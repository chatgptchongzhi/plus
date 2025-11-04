(function(){
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const $=(s,r=document)=>r.querySelector(s);
  const fetchJSON=(p)=>fetch(p+`?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());
  const qs=new URLSearchParams(location.search); const slug=qs.get('slug')||'';

  function setSiteInfo(s){ $$('[data-site=title]').forEach(e=>e.textContent=s.siteTitle||'木子AI'); $$('[data-site=wechat]').forEach(e=>e.textContent=s.wechat||'muzi_ai'); $$('[data-site=year]').forEach(e=>e.textContent=new Date().getFullYear()) }

  function buildNav(nav){
    const items = Array.isArray(nav)?nav:(nav?.items||[]);
    const navEl = $('#nav');
    navEl.innerHTML = items.map(m=>{
      const kids=(m.children||m.items||[]).map(k=>`<a href="${k.url||'#'}">${k.title||k.name}</a>`).join('');
      return `<div class="nav-item"><a href="${m.url||'#'}">${m.title||m.name||''}</a>${kids?`<div class="sub">${kids}</div>`:''}</div>`;
    }).join('');
  }

  function buildTOC(){
    const heads = $$('#post-body h1, #post-body h2, #post-body h3');
    const toc = $('#toc'); toc.innerHTML='';
    heads.forEach(h=>{
      const id=h.id||(h.textContent.trim().replace(/\s+/g,'-')); h.id=id;
      const a=document.createElement('a'); a.textContent=h.textContent; a.href='#'+id; a.style.display='block'; a.style.padding='6px 0'; a.style.color='#666';
      toc.appendChild(a);
    });
  }

  Promise.all([
    fetchJSON('content/data/siteinfo.json').then(setSiteInfo),
    fetchJSON('content/data/navigation.json').then(buildNav),
    fetchJSON('content/data/posts.json')
  ]).then(([_,__,posts])=>{
    const meta = posts.find(p=>p.slug===slug);
    if(!meta){ $('#post-title').textContent='未找到文章'; return; }
    document.title = `${meta.title} - 木子AI`;
    $('#post-title').textContent = meta.title;
    $('#post-author').textContent = meta.author||'木子AI';
    $('#post-date').textContent = meta.date||'';

    // 分类/标签
    $('#post-cats').innerHTML = (meta.categories||[]).map(c=>`<a href="index.html?tag=${encodeURIComponent(c)}">#${c}</a>`).join('');

    fetch(`content/posts/${slug}.md?v=${Date.now()}`, {cache:'no-store'})
      .then(r=>r.text())
      .then(md=>{
        $('#post-body').innerHTML = marked.parse(md);
        buildTOC();
        // 标签
        $('#post-tags').innerHTML = (meta.tags||[]).map(t=>`<a class="tag" href="index.html?tag=${encodeURIComponent(t)}">#${t}</a>`).join('');
      });
  }).catch(console.error);
})();
