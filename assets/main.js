/* =========================================================================
   木子AI - 前台主脚本（零改动布局增强版）
   - 兼容你的原有选择器写法
   - 找不到时自动兜底（不要求改 index.html）
   - 不改变 DOM 结构 / 不影响排版
   ====================================================================== */

(function () {
  /** -------------------- 工具区 -------------------- **/
  const fetchJSON = (path) =>
    fetch(`${path}${path.includes('?') ? '&' : '?'}v=${Date.now()}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`Fetch ${path} failed: ${r.status}`);
        return r.json();
      });

  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const $ = (sel, root = document) => root.querySelector(sel);

  const setTextEl = (el, txt) => { if (el && typeof txt === 'string') el.textContent = txt; };
  const setAttrEl = (el, attr, val) => { if (el && val != null) el.setAttribute(attr, val); };

  // 选择器优先；若未命中，用 fallback() 兜底返回元素
  const pick = (selectors, fallback) => {
    for (const s of selectors) { const el = $(s); if (el) return el; }
    return typeof fallback === 'function' ? fallback() : null;
  };

  // GitHub Pages 子路径适配（/plus/）
  const basePath = (function () {
    const m = location.pathname.match(/\/([^\/]+)\//);
    return m ? `/${m[1]}/` : '/';
  })();
  const normalizeUrl = (url) => {
    if (!url) return '#';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return basePath + url.replace(/^\//, '');
    return url;
  };

  /** -------------------- 站点信息渲染 -------------------- **/
  function renderSiteInfo(site) {
    console.log('siteinfo loaded:', site);

    // 1) 标题
    if (site.siteTitle) {
      document.title = site.siteTitle;
      const titleEl = pick(
        ['[data-site=title]', '.site-title', '#site-title'],
        () => $('h1') // 兜底：第一个 H1
      );
      setTextEl(titleEl, site.siteTitle);
    }

    // 2) 描述
    if (site.description) {
      const descEl = pick(
        ['[data-site=description]', '.site-desc', '#site-desc'],
        () => {
          const h1 = $('h1');
          // 兜底：H1 后面的第一个 <p>
          if (h1 && h1.nextElementSibling && h1.nextElementSibling.tagName === 'P') {
            return h1.nextElementSibling;
          }
          // 再兜底：header 区域中的第一个段落
          return $('header p') || $('.tagline') || $('.subtitle');
        }
      );
      setTextEl(descEl, site.description);
    }

    // 3) 微信号
    if (site.wechat) {
      const wechatEl = pick(['[data-site=wechat]', '.wechat', '#wechat']);
      if (wechatEl) {
        setTextEl(wechatEl, site.wechat);
      } else {
        // 兜底：找包含“微信”字样的元素，然后替换文本中的微信号
        const cand = $$('body *').find((e) => {
          const t = (e.textContent || '').trim();
          return t && (/^微信[:：]/.test(t) || t.includes('微信：') || /^微信$/.test(t));
        });
        if (cand) {
          cand.innerHTML = (cand.innerHTML || '').replace(
            /微信[:：]?\s*[\w\-\._@]+/g,
            '微信： ' + site.wechat
          );
        }
      }
    }

    // 4) 邮箱（同时更新 mailto）
    if (site.email) {
      const emailTxt = pick(['[data-site=email]', '.email', '#email']);
      setTextEl(emailTxt, site.email);

      const emailLink =
        pick(['[data-site=email-link]', '.email-link'], () => $('a[href^="mailto:"]'));
      setAttrEl(emailLink, 'href', `mailto:${site.email}`);

      // 再兜底：找到包含“邮箱”的元素，把其中的邮箱地址替换掉
      if (!emailTxt && !emailLink) {
        const cand = $$('body *').find((e) => (e.textContent || '').includes('邮箱'));
        if (cand) {
          cand.innerHTML = (cand.innerHTML || '').replace(
            /邮箱[:：]?\s*[\w\.\-\+]+@[\w\.\-]+/g,
            '邮箱： ' + site.email
          );
        }
      }
    }

    // 5) 广告文案（若存在对应元素）
    if (site.adText) {
      const adEl = pick(['[data-site=adText]', '.ad-text', '#ad-text']);
      setTextEl(adEl, site.adText);
    }

    // 6) 关于（若存在对应元素；否则找“关于”小节的第一个段落）
    if (site.about) {
      const aboutEl = pick(['[data-site=about]', '.about-text', '#about-text'], () => {
        const h2 = $$('h2').find((x) => /关于/.test(x.textContent || ''));
        return h2 ? (h2.parentElement && h2.parentElement.querySelector('p')) : null;
      });
      setTextEl(aboutEl, site.about);
    }

    // 7) 年份
    const year = new Date().getFullYear();
    const yearEl = pick(['[data-site=year]', '.year', '#year']);
    setTextEl(yearEl, String(year));
  }

  /** -------------------- 导航渲染（可选） -------------------- **/
  function renderNavigation(nav) {
    const items = Array.isArray(nav) ? nav : (nav && Array.isArray(nav.items) ? nav.items : []);
    if (!items.length) return;

    const container = $('[data-nav=list]') || $('#nav');
    if (!container) return; // 没有容器就不渲染

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

    container.innerHTML = '';
    container.appendChild(ul);
  }

  /** -------------------- 初始化（加载 JSON） -------------------- **/
  function init() {
    // 1) 站点信息
    fetchJSON('content/data/siteinfo.json')
      .then(renderSiteInfo)
      .catch((e) => console.error('加载 siteinfo.json 失败：', e));

    // 2) 导航（可选）
    fetchJSON('content/data/navigation.json')
      .then(renderNavigation)
      .catch(() => { /* 可无导航 */ });

    // 3) 图片 404 提示 + / 开头路径自动补 basePath（不影响布局）
    $$('img').forEach((img) => {
      img.addEventListener('error', () => {
        console.warn('图片加载失败：', img.getAttribute('src'));
      }, { once: true });
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
