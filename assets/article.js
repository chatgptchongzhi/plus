// === article.js - 文章详情页逻辑 ===

// 从 URL 参数获取 id
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// 加载文章
async function loadArticle() {
  const articleId = getQueryParam('id');
  if (!articleId) return;

  const res = await fetch(`/plus/content/posts/${articleId}.md`);
  const markdown = await res.text();
  const contentEl = document.getElementById('article-content');

  // 转换为 HTML
  contentEl.innerHTML = marked.parse(markdown);

  // 自动生成目录
  generateTOC();
}

// 生成目录 TOC
function generateTOC() {
  const toc = document.getElementById('toc');
  const headers = document.querySelectorAll('#article-content h2, #article-content h3');
  toc.innerHTML = '';
  headers.forEach((h) => {
    const link = document.createElement('a');
    const id = h.textContent.replace(/\s+/g, '-');
    h.id = id;
    link.href = `#${id}`;
    link.textContent = h.textContent;
    toc.appendChild(link);
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadNavbar();
  loadArticle();
});
