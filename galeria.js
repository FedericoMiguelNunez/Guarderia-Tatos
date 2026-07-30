(function(){
  // Lightweight defensive checks and accessibility improvements for the gallery lightbox
  const images = document.querySelectorAll('.img');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeButton = document.getElementById('close');
  const prevButton = document.getElementById('prev');
  const nextButton = document.getElementById('next');
  let currentIndex = 0;
  let touchStartX = 0;

  if (!images.length || !lightbox || !lightboxImg) return; // nothing to do

  images.forEach(function(img, index) {
    img.setAttribute('role', 'button');
    img.setAttribute('tabindex', '0');
    img.setAttribute('aria-label', img.alt || `Imagen ${index + 1}`);
    img.addEventListener('click', function() {
      openLightbox(index);
    });
    img.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(index);
      }
    });
  });

  function openLightbox(index) {
    currentIndex = index;
    showImage(currentIndex);
    lightbox.style.display = 'flex';
    lightbox.setAttribute('aria-hidden', 'false');
    if (closeButton) closeButton.focus();
  }

  function showImage(index) {
    if (!images[index]) return;
    lightboxImg.src = images[index].src;
    lightboxImg.alt = images[index].alt || `Imagen ${index + 1}`;
  }

  function showNextImage() {
    currentIndex = (currentIndex + 1) % images.length;
    showImage(currentIndex);
  }

  function showPrevImage() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    showImage(currentIndex);
  }

  if (closeButton) {
    closeButton.addEventListener('click', function() {
      lightbox.style.display = 'none';
      lightbox.setAttribute('aria-hidden', 'true');
    });
  }

  function closeLightbox() {
    if (lightbox) {
      lightbox.style.display = 'none';
      lightbox.setAttribute('aria-hidden', 'true');
    }
  }

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      closeLightbox();
    }
    if (event.key === 'ArrowLeft') {
      showPrevImage();
    } else if (event.key === 'ArrowRight') {
      showNextImage();
    }
  });

  if (lightboxImg) {
    lightboxImg.addEventListener('touchstart', function(event) {
      touchStartX = event.touches[0].clientX;
    });

    lightboxImg.addEventListener('touchend', function(event) {
      var touchEndX = event.changedTouches[0].clientX;
      var threshold = 50; // Ajusta este valor según sea necesario
      if (touchStartX - touchEndX > threshold) {
        showNextImage();
      } else if (touchEndX - touchStartX > threshold) {
        showPrevImage();
      }
    });
  }

  if (nextButton) nextButton.addEventListener('click', showNextImage);
  if (prevButton) prevButton.addEventListener('click', showPrevImage);
})();
