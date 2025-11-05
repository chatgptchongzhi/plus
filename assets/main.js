// plus/assets/main.js
/* 首页逻辑：列表/推荐/分页/搜索/右侧栏 */
const PREFIX = window.PREFIX || '/plus/';
const BUILD_VERSION = window.BUILD_VERSION || Date.now();
const PAGE_SIZE = 8;
const SITE = {
  title: '木子AI',
  author: '木子AI',
  wechat: 'muzi_ai',
  email: 'contact@muzi.com',
};
const url = (p) => (p.startsWith('/') ? p : (PREFIX + p)) + (p.includes('?') ? '&' : '?') + 'v=' + BUILD_VERSION;

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function htmlEscape(s=''){return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));}
function fmtDate(s){const d=new Date(s);const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function debounce(fn,wait=300){let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait)}}

const state = {
  all: [],
  page: Math.max(1, parseInt(new URL(location.href).searchParams.get('page')||'1',10)),
  query: (new URL(location.href).searchParams.get('q')||'').trim(),
  searchIndex: []
};

function sortPosts(arr){
  return [...arr].sort((a,b)=>{
    if (a.top && !b.top) return -1;
    if (!a.top && b.top) return 1;
    return new Date(b.date) - new Date(a.date);
  });
}

async function fetchJSON(path){
  const res = await fetch(url(path));
  if(!res.ok) throw new Error('load failed: '+path);
  return res.json();
}

function renderRecommend(list){
  const box = $('#recommendGrid');
  box.innerHTML = '';
  const items = sortPosts(list).slice(0,4);
  for(const p of items){
    const el = document.createElement('a');
    el.className = 'rec-item';
    el.href = url('article.html').replace(/\?v=.*/,'') + `?slug=${encodeURIComponent(p.slug)}`;
    el.innerHTML = `
      <img src="${p.cover || (PREFIX+'images/banner-plus.jpg')}" alt="${htmlEscape(p.title)}" loading="lazy">
      <div class="rec-text">
        <div class="rec-title">${htmlEscape(p.title)}</div>
        <div class="rec-meta">${fmtDate(p.date)} · <span>阅读量</span></div>
      </div>`;
    box.appendChild(el);
  }
}

function cardHTML(p){
  const tagHTML = (p.tags||[]).map(t=>`<a href="${url('tags.html').replace(/\?v=.*/,'')}?tag=${encodeURIComponent(t)}">${htmlEscape(t)}</a>`).join(' ');
  const articleURL = url('article.html').replace(/\?v=.*/,'') + `?slug=${encodeURIComponent(p.slug)}`;
  return `<article class="article-card">
    <a href="${articleURL}"><img class="article-thumb" src="${p.cover || (PREFIX+'images/banner-plus.jpg')}" alt="${htmlEscape(p.title)}" loading="lazy"></a>
    <div class="article-content">
      <h3 class="article-title"><a href="${articleURL}">${htmlEscape(p.title)}</a></h3>
      <p class="article-excerpt">${htmlEscape(p.excerpt||'')}</p>
      <div class="article-meta">
        <span>${fmtDate(p.date)}</span>
        <span>分类：${htmlEscape((p.categories||[])[0]||'未分类')}</span>
        <span class="article-tags">${tagHTML}</span>
      </div>
    </div>
  </article>`;
}

function renderList(list){
  $('#articleList').innerHTML = list.map(cardHTML).join('') || `<div class="card">暂无内容</div>`;
}

function renderPager(total, page){
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const box = $('#paginator');
  box.innerHTML = '';
  function btn(txt, p, disabled=false, active=false){
    const a = document.createElement('button');
    a.className = 'page-btn'+(active?' active':'');
    a.textContent = txt;
    a.disabled = disabled;
    a.onclick = ()=> {
      const u = new URL(location.href);
      u.searchParams.set('page', p);
      history.pushState({}, '', u.toString());
      state.page = p;
      apply();
      window.scrollTo({top:0,behavior:'smooth'});
    };
    box.appendChild(a);
  }
  btn('上一页', Math.max(1, page-1), page<=1);
  for(let i=1;i<=pages;i++) btn(String(i), i, false, i===page);
  btn('下一页', Math.min(pages, page+1), page>=pages);
}

function apply(){
  let list = sortPosts(state.all);
  // 搜索
  if (state.query){
    const q = state.query.toLowerCase();
    list = state.searchIndex.filter(it=>{
      return (it.title||'').toLowerCase().includes(q)
        || (it.excerpt||'').toLowerCase().includes(q)
        || (it.tags||[]).join(',').toLowerCase().includes(q);
    }).map(it => state.all.find(p=>p.slug===it.slug)).filter(Boolean);
    $('#articleList').innerHTML = '';
    renderList(list);
    $('#paginator').innerHTML = '';
  }else{
    const start = (state.page-1)*PAGE_SIZE;
    renderList(list.slice(start, start+PAGE_SIZE));
    renderPager(list.length, state.page);
  }
  renderRecommend(list);
}

function initMenus(){
  // 防闪退：悬停延迟隐藏
  $$('.nav-item.has-sub').forEach(it=>{
    let hideTimer=null;
    const sub = it.querySelector('.sub-menu');
    const show = ()=>{ clearTimeout(hideTimer); sub.classList.add('show'); };
    const hide = ()=>{ hideTimer=setTimeout(()=>sub.classList.remove('show'), 200); };
    it.addEventListener('mouseenter', show);
    it.addEventListener('mouseleave', hide);
    sub.addEventListener('mouseenter', ()=>clearTimeout(hideTimer));
    sub.addEventListener('mouseleave', hide);
  });
}

function initSearch(){
  const ipt = $('#searchInput');
  if (!ipt) return;
  if (state.query) ipt.value = state.query;
  ipt.addEventListener('input', debounce(()=>{
    state.query = ipt.value.trim();
    const u = new URL(location.href);
    if (state.query) u.searchParams.set('q', state.query); else u.searchParams.delete('q');
    u.searchParams.delete('page');
    history.replaceState({}, '', u.toString());
    state.page = 1;
    apply();
  }, 300));
}

async function boot(){
  try{
    initMenus();
    const [list, sidx] = await Promise.all([
      fetchJSON('content/index.json'),
      fetchJSON('content/search.json'),
    ]);
    state.all = list;
    state.searchIndex = sidx;
    // 右侧 About 可在 index.json[0].siteAbout 覆盖
    const about = list.find(x=>x.siteAbout)||null;
    if (about) $('#siteAbout').textContent = about.siteAbout;
    apply();
    initSearch();
  }catch(err){
    console.error(err);
    $('#articleList').innerHTML = `<div class="card">数据加载失败：${htmlEscape(err.message)}<br>请确认 /plus/content/*.json 存在且为有效 JSON。</div>`;
  }
}

document.addEventListener('DOMContentLoaded', boot);
