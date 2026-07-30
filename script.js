document.addEventListener('DOMContentLoaded', function() {
  // Preload important background images (fixed typos)
  const images = [
    'imagenes/fondo-home-movile.webp',
    'imagenes/fondo-home-movile-dos.webp',
    'imagenes/fondo-home-movile-tres.webp',
    'imagenes/fondo-home-movile-cuatro.webp',
    'imagenes/fondo-home-movile-cinco.webp',
    'imagenes/fondo-home.webp',
    'imagenes/fondo-home-dos.webp',
    'imagenes/fondo-home-tres.webp',
    'imagenes/fondo-home-cuatro.webp',
    'imagenes/fondo-home-cinco.webp'
  ];
  images.forEach(image => {
    const img = new Image();
    img.src = image;
  });

  // Accordion and controls
  const items = document.querySelectorAll('.acordeon-item');
  const btnmostraracordeon = document.querySelector('.mostra_acordeon');
  const acordeon = document.querySelector('.acordeon');
  const acordeonSeVe = document.querySelector('.acordeon-seve');

  // Safe guard for show/hide button
  if (btnmostraracordeon && acordeon && acordeonSeVe) {
    btnmostraracordeon.addEventListener('click', () => {
      const isShown = getComputedStyle(acordeon).display !== 'none';
      acordeon.style.display = isShown ? 'none' : 'block';
      btnmostraracordeon.textContent = !isShown ? 'Ocultar ' : 'Ver mas ';
      // keep layout unchanged; margin kept identical but this preserves intended behavior
      acordeonSeVe.style.margin = '0px auto 0px';
    });
  }

  // Enhance each accordion item for accessibility and keyboard support
  items.forEach((item, index) => {
    // role/button and keyboard focus
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-expanded', 'false');

    const content = item.nextElementSibling;
    if (content) {
      const contentId = content.id || `acordeon-content-${index + 1}`;
      content.id = contentId;
      item.setAttribute('aria-controls', contentId);
      content.setAttribute('role', 'region');
      content.setAttribute('aria-hidden', 'true');
      content.style.display = 'none';
    }

    function toggle() {
      const isActive = item.classList.toggle('active');
      const icon = item.querySelector('i');
      const expanded = isActive;
      item.setAttribute('aria-expanded', expanded.toString());
      if (content) {
        content.style.display = expanded ? 'flex' : 'none';
        content.setAttribute('aria-hidden', (!expanded).toString());
      }
      if (icon) {
        icon.classList.toggle('fa-plus');
        icon.classList.toggle('fa-minus');
      }
    }

    item.addEventListener('click', toggle);
    item.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
});
