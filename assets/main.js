/* =========================================================================
   布局零变动版 main.js
   - 不要求 HTML 增加 data- 属性
   - 不改动 DOM 结构和类名
   - 仅替换已有文字内容/链接
   ====================================================================== */

(function () {
  // ---- 工具：防缓存加载 JSON ----
  const fetchJSON = (path) =>
    fetch(`${path}${path.includes('?') ? '&' : '?'}v=${Date.now()}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`Fetch ${path} failed: ${r.status}`);
        return r.json();
      });

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const setText = (el, txt) => { if (el && typeof txt === 'string') el.textContent = txt; };
  const setAttr = (el, attr, val) => { if (el && val != null) el.setAttribute(attr, val); };

  // ---- 入口：应用站点信息 ----
  function applySiteInfo(site) {
    console.log('siteinfo loaded:', site);

    // 1) 页面 <title>
    if (site.siteTitle) document.title = site.siteTitle;

    // 2) 标题（优先命中常见选择器；否则找第一个 h1）
    const titleEl =
      $('.site-title') || $('#site-title') || $('h1');
    if (site.siteTitle) setText(titleEl, site.siteTitle);

    // 3) 描述（常见：.site-desc / #site-desc / 紧邻 h1 的段落）
    const descEl =
      $('.site-desc') || $('#site-desc') ||
      (titleEl ? (titleEl.nextElementSibling && titleEl.nextElementSibling.tagName === 'P' ? titleEl.nextElementSibling : null) : null) ||
      $('header p') || $('.tagline') || $('.subtitle');
    if (site.description) setText(descEl, site.description);

    // 4) 微信号
    //   先找类名或 id；找不到再扫描包含“微信”字样的元素并替换其中文本
    let wechatEl = $('.wechat') || $('#wechat');
    if (site.wechat) {
      if (wechatEl) {
        setText(wechatEl, site.wechat);
      } else {
        const candidate = $$('body *').find((e) => {
          const t = (e.textContent || '').trim();
          return t && (/^微信[:：]/.test(t) || t.includes('微信：') || /^微信$/.test(t));
        });
        if (candidate) {
          // 常见文本形态替换：微信：xxx
          candidate.innerHTML = candidate.innerHTML.replace(/微信[:：]?\s*[\w\-\._@]+/g, '微信： ' + site.wechat);
        }
      }
    }

    // 5) 邮箱（a[href^="mailto:"]、.email-link、.email）
    if (site.email) {
      const emailLink = $('a[href^="mailto:"], .email-link') || $('#email');
      if (emailLink) setAttr(emailLink, 'href', 'mailto:' + site.email);

      const emailTxt = $('.email');
      if (emailTxt) setText(emailTxt, site.email);
      else {
        const emailCandidate = $$('body *').find((e) => (e.textContent || '').includes('邮箱'));
        if (emailCandidate) {
          emailCandidate.innerHTML = emailCandidate.innerHTML.replace(
            /邮箱[:：]?\s*[\w\.\-\+]+@[\w\.\-]+/g,
            '邮箱： ' + site.email
          );
        }
      }
    }

    // 6) 广告文案（若页面有 .ad-text）
    if (site.adText) {
      const adEl = $('.ad-text');
      if (adEl) setText(adEl, site.adText);
    }

    // 7) 关于文案（若页面有 .about-text；否则尝试“关于”小节第一个段落）
    if (site.about) {
      const aboutEl =
        $('.about-text') ||
        (function () {
          const h2 = $$('h2').find((x) => /关于/.test(x.textContent || ''));
          if (!h2) return null;
          return (h2.parentElement && h2.parentElement.querySelector('p')) || null;
        })();
      if (aboutEl) setText(aboutEl, site.about);
    }

    // 8) 年份（若页面有 .year）
    const yearEl = $('.year');
    if (yearEl) setText(yearEl, new Date().getFullYear());
  }

  // ---- 可选：导航（如果你的页面没有导航容器，这段不会改任何东西）----
  function applyNavigation(nav) {
    const items = Array.isArray(nav) ? nav : (nav && Array.isArray(nav.items) ? nav.items : []);
    if (!items.length) return;

    const container = $('#nav') || $('[data-nav="list"]');
    if (!container) return;

    const createItem = (item) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = item.title || item.name || '未命名';
      a.href = item.url || '#';
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
    container.innerHTML = '';
    container.appendChild(ul);
  }

  // ---- 初始化 ----
  function init() {
    fetchJSON('content/data/siteinfo.json').then(applySiteInfo).catch(console.error);
    // 导航可选（存在时渲染）
    fetchJSON('content/data/navigation.json').then(applyNavigation).catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
