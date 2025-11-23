document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('.character-buttons a');
  if (!links.length) return;

  // Compare by filename so relative path / directories don't break
  const currentFile = (location.pathname.split('/').pop() || '').toLowerCase();

  links.forEach(a => {
    const href = a.getAttribute('href') || '';
    const hrefFile = href.split('/').pop().toLowerCase();
    if (hrefFile && hrefFile === currentFile) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
});
