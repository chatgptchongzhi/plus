// 从 JSON 动态加载配置（适配 GitHub Pages /plus/ 路径）
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const configFiles = [
      "/plus/data/site.json",
      "/plus/data/contact.json",
      "/plus/data/articles.json"
    ];

    const [site, contact, articles] = await Promise.all(
      configFiles.map(f => fetch(f).then(r => r.json()))
    );

    // 设置 Logo
    const logo = document.querySelector(".logo");
    if (logo && site.siteName) logo.textContent = site.siteName;

    // 页脚邮箱
    const footerEmail = document.querySelector("footer p:nth-child(3)");
    if (footerEmail && contact.email)
      footerEmail.innerHTML = `联系邮箱：${contact.email}`;

    // 微信二维码更新
    const wechat = document.querySelector(".wechat-float img");
    if (wechat && contact.wechat_qr) wechat.src = contact.wechat_qr;

    // 推荐文章区
    const recommendGrid = document.querySelector(".recommend-grid");
    if (recommendGrid && articles.length > 0) {
      recommendGrid.innerHTML = articles
        .slice(0, 4)
        .map(
          a => `
        <div class="recommend-item">
          <img src="${a.thumb}" alt="${a.title}">
          <div class="recommend-info">
            <h3>${a.title}</h3>
            <p>📅 ${a.date} ｜ 👁 ${a.views}</p>
          </div>
        </div>`
        )
        .join("");
    }
  } catch (err) {
    console.warn("配置加载失败：", err);
  }
});
