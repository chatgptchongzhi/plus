// assets/wechat-float.js
(function () {
  function esc(s){return (s??'').toString().replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

  // 读取站点配置（失败也不阻塞）
  fetch((window.PREFIX||'/plus/') + 'content/site.json', {cache:'no-store'})
    .then(r => r.ok ? r.json() : ({}))
    .catch(()=>({}))
    .then(site => {
      // 已经存在就不重复挂
      if (document.querySelector('.wechat-float')) return;

      const cfg = site.wechat || {};
      const pos = cfg.position || { right: 35, bottom: 150 };
      const icon = cfg.icon || '';
      const qr   = cfg.qrcode || '';
      const txt  = cfg.text || ('微信：' + (site.wechatId || ''));

      // 样式（只注入一次）
      if (!document.getElementById('wx-float-style')) {
        const css = `
.wechat-float{position:fixed;z-index:2147483647;right:${pos.right||35}px;bottom:${pos.bottom||150}px;width:56px;height:56px;border-radius:50%;background:#09bb07;box-shadow:0 6px 20px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none}
.wechat-float img.icon{max-width:56px;max-height:56px;border-radius:50%;display:block}
.wechat-float .fallback{color:#fff;font-size:14px;font-weight:700;letter-spacing:1px}
.wechat-float .qr{position:absolute;right:64px;bottom:0;width:311px;height:403px;background:#fff;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:10px;display:none}
.wechat-float .qr img{width:100%;height:100%;object-fit:contain;display:block}
.wechat-float.show .qr{display:block}
@media(max-width:768px){.wechat-float{right:20px;bottom:100px}}
        `.trim();
        const s = document.createElement('style');
        s.id = 'wx-float-style';
        s.textContent = css;
        document.head.appendChild(s);
      }

      // 容器
      const wrap = document.createElement('div');
      wrap.className = 'wechat-float';

      // 图标或文字
      if (icon) {
        const im = document.createElement('img');
        im.className = 'icon';
        im.alt = 'WeChat';
        im.src = icon;
        im.onerror = () => { im.remove(); addFallback(); };
        wrap.appendChild(im);
      } else {
        addFallback();
      }
      function addFallback(){
        const t = document.createElement('span');
        t.className = 'fallback';
        t.textContent = '微信';
        wrap.appendChild(t);
      }

      // 二维码
      const panel = document.createElement('div');
      panel.className = 'qr';
      panel.innerHTML = qr ? `<img src="${qr}" alt="${esc(txt)}">`
                           : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#888;">未配置二维码</div>`;
      wrap.appendChild(panel);

      // 交互：PC 悬停、移动端点击
      let touchMode = false;
      wrap.addEventListener('mouseenter', () => { if (!touchMode) wrap.classList.add('show'); });
      wrap.addEventListener('mouseleave', () => { if (!touchMode) wrap.classList.remove('show'); });
      wrap.addEventListener('click', () => { touchMode = true; wrap.classList.toggle('show'); });

      document.body.appendChild(wrap);
    });
})();
