/* assets/main.js —— 一次性整页替换（指向 content/data/search.json） */

/* ========== 基础工具 ========== */
function withBase(p) {
  // 绝对地址/数据URL直接返回
  if (/^(https?:|data:)/.test(p)) return p;

  // 计算 /plus/ 前缀：取当前页面所在目录
  const basePath = location.pathname.replace(/[^/]+$/, ''); // 如 /plus/
  // 去掉传入路径前导斜杠，避免变成根路径
  const rel = String(p).replace(/^\/+/, '');

  // 返回“带域名的绝对地址”，不受 <base> 影响
  return location.origin + basePath + rel;
}



async function loadJSON(path) {
  const res = await fetch(withBase(path), { cache: 'no-cache' });
  if (!res.ok) throw new Error('load failed: ' + path);
  return res.json();
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || '';
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function isoDate(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? '' : d.toISOString().slice(0,10);
}

function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function debounce(fn, wait=250){
  let t=null;
  return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); };
}

/* ========== 统一读取索引（已改成真实路径，并带兜底） ========== */
/**
 * 真实文件：content/data/search.json
 * 兜底顺序：
 * 1) content/data/search.json?v=13
 * 2) content/data/search.json
 * 3) content/search.json?v=13
 * 4) content/search.json
 */
async function getIndexSafe(){
  const tryPaths = [
    'content/data/search.json?v=13',
    'content/data/search.json',
    'content/search.json?v=13',
    'content/search.json',
  ];
  let lastErr = null;
  for (const p of tryPaths) {
    try {
      const j = await loadJSON(p);
      console.log('[index] loaded:', p, j?.length);
      return j;
    } catch (e){
      lastErr = e;
      console.warn('[index] try fail:', p, e?.message || e);
    }
  }
  throw lastErr || new Error('No index json found');
}

/* ========== Byline + Post Meta + Badge ========== */
function renderByline(dateStr){
  const nice = fmtDate(dateStr);
  const iso  = isoDate(dateStr);
  return `
    <div class="byline-row">
      <span class="badge" aria-hidden="true" title="作者">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6z"/>
        </svg>
      </span>
      <span class="byline-text">木子 — 联系微信：ef98ee</span>
      <span class="post-meta"> · <time datetime="${iso}">${nice}</time></span>
    </div>
  `;
}

/* ========== 列表渲染 ========== */
function renderList(list, page=1, pageSize=6){
  const wrap = $('#listWrap');
  if (!wrap) return;

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(Math.max(1, page), pages);
  const start = (page - 1) * pageSize;
  const cur = list.slice(start, start + pageSize);

  wrap.innerHTML = cur.map(item=>{
    const url   = withBase(`article.html?slug=${encodeURIComponent(item.slug)}`);
    const cover = item.cover || 'images/banner-plus.jpg';
    const tags  = (item.tags||[]).map(t=>(
      `<a class="tag-pill" href="${withBase(`index.html?tag=${encodeURIComponent(t)}`)}">#${t}</a>`
    )).join('');
    return `
      <article class="list-card">
        <a class="list-thumb" href="${url}">
          <img src="${withBase(cover)}" alt="${item.title}">
        </a>
        <div class="list-main">
          <h3 class="list-title"><a href="${url}">${item.title}</a></h3>
          ${renderByline(item.date)}
          <p class="article-excerpt">${item.excerpt || ''}</p>
          <div class="article-tags">${tags}</div>
        </div>
      </article>
    `;
  }).join('');

  // 分页
  const pager = $('#pager');
  if (pager){
    const nums = Array.from({length: pages}, (_,i)=>i+1).map(n=>{
      const cls = `page-num ${n===page?'active':''}`;
      const href = `?page=${n}`;
      return `<a class="${cls}" href="${href}">${n}</a>`;
    }).join('');
    pager.innerHTML = nums;
    $all('a', pager).forEach(a=>{
      a.addEventListener('click', e=>{
        e.preventDefault();
        const p = Number(a.textContent);
        renderList(list, p, pageSize);
        history.replaceState(null, '', `?page=${p}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }
}

/* ========== 推荐区渲染（左侧“必读文章”） ========== */
function renderRecommend(list){
  const block = $('#recoWrap');
  if (!block) return;
  const top4 = list.slice(0,4);
  block.innerHTML = top4.map(item=>{
    const url   = withBase(`article.html?slug=${encodeURIComponent(item.slug)}`);
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

/* ========== 搜索 / 过滤 ========== */
function getPageFromURL(){
  const u = new URL(location.href);
  return Number(u.searchParams.get('page') || '1');
}

function filterByKeyword(list, kw){
  if (!kw) return list;
  const k = kw.toLowerCase();
  return list.filter(i =>
    (i.title||'').toLowerCase().includes(k) ||
    (i.excerpt||'').toLowerCase().includes(k) ||
    (i.tags||[]).some(t=>String(t).toLowerCase().includes(k)) ||
    (i.categories||[]).some(c=>String(c).toLowerCase().includes(k))
  );
}

/* ========== 入口 ========== */
async function init(){
  try{
    const index  = await getIndexSafe();              // ✅ 现在读取 content/data/search.json
    const sorted = [...index].sort((a,b)=>
      (b.top?1:0)-(a.top?1:0) || (b.date||'').localeCompare(a.date||'')
    );

    renderRecommend(sorted);
    renderList(sorted, getPageFromURL(), 6);

    // 搜索框联动
    const input = $('#searchInput');
    if (input){
      const apply = ()=>{
        const kw = input.value.trim();
        const f  = filterByKeyword(sorted, kw);
        renderRecommend(f);
        renderList(f, 1, 6);
        const hint = $('#searchHint');
        if (hint){
          hint.style.display = kw ? 'block':'none';
          hint.textContent   = kw ? `找到 ${f.length} 条与「${kw}」相关的内容` : '';
        }
      };
      input.addEventListener('input', debounce(apply, 250));
    }
  }catch(err){
    console.error('[init] failed:', err);
    const wrap = $('#listWrap');
    if (wrap){
      wrap.innerHTML = `
        <div class="card" style="color:#b00020">
          读取索引失败：${String(err?.message || err)}<br>
          请确认文件 <code>content/data/search.json</code> 已存在且可访问。
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
