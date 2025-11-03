/* ========== article.js - 文章详情页逻辑 ========== */

/**
 * 功能：
 * 1. 根据 URL 参数（slug）加载对应 Markdown 文件
 * 2. 解析 front matter (title, date, tags, category)
 * 3. 自动渲染文章正文、目录（TOC）
 * 4. 更新阅读量统计（busuanzi）
 */

document.addEventListener("DOMContentLoaded", () => {
  const slug = new URLSearchParams(window.location.search).get("slug");
  if (!slug) {
    document.getElementById("articleMarkdown").innerHTML = "<p>未找到指定文章。</p>";
    return;
  }
  loadArticle(slug);
});

/* ---------- 加载并解析文章 ---------- */
async function loadArticle(slug) {
  try {
    const res = await fetch(`content/posts/${slug}.md`);
    const text = await res.text();
    const { frontMatter, content } = parseFrontMatter(text);

    // 更新标题、日期、分类、微信号
    document.title = `${frontMatter.title} - 木子AI`;
    document.getElementById("articleTitle").textContent = frontMatter.title;
    document.getElementById("articleDate").textContent = frontMatter.date || "";
    document.getElementById("articleCategory").textContent = frontMatter.category || "未分类";
    document.getElementById("articleCategoryLink").textContent = frontMatter.category || "未分类";
    document.getElementById("articleCategoryLink").href = `/tags/${frontMatter.category || ""}`;
    document.getElementById("wechatId").textContent = "muzi_ai";
    document.getElementById("articleTitlePath").textContent = frontMatter.title;

    // 渲染标签
    const tagContainer = document.getElementById("articleTags");
    if (frontMatter.tags && frontMatter.tags.length > 0) {
      tagContainer.innerHTML = frontMatter.tags
        .map((tag) => `<span>#${tag}</span>`)
        .join("");
    }

    // 渲染正文
    const md = marked.parse(content);
    document.getElementById("articleMarkdown").innerHTML = md;

    // 生成目录
    generateTOC();

  } catch (err) {
    console.error("❌ 加载文章失败", err);
    document.getElementById("articleMarkdown").innerHTML = "<p>文章加载失败。</p>";
  }
}

/* ---------- 解析 Front Matter ---------- */
function parseFrontMatter(text) {
  const regex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = text.match(regex);
  if (!match) return { frontMatter: {}, content: text };

  const yamlPart = match[1];
  const content = match[2];
  const frontMatter = {};

  yamlPart.split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length > 0) {
      const value = rest.join(":").trim();
      if (value.startsWith("[") && value.endsWith("]")) {
        frontMatter[key.trim()] = value
          .replace(/[\[\]"]/g, "")
          .split(",")
          .map((v) => v.trim());
      } else {
        frontMatter[key.trim()] = value;
      }
    }
  });

  return { frontMatter, content };
}

/* ---------- 自动生成目录 TOC ---------- */
function generateTOC() {
  const article = document.getElementById("articleMarkdown");
  const toc = document.getElementById("tocList");
  if (!article || !toc) return;

  const headings = article.querySelectorAll("h2, h3");
  if (headings.length === 0) {
    toc.innerHTML = "<p>暂无小节</p>";
    return;
  }

  toc.innerHTML = Array.from(headings)
    .map((h) => {
      const id = h.textContent.replace(/\s+/g, "-");
      h.id = id;
      const indent = h.tagName === "H3" ? "margin-left:16px;" : "";
      return `<a href="#${id}" style="${indent}">${h.textContent}</a>`;
    })
    .join("");
}

/* ---------- 使用 marked.js 渲染 Markdown ---------- */
const markedScript = document.createElement("script");
markedScript.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
document.head.appendChild(markedScript);
