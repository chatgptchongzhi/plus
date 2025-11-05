// 首页：导航/推荐/列表/分页/搜索/右侧栏
const q = (sel, el=document)=>el.querySelector(sel);
const qa = (sel, el=document)=>[...el.querySelectorAll(sel)];

async function getJSON(path){ const r=await fetch(url(path)); if(!r.ok) throw new Error(path+' load failed'); return r.json(); }
function esc(s){return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}
function fmtDate(s){return s}
function buildLink(slug){return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`}

let SITE={}, POSTS=[], SEARCH=[];
init().catch(e=>console.error(e));

async function init(){
  SITE = await getJSON('content/site.json');
  POSTS = await getJSON('content/index.json');
  SEARCH = await getJSON('content/search.json');

  renderNav();
  renderSidebar();
  renderWeChatFloat();

  renderRecommend();
  bindSearch();
  renderListWithPagination();
  q('#siteEmail').textContent = SITE.email || '';
}

// 导航 + 防闪退二级菜单
function renderNav(){
  const ul = q('#navList');
  ul.innerHTML = (SITE.nav||[]).map(group=>{
    const items = (group.children||[]).map(c=>`<a href="${buildLink(c.slug)}">${esc(c.label||c.slug)}</a>`).join('');
    return `<li class="nav-item">
      <a href="javascript:void(0)">${esc(group.label||'分类')}</a>
      <div class="submenu">${items}</div>
    </li>`
  }).join('');
  // 防闪退：延迟隐藏
  qa('.nav-item').forEach(li=>{
    let t;
    li.addEventListener('mouseleave',()=>{ t=setTimeout(()=>q('.submenu',li).style.display='none',200); });
    li.addEventListener('mouseenter',()=>{ clearTimeout(t); q('.submenu',li).style.display='block'; });
  });
}

// 推荐 4 篇：置顶优先，再按日期
function renderRecommend(){
  const rec = [...POSTS].sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||'')).slice(0, SITE.recommendCount||4);
  q('#recommendGrid').innerHTML = rec.map(p=>`
    <a class="rec-item" href="${buildLink(p.slug)}">
      <img src="${p.cover||'/plus/images/banner-plus.jpg'}" alt="${esc(p.title)}">
      <div>
        <div class="title">${esc(p.title)}</div>
        <div class="rec-meta">${fmtDate(p.date)} · 阅读 ${p.views??0}</div>
      </div>
    </a>`).join('');
}

// 列表 + 分页
function renderListWithPagination(){
  const ps = Number(new URLSearchParams(location.search).get('page')||'1');
  const pageSize = SITE.pageSize || 8;
  const sorted = [...POSTS].sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));
  const total = Math.ceil(sorted.length / pageSize);
  const start = (ps-1)*pageSize;
  const pageItems = sorted.slice(start, start+pageSize);
  renderList(pageItems);
  renderPagination(ps,total);
}

function renderList(items){
  q('#articleList').innerHTML = items.map(p=>`
    <article class="article-card">
      <a href="${buildLink(p.slug)}"><img class="article-thumb" src="${p.cover||'/plus/images/banner-plus.jpg'}" alt="${esc(p.title)}"></a>
      <div class="article-content">
        <a class="article-title" href="${buildLink(p.slug)}">${esc(p.title)}</a>
        <div class="article-excerpt">${esc(p.excerpt||'')}</div>
        <div class="article-meta">
          <span>${fmtDate(p.date)}</span><span>阅读 ${p.views??0}</span>
        </div>
        <div class="article-tags">${(p.tags||[]).map(t=>`<a class="tag" href="${PREFIX}tags.html?tag=${encodeURIComponent(t)}">${esc('#'+t)}</a>`).join('')}</div>
      </div>
    </article>
  `).join('');
}

function renderPagination(cur,total){
  const c = q('#pagination');
  if(total<=1){ c.innerHTML=''; return; }
  const btn = (p,txt,cls='')=>`<a class="page-btn ${cls}" href="${PREFIX}?page=${p}">${txt}</a>`;
  let html = '';
  if(cur>1) html += btn(cur-1,'上一页');
  for(let i=1;i<=total;i++) html += btn(i,i, i===cur?'active':'');
  if(cur<total) html += btn(cur+1,'下一页');
  c.innerHTML = html;
}

// 右侧栏
function renderSidebar(){
  q('#aboutBox').innerHTML = `<h3>关于本站</h3><div>${SITE.sidebar?.about || '专注 ChatGPT / Sora 教程与充值引导。'}</div>`;
  const ad = SITE.sidebar?.ad || {};
  q('#adBox').innerHTML = `<h3>${esc(ad.title||'推广')}</h3>
    <div class="ad">
      <img src="${ad.image||'/plus/images/banner-plus.jpg'}" alt="">
      <div><div>${esc(ad.title||'广告')}</div><div>${esc(ad.price||'')}</div></div>
      <a class="btn" href="${ad.buttonLink||'#'}" target="_blank">${esc(ad.buttonText||'了解更多')}</a>
    </div>`;
  const c = SITE.sidebar?.contact || {};
  q('#contactBox').innerHTML = `<h3>${esc(c.title||'联系木子')}</h3>
    <div>微信：${esc(SITE.wechatId||'')}</div>
    <img src="${SITE.wechatQrcode||'/plus/images/qrcode-wechat.png'}" alt="微信二维码">`;
}

// 搜索（输入时即时过滤）
function bindSearch(){
  const i = q('#searchInput');
  if(!i) return;
  let timer=null;
  i.addEventListener('input', e=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      const kw = (e.target.value||'').trim().toLowerCase();
      if(!kw){ renderListWithPagination(); return; }
      const res = SEARCH.filter(s=>
        (s.title||'').toLowerCase().includes(kw) ||
        (s.excerpt||'').toLowerCase().includes(kw) ||
        (s.tags||[]).some(t=>t.toLowerCase().includes(kw))
      ).map(s=>POSTS.find(p=>p.slug===s.slug)).filter(Boolean);
      renderList(res);
      q('#pagination').innerHTML='';
    }, 300);
  });
}

// 悬浮微信按钮
function renderWeChatFloat(){
  const img = q('#wfImg'); if(img) img.src = SITE.wechatQrcode || '/plus/images/qrcode-wechat.png';
}
