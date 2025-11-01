// 从 JSON 动态加载全局配置，如微信号、邮箱、文案等
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const site = await fetch('data/site.json').then(r => r.json());
    const contact = await fetch('data/contact.json').then(r => r.json());

    // 设置页脚邮箱
    const footerEmail = document.querySelector('footer p:nth-child(2)');
    if (footerEmail && contact.email) footerEmail.innerHTML = `联系邮箱：${contact.email}`;

    // 替换 Logo
    const logo = document.querySelector('.logo');
    if (logo && site.siteName) logo.textContent = site.siteName;

    // 替换微信二维码
    const wechat = document.querySelector('.sidebar .contact img, .wechat-float img');
    if (wechat && contact.wechat_qr) wechat.src = contact.wechat_qr;

  } catch (err) {
    console.warn('配置加载失败：', err);
  }
});
