/* assets/article.js —— 仅加载 HTML 文章：content/posts/<slug>.html */
(function () {
  const $ = (s) => document.querySelector(s);

  // 取 URL 参数 slug
  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");

  if (!slug) {
    $("#article").innerHTML = `<p class="empty">未指定文章 slug。</p>`;
    return;
  }

  async function fetchText(path) {
    const res = await fetch(withBase(path), { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    return res.text();
  }

  // 修正相对路径（img/src、a/href）→ 补上 /plus/ 前缀
  function fixRelativeLinks(scope) {
    scope.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (src && !/^https?:|^data:|^mailto:|^#/.test(src)) {
        img.setAttribute("src", withBase(src.replace(/^\.?\//, "")));
      }
    });
    scope.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && !/^https?:|^data:|^mailto:|^#/.test(href)) {
        a.setAttribute("href", withBase(href.replace(/^\.?\//, "")));
      }
    });
  }

  function buildTOC() {
    // 目录（可选；page 已引入 tocbot 时生效）
    if (window.tocbot) {
      try {
        tocbot.init({
          tocSelector: "#toc",
          contentSelector: "#article",
          headingSelector: "h1,h2,h3",
          collapseDepth: 6,
        });
      } catch {}
    }
  }

  async function loadArticle() {
    const htmlPath = `content/posts/${slug}.html`;

    try {
      const html = await fetchText(htmlPath);
      $("#article").innerHTML = html;
      fixRelativeLinks($("#article"));
      buildTOC();
      return;
    } catch (e) {
      $("#article").innerHTML = `
        <p class="empty">未找到本文内容，请确认文件
        <code>${htmlPath}</code> 是否存在。</p>`;
    }
  }

  loadArticle();
})();
