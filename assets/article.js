// plus/assets/article.js
(function () {
  const $ = (s) => document.querySelector(s);
  const fmt = (s) => (s ? new Date(s.replace(/-/g,'/')).toISOString().slice(0,10) : '');

  function getSlug() {
    const u = new URL(location.href);
    return (u.searchParams.get('slug') || '').trim();
  }

  function withBase(url) {
    if (!url) return '';
    if (/^https?:|^data:|^mailto:|^#/.test(url)) return url;
    const p = location.pathname;
    const idx = p.indexOf('/plus/');
    const base = idx >= 0 ? p.slice(0, idx + '/plus/'.length).replace(/\/$/, '') : '';
    url = url.replace(/^\.?\//,'');
    return base ? base + '/' + url : '/' + url;
  }

  async function fetchText(path) {
    const url = withBase(path + (path.includes('?') ? '&' : '?') + 'v=' + Date.now());
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('load ' + url + ' ' + res.status);
    return res.text();
  }

  function extractFM(text) {
    const m = text.match(/^---\s*([\s\S]*?)\s*---\s*/);
    if (!m) return { fm: {}, body: text };
    const yaml = m[1];
    const body = text.slice(m[0].length);
    const fm = {};
    yaml.split(/\r?\n/).forEach(line=>{
      const mm = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
      if (!mm) return;
      let v = mm[2].trim();
      try { fm[mm[1]] = JSON.parse(v); } catch { fm[mm[1]] = v; }
    });
    return { fm, body };
  }

  function renderTOC() {
    if (!window.tocbot) return;
    try {
      window.tocbot.init({
        tocSelector: '#toc',
        contentSelector: '.article-body',
        headingSelector: 'h1, h2, h3',
        collapseDepth: 6
      });
    } catch {}
  }

  function renderMeta(fm) {
    const row = document.querySelector('#articleMetaRow');
    const left = `<span>作者：老张（微信：<b>muzi_ai</b>）</span>`;
    const mid  = `<span>${fmt(fm.date) || ''}</span>`;
    const right= `<span>分类：${(fm.categories||[]).join(' / ')}</span>`;
    row.innerHTML = `<div class="meta-left">${left}</div><div class="meta-mid">${mid}</div><div class="meta-right">${right}</div>`;
    const pills = (fm.tags||[]).map(t=>`<a class="tag-pill" href="${withBase('tags.html?name='+encodeURIComponent(t))}">#${t}</a>`).join('');
    document.querySelector('#tagPills').innerHTML = pills;
  }

  function renderBreadcrumb(fm) {
    const bc = document.querySelector('#breadcrumb');
    const name = fm.title || document.title || '';
    bc.innerHTML = `木子AI » ${name}`;
  }

  (async function () {
    const y = document.querySelector('#year'); if (y) y.textContent = new Date().getFullYear();

    const slug = getSlug();
    if (!slug) { document.querySelector('#articleBody').innerHTML = '<p style="color:#999">缺少 slug 参数。</p>'; return; }

    let fm = {}, html = '';

    // 先尝试 HTML
    try {
      const raw = await fetchText(`content/posts/${slug}.html`);
      const ex = extractFM(raw);
      fm = ex.fm || {};
      html = ex.body || raw;
      document.querySelector('#articleBody').innerHTML = html;
      renderMeta(fm);
      renderBreadcrumb(fm);
      renderTOC();
      return;
    } catch (e) {}

    // 再尝试 Markdown
    try {
      const raw = await fetchText(`content/posts/${slug}.md`);
      const ex = extractF
