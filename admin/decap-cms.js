/* decap-cms local proxy loader */
var s=document.createElement("script");
s.src="https://r2.muzi-ai.top/decap-cms-2.10.192.js";  // ✅ 国内镜像，托管在 Cloudflare R2
s.onload=function(){CMS&&CMS.init();};
s.onerror=function(){document.body.innerHTML="<h2 style='color:red;text-align:center;margin-top:40px;'>Decap CMS加载失败</h2>";};
document.body.appendChild(s);
