function getSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug');
}

async function loadArticle() {
  const slug = getSlug();
  if (!slug) return;

  const res = await fetch(`./content/posts/${slug}.md`);
  const text = await res.text();

  const fmMatch = /^---([\s\S]*?)---/.exec(text);
  let metadata = {};
  let content = text;

  if (fmMatch) {
    const yaml = fmMatch[1].trim().split('\n');
    yaml.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      metadata[key.trim()] = valueParts.join(':').trim();
    });
    content = text.replace(fmMatch[0], '');
  }

  const html = marked.parse(content);
  document.getElementById('article-content').innerHTML = `
    <h1>${metadata.title || '未命名文章'}</h1>
    <p class="meta">📅 ${metadata.date || '未知'} | 👁 <span id="busuanzi_value_page_pv"></span></p>
    <div class="article-body">${html}</div>
    <div class="tags">
      ${(metadata.tags || '')
        .split(',')
        .map(tag => `<a href="./index.html?tag=${encodeURIComponent(tag.trim())}" class="tag">#${tag.trim()}</a>`)
        .join('')}
    </div>
  `;

  generateTOC();

  document.getElementById('page-title').textContent = `${metadata.title} - 木子AI`;
  document.getElementById('meta-desc').content = content.slice(0, 120).replace(/\n/g, '');
  document.getElementById('meta-keywords').content = (metadata.tags || 'ChatGPT,Sora,AI');
}

function generateTOC() {
  const article = document.querySelector('.article-body');
  const toc = document.getElementById('toc');
  const headers = article.querySelectorAll('h2, h3');
  toc.innerHTML = '';
  headers.forEach(header => {
    const id = header.textContent.trim().replace(/\s+/g, '-');
    header.id = id;
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = header.textContent;
    link.className = header.tagName === 'H2' ? 'toc-h2' : 'toc-h3';
    toc.appendChild(link);
  });
}
document.addEventListener('DOMContentLoaded', loadArticle);
