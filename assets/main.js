// === main.js - 首页与全局逻辑 ===

// 全局加载导航栏
async function loadNavbar() {
  try {
    const res = await fetch('/plus/content/data/navigation.json');
    const navData = await res.json();
    const navbar = document.getElementById('navbar-links');
    navbar.innerHTML = '';

    navData.forEach((menu) => {
      const navItem = document.createElement('div');
      navItem.classList.add('nav-item');
      navItem.textContent = menu.title;

      const dropdown = document.createElement('div');
      dropdown.classList.add('dropdown');

      menu.submenus.forEach((sub) => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = sub;
        dropdown.appendChild(link);
      });

      navItem.appendChild(dropdown);
      navbar.appendChild(navItem);
    });
  } catch (err) {
    console.error('导航加载失败:', err);
  }
}

// 加载推荐区文章
async function loadRecommendations() {
  try {
    const res = await fetch('/plus/content/posts/index.json');
    const posts = await res.json();
    const container = document.getElementById('recommend-grid');
    container.innerHTML = '';

    const latest = posts.slice(0, 4);
    latest.forEach((post) => {
      const card = document.createElement('div');
      card.classList.add('recommend-card');
      card.innerHTML = `
        <img src="${post.cover}" alt="${post.title}">
        <div>
          <h3><a href="/plus/article.html?id=${post.id}">${post.title}</a></h3>
          <p class="recommend-meta">${post.date} · 阅读量 <span id="busuanzi_value_page_pv">--</span></p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error('推荐区加载失败:', e);
  }
}

// 加载文章列表 + 分页
async function loadArticles(page = 1, perPage = 5) {
  try {
    const res = await fetch('/plus/content/posts/index.json');
    const posts = await res.json();
    const list = document.getElementById('article-list');
    const pagination = document.getElementById('pagination');
    list.innerHTML = '';
    pagination.innerHTML = '';

    const start = (page - 1) * perPage;
    const pagePosts = posts.slice(start, start + perPage);
    pagePosts.forEach((post) => {
      const card = document.createElement('div');
      card.classList.add('article-card');
      card.innerHTML = `
        <img src="${post.cover}" class="article-thumb" alt="${post.title}">
        <div class="article-content">
          <h2 class="article-title"><a href="/plus/article.html?id=${post.id}">${post.title}</a></h2>
          <p class="article-excerpt">${post.excerpt}</p>
          <div class="article-meta">${post.date} · 阅读量 <span id="busuanzi_value_page_pv">--</span></div>
          <div class="article-tags">
            ${post.tags.map(tag => `<span>#${tag}</span>`).join('')}
          </div>
        </div>
      `;
      list.appendChild(card);
    });

    // 分页按钮
    const totalPages = Math.ceil(posts.length / perPage);
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.classList.toggle('active', i === page);
      btn.onclick = () => loadArticles(i, perPage);
      pagination.appendChild(btn);
    }
  } catch (err) {
    console.error('文章加载失败:', err);
  }
}

// 搜索功能
function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', async (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    const res = await fetch('/plus/content/posts/index.json');
    const posts = await res.json();
    const list = document.getElementById('article-list');
    list.innerHTML = '';

    const filtered = posts.filter((p) => p.title.toLowerCase().includes(keyword));
    filtered.forEach((post) => {
      const card = document.createElement('div');
      card.classList.add('article-card');
      card.innerHTML = `
        <img src="${post.cover}" class="article-thumb">
        <div class="article-content">
          <h2 class="article-title"><a href="/plus/article.html?id=${post.id}">${post.title}</a></h2>
          <p class="article-excerpt">${post.excerpt}</p>
          <div class="article-meta">${post.date}</div>
        </div>
      `;
      list.appendChild(card);
    });
  });
}

// 初始化函数
document.addEventListener('DOMContentLoaded', () => {
  loadNavbar();
  loadRecommendations();
  loadArticles();
  setupSearch();
});
