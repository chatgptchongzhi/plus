/* ========== main.js - 首页逻辑 ========== */

/**
 * 功能：
 * 1. 自动加载 /content/posts/ 下的文章列表（JSON or Markdown FrontMatter）
 * 2. 自动渲染推荐区（最新4篇）
 * 3. 支持分页、搜索
 * 4. 兼容 busuanzi 阅读统计
 */

const POSTS_PATH = "./plus/content/posts/";
const POSTS_PER_PAGE = 5;
let allPosts = [];
let currentPage = 1;

/* ---------- 初始化 ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadPosts();
  renderRecommend();
  renderPage();
  setupSearch();
});

/* ---------- 加载文章元数据 ---------- */
async function loadPosts() {
  try {
    const response = await fetch(`${POSTS_PATH}index.json`);
    allPosts = await response.json();
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (err) {
    console.error("❌ 无法加载文章数据", err);
    allPosts = [];
  }
}

/* ---------- 渲染推荐区（最新4篇） ---------- */
function renderRecommend() {
  const box = document.getElementById("recommend-grid");
  if (!box || allPosts.length === 0) return;

  const latest = allPosts.slice(0, 4);
  box.innerHTML = latest
    .map(
      (p) => `
      <div class="card" onclick="location.href='article.html?slug=${p.slug}'">
        <img src="${p.cover}" alt="${p.title}">
        <div class="info">
          <h3>${p.title}</h3>
          <div class="meta">${p.date} · ${p.views || 0} 次阅读</div>
        </div>
      </div>
    `
    )
    .join("");
}

/* ---------- 渲染分页文章列表 ---------- */
function renderPage(page = 1) {
  currentPage = page;
  const list = document.getElementById("articleList");
  const pag = document.getElementById("pagination");
  if (!list) return;

  const start = (page - 1) * POSTS_PER_PAGE;
  const end = start + POSTS_PER_PAGE;
  const posts = allPosts.slice(start, end);

  list.innerHTML = posts
    .map(
      (p) => `
      <div clas
