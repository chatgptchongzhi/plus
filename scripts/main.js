// 主交互脚本
document.addEventListener("DOMContentLoaded", () => {
  // 下拉菜单防闪退
  document.querySelectorAll(".nav-item").forEach(item => {
    let timeout;
    item.addEventListener("mouseenter", () => {
      clearTimeout(timeout);
      const dropdown = item.querySelector(".dropdown");
      if (dropdown) dropdown.style.display = "block";
    });
    item.addEventListener("mouseleave", () => {
      const dropdown = item.querySelector(".dropdown");
      if (dropdown)
        timeout = setTimeout(() => (dropdown.style.display = "none"), 200);
    });
  });

  // 微信悬浮二维码
  const wechatFloat = document.querySelector(".wechat-float");
  if (wechatFloat) {
    const qr = document.createElement("div");
    qr.classList.add("wechat-popup");
    qr.innerHTML = `<img src="/plus/images/wechat-qrcode.png" alt="微信二维码">`;
    Object.assign(qr.style, {
      position: "absolute",
      right: "80px",
      bottom: "80px",
      width: "311px",
      height: "403px",
      display: "none",
      zIndex: "9999"
    });
    document.body.appendChild(qr);

    wechatFloat.addEventListener("mouseenter", () => (qr.style.display = "block"));
    wechatFloat.addEventListener("mouseleave", () => (qr.style.display = "none"));
  }

  // 分页按钮演示逻辑（可扩展）
  const pagination = document.querySelector(".pagination");
  if (pagination) {
    pagination.addEventListener("click", e => {
      if (e.target.tagName === "BUTTON") {
        document.querySelectorAll(".pagination button").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
      }
    });
  }
});
