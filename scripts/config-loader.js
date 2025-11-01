// 从 JSON 动态加载全局配置（微信号、邮箱、文案等）
// 兼容本地 file:// 与 GitHub Pages 部署环境

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 自动判断路径前缀（GitHub Pages 会带仓库名）
    const basePath = window.location.hostname.includes('github.io')
      ? `${window.location.pathname.split('/')[1] ? '/' + window.location.pathname.split('/')[1] + '/' : '/'}data/`
      : 'data/';

    // 动态加载配置文件
    const site = await fetch(`${basePath}site.json`).then(r => {
      if (!r.ok) throw new Error(`无法加载 site.json (${r.status})`);
      return r.json();
    });

    const contact = await fetch(`${basePath}contact.json`).then(r => {
      if (!r.ok) throw new Error(`无法加载 contact.json (${r.status})`);
      return r.json();
    });

    // 设置页脚邮箱
    const footerEmail = document.querySelector('footer p:nth-child(2)');
    if (footerEmail && contact.email)
      footerEmail.innerHTML = `联系邮箱：<a href="mailto:${contact.email}">${contact.email}</a>`;

    // 替换 Logo
    const logo = document.querySelector('.logo');
    if (logo && site.siteName) logo.textContent = site.siteName;

    // 替换微信二维码（同时适配侧边栏和悬浮按钮）
    const wechatImgs = document.querySelectorAll('.sidebar .contact img, .wechat-float img');
    wechatImgs.forEach(img => {
      if (contact.wechat_qr) img.src = contact.wechat_qr;
    });

  } catch (err) {
    console.warn('⚠️ 配置加载失败：', err);
    const errBox = document.createElement('div');
    errBox.textContent = '⚠️ 配置加载失败，请检查 data/*.json 文件路径或格式';
    errBox.style = 'position:fixed;bottom:20px;right:20px;background:#ffdddd;color:#900;padding:8px 12px;border-radius:6px;z-index:9999;font-size:13px;';
    document.body.appendChild(errBox);
  }
});
