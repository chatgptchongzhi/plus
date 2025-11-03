document.addEventListener("DOMContentLoaded", () => {
  const articleContainer = document.getElementById("articles");
  fetch("content/data.json")
    .then(res => res.json())
    .then(data => {
      data.articles.forEach(article => {
        const card = document.createElement("div");
        card.className = "article-card";
        card.innerHTML = `
          <img src="${article.cover}" alt="${article.title}">
          <div class="info">
            <h2>${article.title}</h2>
            <p>${article.summary}</p>
            <p style="font-size:13px;color:#999;">${article.date}</p>
            <a href="article.html?slug=${article.slug}" class="read-more">阅读全文 »</a>
          </div>
        `;
        articleContainer.appendChild(card);
      });
      document.getElementById("about-text").textContent = data.about;
    });

  // 移动端菜单
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
});
