// 自动生成文章目录（TOC）
document.addEventListener("DOMContentLoaded", function () {
  const headings = document.querySelectorAll("article h2, article h3");
  const tocList = document.getElementById("toc-list");
  if (!tocList) return;

  headings.forEach((heading, index) => {
    const id = `section-${index}`;
    heading.id = id;
    const li = document.createElement("li");
    li.innerHTML = `<a href="#${id}">${heading.textContent}</a>`;
    tocList.appendChild(li);
  });
});
