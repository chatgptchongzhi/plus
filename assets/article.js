/* ========== Article Loader (HTML-only) ========== */
/* 作用：
   1) 从 URL 读取 ?slug=xxx
   2) 加载 content/posts/xxx.html 并塞进 #articleBody
   3) 填充面包屑 / meta / 右侧栏
   4) 初始化 TOC（tocbot）
   5) 全程使用 withBase() 保证 /plus/ 子路径正确
*/

(function(){
  const $ = (sel)=> document.querySelector(sel);
  const $$ = (sel)=> Array.from(document.querySelectorAll(sel));
  const byId = (id)=> document.getElementById(id);

  // 安全获取 URL 参数
  function getSlug(){
    const u = new URL(location.href);
    return (u.searchParams.get('slug') || '').trim();
  }

  // 拉取文本（HTML）
  async function fetchText(path){
    // 加时间戳避免缓存
    const url = (window.withBase ? window.withBase(path) : path) + (path.includes('?') ? '&' : '?') + 'v=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error('load '+url+' '+res.status);
    return res.text();
  }

  // 渲染右侧栏（复用站点信息）
  async function renderSidebar(){
    if(typeof window.fetchJSON === 'function'){
      try {
        const site = await window.fetchJSON('content/data/siteinfo.json');
        const desc = byId('siteDesc');
        const wx   = byId('wxId');
        const mail = byId('siteEmail');
        const adTitle = byId('adTitle');
        const adPrice = byId('adPrice');
        const adImage = byId('adImage');
        const adBtn   = byId('adBtn');
        const qr      = byId('qrcode');

        if(desc) desc.textContent = site.description || '';
        if(wx)   wx.textContent   = site.wechat || '';
        if(mail) mail.textContent = site.email || '';

        if(adTitle) adTitle.textContent = site.ad?.title || '广告';
        if(adPrice) adPrice.textContent = site.ad?.price || '';
        if(adImage) adImage.src = (window.withBase ? window.withBase(site.ad?.image || 'images/ad1.png') : (site.ad?.image || 'images/ad1.png'));
        if(adBtn){
          adBtn.textContent = site.ad?.button?.text || '了解更多';
          adBtn.href        = (window.withBase ? window.withBase(site.ad?.button?.link || '#') : (site.ad?.button?.link || '#'));
        }
        if(qr) qr.src = (window.withBase ? window.withBase('images/qrcode-wechat.png') : 'images/qrcode-wechat.png');
      } catch(e){}
    }
  }

  // 构建 TOC
  function buildTOC(){
    if(!window.tocbot) return;
    try{
      window.tocbot.init({
        tocSelector: '#toc',
        contentSelector: '#articleBody',
        headingSelector: 'h1, h2, h3',
        collapseDepth: 6,
        scrollSmooth: true
      });
    }catch(e){}
  }

  // 面包屑、meta 等（可按需拓展）
  function renderMeta(slug){
    const crumb = byId('breadcrumb');
    if(crumb){
      crumb.innerHTML = '木子AI » ';
    }
  }

  async function init(){
    // 年份
    const y = byId('year');
    if(y) y.textContent = new Date().getFullYear();

    // 导航（来自 main.js）
    if(typeof window.renderNav === 'function'){
      await window.renderNav();
    }
    // 右侧栏
    await renderSidebar();

    const slug = getSlug();
    if(!slug){
      const body = byId('articleBody');
      if(body) body.innerHTML = '<p style="color:#999">未指定 slug。</p>';
      return;
    }

    // 加载 HTML 正文
    const htmlPath = `content/posts/${slug}.html`;
    let html = '';
    try{
      html = await fetchText(htmlPath);
    }catch(e){
      html = `<p style="color:#999">未找到本文内容（尝试路径：${htmlPath}）。</p>`;
    }

    const body = byId('articleBody');
    if(body){
      body.innerHTML = html;
    }

    renderMeta(slug);
    buildTOC();
  }

  // 等主文档就绪
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
