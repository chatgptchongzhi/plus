document.addEventListener('DOMContentLoaded', () => {
  // 防闪退的下拉菜单延迟隐藏
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    let timer;
    item.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      const dropdown = item.querySelector('.dropdown');
      if (dropdown) dropdown.style.display = 'flex';
    });
    item.addEventListener('mouseleave', () => {
      const dropdown = item.querySelector('.dropdown');
      timer = setTimeout(() => {
        if (dropdown) dropdown.style.display = 'none';
      }, 200);
    });
  });

  // 搜索框事件（演示）
  const searchBox = document.querySelector('.search-box input');
  if (searchBox) {
    searchBox.addEventListener('keypress', e => {
      if (e.key === 'Enter') alert(`搜索关键词：${e.target.value}`);
    });
  }

  // 分页按钮模拟
  const pagination = document.querySelectorAll('.pagination a');
  pagination.forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      pagination.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
