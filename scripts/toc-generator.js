// 自动生成目录
document.addEventListener("DOMContentLoaded", () => {
  const content = document.getElementById("markdown-content");
  const tocList = document.getElementById("toc-list");
  if (!content || !tocList) return;

  const headings = content.querySelectorAll("h2, h3");
  headings.forEach(h => {
    const id = h.textContent.trim().replace(/\s+/g, "-");
    h.setAttribute("id", id);
    const li = document.createElement("li");
    li.innerHTML = `<a href="#${id}">${h.textContent}</a>`;
    tocList.appendChild(li);
  });
});
