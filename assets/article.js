document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (!slug) return;

  fetch("content/data.json")
    .then(res => res.json())
    .then(data => {
      const article = data.articles.find(a => a.slug === slug);
      if (!article) return;

      document.getElementById("title").textContent = article.title;
      document.getElementById("meta").textContent = `${article.author} · ${article.date} · ${article.category}`;
      document.getElementById("cover").src = article.cover;
      document.getElementById("content").innerHTML = article.content;
      document.title = `${article.title} - 拼账号`;
    });
});
