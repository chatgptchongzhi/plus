async function loadPosts() {
  const res = await fetch('./content/posts/index.json');
  const posts = await res.json();
  const featuredContainer = document.getElementById('featured-posts');
  const listContainer = document.getElementById('post-list');
  const paginationContainer = document.getElementById('pagination');
  const perPage = 5, featuredCount = 4;
  let currentPage = 1;

  featuredContainer.innerHTML = posts.slice(0, featuredCount).map(post => `
    <div class="featured-card">
      <a href="./article.html?slug=${post.slug}">
        <img src="${post.cover}" alt="${post.title}">
        <h3>${post.title}</h3>
      </a>
      <p>${post.excerpt}</p>
      <small>阅读：<span id="busuanzi_value_page_pv"></span></small>
    </div>`).join('');

  function renderPage(page) {
    const start = featuredCount + (page - 1) * perPage;
    const pagePosts = posts.slice(start, start + perPage);
    listContainer.innerHTML = pagePosts.map(post => `
      <div class="post-card">
        <a href="./article.html?slug=${post.slug}">
          <h3>${post.title}</h3>
        </a>
        <p>${post.excerpt}</p>
        <div class="tags">${post.tags.map(tag => `<a href="?tag=${encodeURIComponent(tag)}" class="tag">#${tag}</a>`).join('')}</div>
      </div>`).join('');

    const totalPages = Math.ceil((posts.length - featuredCount) / perPage);
    paginationContainer.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      if (i === page) btn.classList.add('active');
      btn.onclick = () => renderPage(i);
      paginationContainer.appendChild(btn);
    }
  }

  renderPage(currentPage);
}
document.addEventListener('DOMContentLoaded', loadPosts);
