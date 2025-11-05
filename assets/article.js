// 文章页：加载 MD、渲染 TOC、Breadcrumb、Meta、上下篇
const q = (s,el=document)=>el.querySelector(s);
async function getJSON(p){ const r=await fetch(url(p)); if(!r.ok) throw new Error(p); return r.json(); }
function getParam(k){return new URLSearchParams(location.search).get(k)||''}
function esc(s){return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function buildLink(slug){return `${PREFIX}article.html?v=${BUILD_VERSION}&slug=${encodeURIComponent(slug)}`}

let SITE={}, POSTS=[];
init().catch(console.error);

async function init(){
  SITE = await getJSON('content/site.json');
  POSTS = await getJSON('content/index.json');
  renderNav();

  const slug = getParam('slug');
  if(!slug){ q('#postContent').innerHTML='<p>缺少 slug 参数。</p>'; return; }

  // 读取 MD
  const res = await fetch(url(`content/posts/${slug}.md`));
  if(!res.ok){ q('#postContent').innerHTML='<p>文章不存在或已删除。</p>'; return; }
  const md = await res.text();

  const fm = parseFrontMatter(md);
  const html = (window.marked?.parse ? window.marked.parse(fm.content) : fm.content);
  q('#postTitle').textContent = fm.attrs.title || findMeta(slug)?.title || '文章';
  q('#postContent').innerHTML = html;

  renderBreadcrumb(fm.attrs, slug);
  renderMetaBar(fm.attrs);
  renderTopAds();
  renderPrevNext(slug);

  // TOC
  const headings = q('#postContent').querySelectorAll('h2
