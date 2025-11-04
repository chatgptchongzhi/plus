/* assets/main.js  —— 一次性替换版 */

async function loadJSON(path) {
  const r = await fetch(withBase(path));
  if (!r.ok) throw new Error('load failed: ' + path);
  return r.json();
}

function withBase(p) {
  // 兼容 /plus/ 前缀
  const base = (document.querySelector('a.logo')?.getAttribute('href') || 'index.html')
    .replace(/index\.html.*/,'')
    .replace(/\/?$/, '/');
  // 允许传绝对/相对
  if (/^https?:\/\//.test(p) || p.startsWith('/')) return p;
  return base + p;
}

function fmtDate(dateStr) {
  // dateStr 形如 2025-01-07
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

/* ======== Byline 统一渲染 ======== */
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

/* ======== 列表渲染 ======== */
function renderList(list, page=1, pageSize=6){
  const wrap = document.getElementById('listWrap');
  if(!wrap) return;

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

  // 分页
  const pager = document.getElementById('pager');
  if(pager){
    const nums = Array.from({length: pages}, (_,i)=>i+1).map(n=>{
      const cls = `page-num ${n===page ? 'active':''}`;
      const href = `?page=${n}`;
      return `<a class="${cls}" href="${href}">${n}</a>`;
    }).join('');
    pager.innerHTML = nums;
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

/* ======== 推荐渲染（左上方“必读文章”） ======== */
function renderRecommend(list){
  const block = document.getElementById('recoWrap');
  if(!block) return;
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

/* ======== 搜索 / 过滤 ======== */
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

/* ======== 入口 ======== */
async function init(){
  // 导航渲染由其他脚本完成，这里只处理内容
  const index = await loadJSON('content/search.json?v=13'); // 你的索引文件
  // 最新优先
  const sorted = [...index].sort((a,b)=> (b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||''));
  renderRecommend(sorted);
  renderList(sorted, getPageFromURL(), 6);

  // 搜索框
  const input = document.getElementById('searchInput');
  if(input){
    const doApply = ()=>{
      const f = filterByKeyword(sorted, input.value.trim());
      renderRecommend(f);
      renderList(f, 1, 6);
    };
    input.addEventListener('input', ()=> {
      clearTimeout(input._t); input._t = setTimeout(doApply, 250);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
