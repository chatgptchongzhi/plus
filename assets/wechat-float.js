// /plus/assets/wechat-float.js
(function () {
  async function getSite() {
    try {
      if (window.SITE && typeof window.SITE === 'object') return window.SITE;
      const u = (typeof url === 'function') ? url('content/site.json') : './content/site.json';
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) throw new Error('site.json load failed');
      const j = await r.json();
      window.SITE = j; // 暴露给全局
      return j;
    } catch (e) {
      console.warn('[wechat-float] cannot load site.json:', e);
      return {};
    }
  }

  function createFloat(site) {
    const qrcode =
      (site && site.wechat && site.wechat.qrcode) ||
      (site && site.wechatQrcode) ||
      '/plus/images/qrcode-wechat.png';

    const icon =
      (site && site.wechat && site.wechat.icon) ||
      '/plus/images/wechat-float.png';

    const text =
      (site && site.wechat && site.wechat.text) ||
      ('微信联系：' + ((site && site.wechatId) || '未配置'));

    const pos = (site && site.wechat && site.wechat.position) || { right: 35, bottom: 150 };

    if (document.querySelector('.wechat-float')) return;

    const wrap = document.createElement('div');
    wrap.className = 'wechat-float';
    wrap.style.right = (pos.right || 35) + 'px';
    wrap.style.bottom = (pos.bottom || 150) + 'px';
    wrap.title = '微信';

    const img = document.createElement('img');
    img.className = 'icon';
    img.alt = '微信';
    img.src = icon;

    const qr = document.createElement('div');
    qr.className = 'qr';

    if (qrcode) {
      const qrImg = document.createElement('img');
      qrImg.alt = '微信二维码';
      qrImg.src = qrcode;
      qr.appendChild(qrImg);
    } else {
      qr.style.display = 'flex';
      qr.style.alignItems = 'center';
      qr.style.justifyContent = 'center';
      qr.style.fontSize = '14px';
      qr.style.color = '#888';
      qr.textContent = '未配置二维码';
    }

    const sr = document.createElement('span');
    sr.className = 'fallback';
    sr.style.display = 'none';
    sr.textContent = text;

    wrap.appendChild(img);
    wrap.appendChild(qr);
    wrap.appendChild(sr);
    document.body.appendChild(wrap);

    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (mobile) {
      wrap.addEventListener('click', () => wrap.classList.toggle('show'));
    } else {
      wrap.addEventListener('mouseenter', () => wrap.classList.add('show'));
      wrap.addEventListener('mouseleave', () => wrap.classList.remove('show'));
    }

    console.log('[wechat-float] mounted with qrcode:', qrcode);
  }

  getSite().then(createFloat);
})();
