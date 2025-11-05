// plus/assets/tags.js
/* 标签聚合页 */
const PREFIX = window.PREFIX || '/plus/';
const BUILD_VERSION = window.BUILD_VERSION || Date.now();
const url = (p) => (p.startsWith('/') ? p : (PREFIX + p)) + (p.includes('?') ? '&' : '?') + 'v=' + BUILD_VERSION;
const $ = (s,el=document)=>el.querySelector(s);
const htmlEscape = s=>String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

async function fetchJSON(p){ const r=await fetch(url(p)); if(!r.ok) throw new Error('load failed: '+p); return r.json(); }
function card(p){
  const a = url('article.html').replace(/\?v=.*/,'') + `?slug=${encodeURIComponent(p.slug)}`;
  return `<article class="article-card">
    <a href="${a}"><img class="article-thumb" src="${p.cover|| (PREFIX+'images/banner-plus.jpg')}" alt="${htmlEscape(p.title)}" loading="lazy"></a>
    <div class="article-content">
      <h3 class="article-title"><a href="${a}">${htmlEscape(p.title)}</a></h3>
      <p class="article-excerpt">${htmlEscape(p.excerpt||'')}</p>
      <div class="article-meta"><span>${p.date}</span> <span>${(p.tags||[]).map(t=>`#${htmlEscape(t)}`).join(' ')}</span></div>
    </div>
  </article>`;
}
function getParam(name){return new URL(location.href).searchParams.get(name)||'';}

(async function(){
  try{
    const tag = getParam('tag');
    $('#tagText').textContent = tag || '全部';
    const list = await fetchJSON('content/index.json');
    const filtered = tag ? list.filter(p=> (p.tags||[]).includes(tag)) : list;
    $('#tagList').innerHTML = filtered.map(card).join('') || `<div class="card">暂无文章</div>`;
  }catch(e){
    console.error(e);
    $('#tagList').innerHTML = `<div class="card">加载失败：${htmlEscape(e.message)}</div>`;
  }
})();
