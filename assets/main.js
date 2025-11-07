// /plus/assets/main.js
// 首页：导航 / 推荐 / 列表（单一面板式文章流）/ 分页 / 搜索 / 右侧栏（容错：search.json 缺失也能运行）

const q  = (sel, el=document)=>el.querySelector(sel);
const qa = (sel, el=document)=>[...el.querySelectorAll(sel)];

async function getJSON(path){
  const r = await fetch(url(path));
  if(!r.ok) throw new Error(path+' load failed');
  return r.json();
}
function esc(s){return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}
function fmtDate(s){return s || '';}
function buildLink(slug){return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`}

let SITE={}, POSTS=[], SEARCH=[];
init().catch(e=>console.error(e));

async function init(){
  // 基础数据
  SITE  = await getJSON('content/site.json');
  POSTS = await getJSON('content/index.json');

  // search.json 容错
  try { SEARCH = await getJSON('content/search.json'); }
  catch(e){ console.warn('[search.json] not found or invalid, fallback to []'); SEARCH=[]; }

  // 渲染
  renderNav();
  renderSidebar();
  renderWeChatFloat();
  renderRecommend();
  bindSearch();
  renderListWithPagination(); // 支持 ?page= 与 ?category=

  const email = q('#siteEmail');
  if (email) email.textContent = SITE.email || '';
}

/* ============ 导航 ============ */
function renderNav(){
  const ul = q('#navList');
  if(!ul) return;
  ul.innerHTML = (SITE.nav||[]).map(group=>{
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

/* ============ 推荐区 ============ */
function renderRecommend(){
  const grid = q('#recommendGrid'); if(!grid) return;
  const source = Array.isArray(POSTS) ? POSTS : [];
  if (!source.length){ grid.innerHTML = '<div style="color:#999;padding:8px 0;">（暂无推荐内容）</div>'; return; }

  const rec = [...source]
    .sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''))
    .slice(0, SITE.recommendCount||4);

  grid.innerHTML = rec.map(p=>`
    <a class="rec-item" href="${buildLink(p.slug)}">
      <img src="${p.cover||'/plus/images/banner-plus.jpg'}" alt="${esc(p.title)}">
      <div>
        <div class="title">${esc(p.title)}</div>
        <div class="rec-meta">${fmtDate(p.date)} · 阅读 ${p.views??0}</div>
      </div>
    </a>`).join('');
}

/* ============ 列表 + 分页（单一面板式文章流） ============ */
function renderListWithPagination(){
  const params = new URLSearchParams(location.search);
  const ps = Number(params.get('page')||'1');
  const catParam = (params.get('category')||'').trim().toLowerCase();

  // —— 关键保险：pageSize 落在 [3,30]
  let pageSize = Number(SITE.pageSize||8);
  if (!Number.isFinite(pageSize)) pageSize = 8;
  pageSize = Math.min(30, Math.max(3, pageSize));

  const all = Array.isArray(POSTS) ? POSTS : [];
  const sorted = [...all].sort((a,b)=>(b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));

  // 支持从文章页面包屑跳转来的 ?category= 过滤（分类/分区/标签任一命中即可）
  const filtered = catParam ? sorted.filter(p => matchCategory(p, catParam)) : sorted;

  const list = q('#articleList');
  if (list) list.classList.add('article-list');

  if (!filtered.length){
    if (list) list.innerHTML = '<div style="color:#999;">（暂无文章）</div>';
    const p = q('#pagination'); if(p) p.innerHTML='';
    return;
  }

  const total = Math.ceil(filtered.length / pageSize);
  const start = (ps-1)*pageSize;
  const pageItems = filtered.slice(start, start+pageSize);

  renderList(pageItems);
  renderPagination(ps,total, catParam ? {category:catParam} : null);
}

function matchCategory(p, cat){
  const c = cat.toLowerCase();
  const pool = [];
  if (p.category) pool.push(String(p.category));
  if (Array.isArray(p.categories)) pool.push(...p.categories.map(String));
  if (p.section) pool.push(String(p.section));
  if (Array.isArray(p.tags)) pool.push(...p.tags.map(String));
  return pool.some(x => (x||'').toLowerCase() === c);
}

function renderList(items){
  const list = q('#articleList'); if(!list) return;
  if (!items.length){ list.innerHTML = '<div style="color:#999;">（暂无文章）</div>'; return; }

  list.innerHTML = items.map(p=>`
    <article class="article-card">
      <a class="article-thumb-link" href="${buildLink(p.slug)}" aria-label="${esc(p.title)}">
        <img class="article-thumb" src="${p.cover||'/plus/images/banner-plus.jpg'}" alt="${esc(p.title)}">
      </a>
      <div class="article-content">
        <a class="article-title" href="${buildLink(p.slug)}">${esc(p.title)}</a>
        <div class="article-excerpt">${esc(p.excerpt||'')}</div>
        <div class="article-meta"><span>${fmtDate(p.date)}</span><span>阅读 ${p.views??0}</span></div>
        <div class="article-tags">
          ${(p.tags||[]).map(t=>`<a class="tag" href="${PREFIX}?category=${encodeURIComponent(t)}">${esc('#'+t)}</a>`).join('')}
        </div>
      </div>
    </article>`).join('');
}

/* —— 稳健分页：数字 + 省略号；总页数<=1时隐藏容器 —— */
function renderPagination(cur,total, extraQuery){
  const c = q('#pagination'); if(!c) return;
  if(total<=1){ c.innerHTML=''; return; }

  const base = new URLSearchParams(extraQuery||{});
  const link = p => {
    const u = new URLSearchParams(base);
    u.set('page', String(p));
    return `${PREFIX}?${u.toString()}`;
  };
  const btn  = (p,txt,cls='')=>`<a class="page-btn ${cls}" href="${link(p)}" data-page="${p}">${txt}</a>`;
  const ell  = `<span class="page-ellipsis">…</span>`;

  // 页码窗口（current±2）+ 两端保留
  const pages = [];
  const add = p => { if(p>=1 && p<=total && !pages.includes(p)) pages.push(p); };
  add(1); add(2);
  for(let i=cur-2;i<=cur+2;i++) add(i);
  add(total-1); add(total);
  pages.sort((a,b)=>a-b);

  let html = '';
  html += btn(Math.max(1, cur-1), '‹', cur===1?'active-disabled':'');   // 上一页
  for(let i=0;i<pages.length;i++){
    const p = pages[i], prev = pages[i-1];
    if(i>0 && p-prev>1) html += ell;
    html += btn(p, p, p===cur?'active':'');
  }
  html += btn(Math.min(total, cur+1), '›', cur===total?'active-disabled':''); // 下一页
  c.innerHTML = html;

  // 点击先回顶，再跳转，避免第二页初始就显示“回到顶部”
  qa('.page-btn', c).forEach(a=>{
    const href = a.getAttribute('href');
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      window.scrollTo(0,0);
      location.href = href;
    });
  });
}

/* ============ 右侧栏 ============ */
function renderSidebar(){
  // 兼容两种命名：aboutBox/adBox/contactBox 与 sideBox1/sideBox2
  const aboutBox   = q('#aboutBox')   || q('#sideBox1');
  const adBox      = q('#adBox')      || q('#sideBox2');
  const contactBox = q('#contactBox'); // 可选

  if (aboutBox){
    aboutBox.innerHTML = `<h3>关于本站</h3><div>${SITE.sidebar?.about || '专注 ChatGPT / Sora 教程与充值引导。'}</div>`;
  }
  if (adBox){
    const ad = SITE.sidebar?.ad || {};
    adBox.innerHTML = `<h3>${esc(ad.title||'推广')}</h3>
      <div class="ad">
        <img src="${ad.image||'/plus/images/banner-plus.jpg'}" alt="">
        <div><div>${esc(ad.title||'广告')}</div><div>${esc(ad.price||'')}</div></div>
        <a class="btn" href="${ad.buttonLink||'#'}" target="_blank">${esc(ad.buttonText||'了解更多')}</a>
      </div>`;
  }
  if (contactBox){
    const c = SITE.sidebar?.contact || {};
    contactBox.innerHTML = `<h3>${esc(c.title||'联系木子')}</h3>
      <div>微信：${esc(SITE.wechatId||'')}</div>
      <img src="${SITE.wechatQrcode||'/plus/images/qrcode-wechat.png'}" alt="微信二维码">`;
  }
}

/* ============ 搜索 ============ */
function bindSearch(){
  const i = q('#searchInput'); if(!i) return;
  let timer=null;
  i.addEventListener('input', e=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      const kw = (e.target.value||'').trim().toLowerCase();
      if(!kw){ renderListWithPagination(); return; }
      const res = (SEARCH||[]).filter(s=>
        (s.title||'').toLowerCase().includes(kw) ||
        (s.excerpt||'').toLowerCase().includes(kw) ||
        (s.tags||[]).some(t=>t.toLowerCase().includes(kw))
      ).map(s=>POSTS.find(p=>p.slug===s.slug)).filter(Boolean);
      renderList(res);
      const p = q('#pagination'); if(p) p.innerHTML='';  // 搜索时隐藏分页
    }, 300);
  });
}

/* ============ 悬浮微信按钮占位图（仅首页） ============ */
function renderWeChatFloat(){
  const img = q('#wfImg');
  if(img) img.src = SITE.wechatQrcode || '/plus/images/qrcode-wechat.png';
}
