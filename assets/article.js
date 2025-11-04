/* 基础工具与 withBase 同步（原样保留） */
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
  window.$$ = s=>Array.from(document.querySelectorAll(s));
})();

const fmtDate = s => s ? new Date(s.replace(/-/g,'/')).toISOString().slice(0,10) : '';
async function fetchJSON(p){ const r = await fetch(withBase(p)); if(!r.ok) throw new Error(p); return r.json(); }
async function fetchText(p){ const r = await fetch(withBase(p)); if(!r.ok) throw new Error(p); return r.text(); }

function getSlug(){ const u = new URL(location.href); return u.searchParams.get('slug') || ''; }

function parseFrontMatter(md){
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  let fm = {}, body = md;
  if(m){
    const yaml = m[1];
    yaml.split('\n').forEach(line=>{
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if(!kv) return;
      const k = kv[1], v = kv[2];
      if(v.startsWith('[')){ try{ fm[k]=JSON.parse(v.replace(/'/g,'"')); }catch{} }
      else{ fm[k]=v.replace(/^"|"$|^'|'$/g,''); }
    });
    body = md.slice(m[0].length).trim();
  }
  return {fm, body};
}

function setBreadcrumb(siteTitle, cat, title){
  $('#breadcrumb').innerHTML =
    `<a href="${withBase('index.html')}">${siteTitle}</a>` +
    (cat && cat.length ? ` » <a href="${withBase('tags.html?name='+encodeURIComponent(cat[0]))}">${cat[0]}</a>` : '') +
    (title ? ` » ${title}` : '');
}
function renderBanners(banners){
  const box = $('#doubleBanners');
  box.innerHTML = (banners||[]).slice(0,2).map(b=>`
    <div class="banner">
      <div class="b-text">${b.text||''}</div>
      <a class="b-btn" href="${withBase(b.link||'#')}" target="_blank" rel="noopener">了解更多</a>
    </div>`).join('');
  $$('#doubleBanners .banner').forEach((el,i)=>{
    const img = banners[i]?.image;
    if(img){ el.style.backgroundImage = `url(${withBase(img)})`; }
    el.style.backgroundSize='cover'; el.style.backgroundPosition='center';
  });
}
function renderMeta(site, fm){
  $('#articleMetaRow').innerHTML =
    `<div>作者：老张 · 微信：${site.wechat||''}</div>` +
    `<div>发布日期：${fmtDate(fm.date)||''}</div>` +
    `<div>分类：${(fm.categories||[]).join(' / ')}</div>`;
}
function renderTags(tags){
  $('#tagPills').innerHTML = (tags||[]).map(t=>`
    <a class="tag-pill" href="${withBase('tags.html?name='+encodeURIComponent(t))}">#${t}</a>`).join('');
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
        <img src="${withBase(site.ad?.image || 'images/ad1.png')}" alt="ad" onerror="this.style.display='none'"/>
      </div>
      <div class="ad-price">${site.ad?.price||''}</div>
      <a class="btn btn-primary" href="${withBase(site.ad?.button?.link||'#')}" target="_blank" rel="noopener">
        ${site.ad?.button?.text||'查看详情'}
      </a>
    </section>
    <section class="card side-card contact-card">
      <h3>联系老张</h3>
      <div class="qrcode-wrap">
        <img src="${withBase('images/qrcode-wechat.png')}" alt="微信二维码" onerror="this.style.display='none'"/>
      </div>
      <p class="muted">加微信备注：Plus代充</p>
    </section>`;
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
  const input = $('#searchInput');
  input && input.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      location.href = withBase('index.html?kw='+encodeURIComponent(input.value.trim()));
    }
  });
}

(async function init(){
  $('#year') && ($('#year').textContent = new Date().getFullYear());
  await renderNav();
  const site = await fetchJSON('content/data/siteinfo.json');
  renderBanners(site.banners);

  // 加载并解析 MD
  const slug = getSlug();
  let mdText = '';
  try {
    mdText = await fetchText('content/posts/' + slug + '.md');
  } catch (e) {
    $('#articleBody').innerHTML = '<p style="color:#888">未找到本文内容，请确认文件 <code>content/posts/'+slug+'.md</code> 是否存在。</p>';
    await renderSidebar();
    return;
  }
  const { fm, body } = parseFrontMatter(mdText);

  // SEO
  document.title = `${fm.title||'文章'} | ${site.siteTitle||'木子AI'}`;
  const meta = document.getElementById('metaDesc');
  const desc = fm.excerpt || body.replace(/[#>*`~\-!\[\]\(\)]/g,'').slice(0,120);
  meta && meta.setAttribute('content', desc);

  setBreadcrumb(site.siteTitle||'木子AI', fm.categories, fm.title);
  renderMeta(site, fm);

  // 等待 marked 加载再渲染正文
  window.__onMarkedReady(function(){
    try{
      const html = window.marked.parse(body);
      $('#articleBody').innerHTML = html;
      // 再等 tocbot 可用时生成目录
      window.__onTocbotReady(function(){
        if (window.tocbot) {
          window.tocbot.init({
            tocSelector: '#toc',
            contentSelector: '.article-body',
            headingSelector: 'h2, h3',
            hasInnerContainers: true,
            scrollSmooth: true
          });
        }
      });
    }catch(e){
      $('#articleBody').innerHTML = '<p style="color:#888">正文渲染失败，请稍后刷新重试。</p>';
    }
  });

  // 标签
  renderTags(fm.tags);

  // 阅读量本地去重（可选）
  try{ const key='viewed_'+slug; if(!localStorage.getItem(key)) localStorage.setItem(key, Date.now()); }catch{}

  await renderSidebar();
})();
