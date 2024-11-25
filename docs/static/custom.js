document.querySelectorAll('.block').forEach(block => {
  block.addEventListener('mouseover', () => {
    block.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  });
  block.addEventListener('mouseout', () => {
    block.style.boxShadow = 'none';
  });
});