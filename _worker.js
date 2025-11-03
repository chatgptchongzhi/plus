export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理 /assets 下的文件 —— 按原样返回
    if (url.pathname.startsWith("/assets/")) {
      return fetch(url.origin + url.pathname);
    }

    // 处理 /admin 下的文件 —— 返回 admin/index.html
    if (url.pathname.startsWith("/admin")) {
      return fetch(url.origin + "/admin/index.html");
    }

    // 其他路径按默认行为（返回首页）
    return fetch(url.origin + "/index.html");
  },
};
