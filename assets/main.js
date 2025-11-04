/* assets/main.js —— 急救容错版（一次性替换） */

/* ====== 1) 容错获取索引 ====== */
// 优先顺序：content/search.json → window.POST_INDEX → 空数组
async function getIndexSafe() {
  // A. 尝试拉取 JSON（如果你在用 search.json）
  try {
    const r = await fetch(withBase('content/search.json?v=16'), { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j)) return j;
      console.warn('[main] search.json 不是数组，忽略');
    } else {
      console.warn('[main] 拉取 search.json 失败：', r.status);
    }
  } catch (e) {
    console.warn('[main] 解析 search.json 出错：', e);
  }
  // B. 兜底：看是否存在全局变量（如果你使用了 assets/post-index.js）
  if (Array.isArray(window.POST_INDEX)) return window.POST_INDEX;

  // C. 最终兜底：空数组（页面会显示“暂无文章”，不再整页空白）
  return [];
}

/* ====== 2) 工具函数 ====== */
function withBase(p) {
  const base = (document.querySelector('a.logo')?.getAttribute('href') || 'index.html')
    .replace(/index\.html.*/, '')
    .replace(/\/?$/, '/');
  if (/^https?:\/\//.test(p) || p.startsWith('/')) return p;
  return base + p;
}
function fmtDate(dateStr){
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || '';
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function isoDate(dateStr){
  const d = new Date(dateStr);
  return isNaN(d) ? '' : d.toISOString().slice(0,10);
}

/* ====== 3) Byline + Post Meta + Badge ====== */
function renderByline(dateStr){
  const nice = fmtDate(dateStr);
  const iso  = isoDate(dateStr);
  return `
    <div class="byline-row">
      <span class="badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6z"/>
        </svg>
      </span>
      <span class="byline-text">木子 — 联系微信：ef98ee</span>
      <span class="post-meta"> · <time datetime="${iso}">${nice}</time></span>
    </div>
  `;
}

/* ====== 4) 列表渲染（带空态） ====== */
function renderEmptyState() {
  const wrap = document.getElementById('listWrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <article class="list-card" style="justify-content:center; text-align:center">
      <div>
        <h3 class="list-title">暂无文章</h3>
        <p class="article-excerpt">还没有可展示的内容。请确认 <code>content/search.json</code> 存在且为合法 JSON，
        或者在 <code>assets/post-index.js</code> 里定义 <code>window.POST_INDEX=[]</code>。</p>
      </div>
    </article>
  `;
  const pager = document.getElementById('pager');
  if (pager) pager.innerHTML = '';
}
function renderList(list, page=1, pageSize=6){
  const wrap = document.getElementById('listWrap');
  if(!wrap) return;
  if (!Array.isArray(list) || list.length === 0) {
    renderEmptyState();
    return;
  }

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total/pageSize));
  page = Math.min(Math.max(1, page), pages);
  const start = (page-1)*pageSize;
  const cur = list.slice(start, start+pageSize);

  wrap.innerHTML = cur.map(item => {
    const url = withBase(`article.html?slug=${encodeURIComponent(item.slug)}`);
    const cover = item.cover || 'images/banner-plus.jpg';
    return `
      <article class="list-card">
        <a class="list-thumb" href="${url}">
          <img src="${withBase(cover)}" alt="${item.title}">
        </a>
        <div class="list-main">
          <h3 class="list-title"><a href="${url}">${item.title}</a></h3>
          ${renderByline(item.date)}
          <p class="article-excerpt">${item.excerpt || ''}</p>
          <div class="article-tags">
            ${(item.tags||[]).map(t=>`<a class="tag-pill" href="${withBase(`index.html?tag=${encodeURIComponent(t)}`)}">#${t}</a>`).join('')}
          </div>
        </div>
      </article>
    `;
  }).join('');

  const pager = document.getElementById('pager');
  if(pager){
    const pagesHtml = Array.from({length: pages}, (_,i)=>i+1).map(n=>{
      const cls = `page-num ${n===page?'active':''}`;
      return `<a class="${cls}" href="?page=${n}">${n}</a>`;
    }).join('');
    pager.innerHTML = pagesHtml;
    pager.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click', e=>{
        e.preventDefault();
        const p = Number(a.textContent);
        renderList(list, p, pageSize);
        history.replaceState(null, '', `?page=${p}`);
        window.scrollTo({top:0,behavior:'smooth'});
      });
    });
  }
}

/* ====== 5) 推荐渲染（也带空态兜底） ====== */
function renderRecommend(list){
  const block = document.getElementById('recoWrap');
  if(!block) return;
  if (!Array.isArray(list) || list.length === 0) {
    block.innerHTML = '';
    return;
  }
  const top4 = list.slice(0,4);
  block.innerHTML = top4.map(item=>{
    const url = withBase(`article.html?slug=${encodeURIComponent(item.slug)}`);
    const cover = item.cover || 'images/banner-plus.jpg';
    return `
      <div class="reco-item">
        <a class="reco-thumb" href="${url}">
          <img src="${withBase(cover)}" alt="${item.title}">
        </a>
        <div class="reco-meta">
          <div class="reco-title"><a href="${url}">${item.title}</a></div>
          ${renderByline(item.date)}
        </div>
      </div>
    `;
  }).join('');
}

/* ====== 6) 搜索 ====== */
function getPageFromURL(){
  const u = new URL(location.href);
  return Number(u.searchParams.get('page') || '1');
}
function filterByKeyword(list, kw){
  if(!kw) return list;
  const k = kw.toLowerCase();
  return list.filter(i =>
    (i.title||'').toLowerCase().includes(k) ||
    (i.excerpt||'').toLowerCase().includes(k) ||
    (i.tags||[]).some(t=>String(t).toLowerCase().includes(k)) ||
    (i.categories||[]).some(c=>String(c).toLowerCase().includes(k))
  );
}

/* ====== 7) 入口 ====== */
async function init(){
  try{
    const index = await getIndexSafe();

    // 优先置顶，再按日期降序
    const sorted = [...index].sort((a,b)=>
      (b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||'')
    );

    renderRecommend(sorted);
    renderList(sorted, getPageFromURL(), 6);

    const input = document.getElementById('searchInput');
    if(input){
      const apply = ()=>{
        const f = filterByKeyword(sorted, input.value.trim());
        renderRecommend(f);
        renderList(f, 1, 6);
      };
      input.addEventListener('input', ()=>{
        clearTimeout(input._t);
        input._t = setTimeout(apply, 250);
      });
    }
  }catch(err){
    console.error('[main] 初始化异常：', err);
    renderEmptyState();
  }
}
document.addEventListener('DOMContentLoaded', init);
