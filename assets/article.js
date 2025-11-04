/* assets/article.js —— 一次性替换版 */

function withBase(p){
  const base = (document.querySelector('a.logo')?.getAttribute('href') || 'index.html')
    .replace(/index\.html.*/,'')
    .replace(/\/?$/, '/');
  if (/^https?:\/\//.test(p) || p.startsWith('/')) return p;
  return base + p;
}

async function loadJSON(path){
  const r = await fetch(withBase(path));
  if(!r.ok) throw new Error('load failed: ' + path);
  return r.json();
}

function fmtDate(dateStr){
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || '';
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function isoDate(dateStr){
  const d = new Date(dateStr);
  return isNaN(d) ? '' : d.toISOString().slice(0,10);
}

/* 统一的 Byline */
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

function getSlug(){
  const u = new URL(location.href);
  return u.searchParams.get('slug') || '';
}

async function init(){
  const slug = getSlug();
  if(!slug){
    document.getElementById('articleBody').innerHTML = '<p>缺少 slug 参数。</p>';
    return;
  }

  // 在索引里找这篇文章的元信息（日期 / 标签等）
  const index = await loadJSON('content/search.json?v=13');
  const meta  = index.find(i=>i.slug === slug);

  // Meta 区域
  const metaRow = document.getElementById('articleMetaRow');
  if(metaRow){
    metaRow.innerHTML = renderByline(meta?.date || '');
  }

  // 正文（按你的规则：content/posts/${slug}.html）
  const path = `content/posts/${slug}.html`;
  const r = await fetch(withBase(path));
  if(!r.ok){
    document.getElementById('articleBody').innerHTML =
      `<p>未找到本文内容（尝试路径：<code>${path}</code>）。</p>`;
  }else{
    const html = await r.text();
    document.getElementById('articleBody').innerHTML = html;
  }

  // 右侧标签等（可按需用 meta.tags / meta.categories）
  const tagPills = document.getElementById('tagPills');
  if(tagPills && meta?.tags){
    tagPills.innerHTML = meta.tags.map(t=>`<a class="tag-pill" href="${withBase(`index.html?tag=${encodeURIComponent(t)}`)}">#${t}</a>`).join('');
  }
}

document.addEventListener('DOMContentLoaded', init);
