const container = document.getElementById('articles-container');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
let currentPage = 1;
const perPage = 4;
let articles = [];

async function loadArticles() {
  const res = await fetch('./content/text.json');
  const data = await res.json();
  articles = data.articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  renderPage();
}

function renderPage() {
  const start = (currentPage - 1) * perPage;
  const pageArticles = articles.slice(start, start + perPage);
  container.innerHTML = pageArticles.map(article => `
    <div class="article-card" onclick="location.href='./article.html?id=${article.id}'">
      <img src="./images/${article.cover}" alt="${article.title}">
      <div class="article-info">
        <h3>${article.title}</h3>
        <p>${article.summary}</p>
        <p class="article-meta">📅 ${article.date} ｜ 👁️ ${getViewCount(article.id)} 阅读</p>
      </div>
    </div>
  `).join('');

  pageInfo.textContent = `第 ${currentPage} 页 / 共 ${Math.ceil(articles.length / perPage)} 页`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= Math.ceil(articles.length / perPage);
}

prevBtn.onclick = () => { currentPage--; renderPage(); };
nextBtn.onclick = () => { currentPage++; renderPage(); };

function getViewCount(id) {
  const key = `views_${id}`;
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, Math.floor(Math.random() * 300 + 50));
  }
  return localStorage.getItem(key);
}

loadArticles();
