/* =========================================================================
   木子AI - 前台主脚本（缓存绕过 + 站点信息渲染 + 导航渲染）
   复制整段，直接覆盖 /assets/main.js
   ====================================================================== */

(function () {
  /** -------------------- 工具区 -------------------- **/
  const bust = () => `?v=${Date.now()}`; // 缓存绕过参数
  const fetchJSON = (path) =>
    fetch(`${path}${path.includes('?') ? '&' : '?'}v=${Date.now()}`, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`Fetch ${path} failed: ${r.status}`);
      return r.json();
    });

  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const $ = (sel, root = document) => root.querySelector(sel);

  const setText = (selList, txt) => {
    (Array.isArray(selList) ? selList : [selList]).forEach((sel) => {
      $$(sel).forEach((el) => (el.textContent = txt ?? ''));
    });
  };
  const setHTML = (selList, html) => {
    (Array.isArray(selList) ? selList : [selList]).forEach((sel) => {
      $$(sel).forEach((el) => (el.innerHTML = html ?? ''));
    });
  };
  const setAttr = (selList, attr, val) => {
    (Array.isArray(selList) ? selList : [selList]).forEach((sel) => {
      $$(sel).forEach((el) => el.setAttribute(attr, val ?? ''));
    });
  };

  // GitHub Pages 子路径适配（/plus/）
  const basePath = (function () {
    // 只要当前路径中包含 /plus/，就认为仓库名是 plus
    const m = location.pathname.match(/\/([^\/]+)\//);
    return m ? `/${m[1]}/` : '/';
  })();
  const normalizeUrl = (url) => {
    if (!url) return '#';
    if (/^https?:\/\//i.test(url)) return url; // 绝对 URL 原样返回
    if (url.startsWith('/')) return basePath + url.replace(/^\//, ''); // 站内绝对路径 → 补上 basePath
    return url; // 相对路径
  };

  /** -------------------- 站点信息渲染 -------------------- **/
  function renderSiteInfo(site) {
    // 调试：在控制台能看到你后台的最新值
    console.log('siteinfo loaded:', site);

    // <title> 和一些常见占位
    if (site.siteTitle) {
      document.title = site.siteTitle;
      setText(['[data-site=title]', '.site-title', '#site-title'], site.siteTitle);
    }

    setText(['[data-site=description]', '.site-desc', '#site-desc'], site.description);
    setText(['[data-site=wechat]', '.wechat', '#wechat'], site.wechat);
    setText(['[data-site=email]', '.email', '#email'], site.email);
    setText(['[data-site=adText]', '.ad-text', '#ad-text'], site.adText);
    setText(['[data-site=about]', '.about-text', '#about-text'], site.about);

    // 年份自动更新
    const year = new Date().getFullYear();
    setText(['[data-site=year]', '.year', '#year'], year);

    // 如需把邮箱写到 href=mailto:
    $$( '[data-site=email-link], .email-link, a[href^="mailto:"]' ).forEach((a)=>{
      if (site.email) a.setAttribute('href', `mailto:${site.email}`);
    });
  }

  /** -------------------- 导航渲染（可选） -------------------- **/
  function renderNavigation(nav) {
    // nav 可能是 {items:[...]} 或直接是 [...]
    const items = Array.isArray(nav) ? nav : (nav && Array.isArray(nav.items) ? nav.items : []);
    if (!items.length) {
      console.warn('navigation.json 为空或结构不匹配');
      return;
    }

    const container = $('[data-nav=list]') || $('#nav');
    if (!container) return; // 页面上没有导航容器就跳过

    const createItem = (item) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = item.title || item.name || '未命名';
      a.href = normalizeUrl(item.url || '#');
      li.appendChild(a);

      const children = item.children || item.items;
      if (Array.isArray(children) && children.length) {
        const ul = document.createElement('ul');
        children.forEach((child) => ul.appendChild(createItem(child)));
        li.appendChild(ul);
      }
      return li;
    };

    const ul = document.createElement('ul');
    ul.className = 'nav-list';
    items.forEach((it) => ul.appendChild(createItem(it)));

    // 清空并挂载
    container.innerHTML = '';
    container.appendChild(ul);
  }

  /** -------------------- 初始化（加载 JSON） -------------------- **/
  function init() {
    // 1) 站点信息（强制无缓存）
    fetchJSON('content/data/siteinfo.json')
      .then(renderSiteInfo)
      .catch((e) => console.error('加载 siteinfo.json 失败：', e));

    // 2) 导航（如果有）
    fetchJSON('content/data/navigation.json')
      .then(renderNavigation)
      .catch((e) => console.warn('加载 navigation.json 失败或未配置：', e));

    // 3) 图片 404 提示（不阻塞渲染）
    // 给所有 img 打一个错误监听，方便你快速发现错误路径
    $$( 'img' ).forEach((img) => {
      img.addEventListener('error', () => {
        console.warn('图片加载失败：', img.getAttribute('src'));
      }, { once: true });
      // 对以 / 开头的路径自动补 basePath（只在 GitHub Pages 子路径场景）
      const src = img.getAttribute('src') || '';
      if (src.startsWith('/')) img.setAttribute('src', normalizeUrl(src));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
