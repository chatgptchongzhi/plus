async function loadArticle() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const res = await fetch('./content/text.json');
  const data = await res.json();
  const article = data.articles.find(a => a.id == id);

  if (!article) return document.getElementById('article-content').textContent = '未找到该文章。';

  const key = `views_${id}`;
  let count = parseInt(localStorage.getItem(key) || 0) + 1;
  localStorage.setItem(key, count);

  document.title = `${article.title} - 木子AI`;
  document.getElementById('breadcrumb').textContent = `当前位置： 首页 » ${article.category} » ${article.title}`;
  document.getElementById('article-content').innerHTML = `
    <h1>${article.title}</h1>
    <p class="article-meta">📅 ${article.date} ｜ 👁️ ${count} 阅读</p>
    <img src="./images/${article.cover}" style="width:100%;border-radius:10px;margin:20px 0;">
    <div>${article.content}</div>
  `;
}
loadArticle();
