// plus/assets/article.js
/* 详情页：渲染 Markdown / 目录 / 上下篇 */
const PREFIX = window.PREFIX || '/plus/';
const BUILD_VERSION = window.BUILD_VERSION || Date.now();
const SITE = { author:'木子AI', wechat:'muzi_ai' };
const url = (p) => (p.startsWith('/') ? p : (PREFIX + p)) + (p.includes('?') ? '&' : '?') + 'v=' + BUILD_VERSION;
const $ = (s,el=document)=>el.querySelector(s);
const htmlEscape = s=>String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const fmtDate = s=>{const d=new Date(s);const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
function getParam(name){return new URL(location.href).searchParams.get(name)||'';}

async function fetchJSON(p){ const r=await fetch(url(p)); if(!r.ok) throw new Error('load failed: '+p); return r.json(); }
async function fetchText(p){ const r=await fetch(url(p)); if(!r.ok) throw new Error('load failed: '+p); return r.text(); }

function renderMeta(post){
  $('#postTitle').textContent = post.title;
  $('#docTitle').textContent = post.title + '｜木子AI';
  $('#crumbTitle').textContent = post.title;
  $('#authorName').textContent = SITE.author;
  $('#authorWx').textContent = SITE.wechat;
  $('#postDate').textContent = fmtDate(post.date);
  const cat = (post.categories||[])[0] || 'ChatGPT';
  $('#catLink').textContent = cat;
  $('#catLink').href = url('tags.html').replace(/\?v=.*/,'') + `?tag=${encodeURIComponent(cat)}`;
}

function renderPrevNext(posts, cur){
  const i = posts.findIndex(x=>x.slug===cur.slug);
  const prev = posts[i-1], next = posts[i+1];
  const toURL = s => url('article.html').replace(/\?v=.*/,'') + `?slug=${encodeURIComponent(s)}`;
  const prevA = $('#prevPost'), nextA = $('#nextPost');
  if (prev){ prevA.href = toURL(prev.slug); prevA.textContent = '上一篇：' + prev.title; } else { prevA.style.visibility='hidden'; }
  if (next){ nextA.href = toURL(next.slug); nextA.textContent = '下一篇：' + next.title; } else { nextA.style.visibility='hidden'; }
}

function initTOC(){
  if (!window.tocbot) return;
  tocbot.init({
    tocSelector: '#postTOC',
    contentSelector: '#postContent',
    headingSelector: 'h2, h3',
    collapseDepth: 6,
    scrollSmooth: true
  });
}

async function boot(){
  const slug = getParam('slug');
  if (!slug){
    $('#postContent').innerHTML = '<div class="card">缺少参数 slug</div>'; return;
  }
  try{
    const [all, md] = await Promise.all([
      fetchJSON('content/index.json'),
      fetchText(`content/posts/${slug}.md`)
    ]);

    // 解析 YAML 头
    const m = md.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
    let front={}, body=md;
    if (m){ 
      const yml=m[1]; body=m[2];
      yml.split('\n').forEach(line=>{
        const mm=line.match(/^(\w+):\s*(.*)$/);
        if(mm){ const k=mm[1]; let v=mm[2];
          try{ if(v.startsWith('[')&&v.endsWith(']')) v=JSON.parse(v.replace(/'/g,'"')); }catch(e){}
          front[k]=v;
        }
      });
    }
    const post = all.find(p=>p.slug===slug) || front || {title:slug,date:Date.now()};
    renderMeta(post);

    // 渲染 Markdown（使用本地 libs/marked.min.js）
    if (window.marked){
      const html = marked.parse(body);
      $('#postContent').innerHTML = html;
    }else{
      $('#postContent').textContent = body;
    }
    initTOC();
    renderPrevNext(all, post);
  }catch(err){
    console.error(err);
    $('#postContent').innerHTML = `<div class="card">内容加载失败：${htmlEscape(err.message)}<br>请确认 /plus/content/posts/${htmlEscape(slug)}.md 是否存在。</div>`;
  }
}
document.addEventListener('DOMContentLoaded', boot);
