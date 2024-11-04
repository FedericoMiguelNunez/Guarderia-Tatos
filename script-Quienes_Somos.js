

const VerAye = document.getElementById('ver-aye');
const Ayelen = document.querySelector('.ayelen');
const verFede = document.querySelector('#ver-fede');
const Federico = document.querySelector('.federico');
const verApo = document.getElementById('ver-apo');
const Apolo = document.querySelector('.apolo');
const VerGalo = document.querySelector('#ver-galo');
const Galo = document.querySelector('.galo');
const AyelenText = document.querySelector('#ayelen-Text');
const fedeText = document.querySelector('.fede-text');
const  apoloText = document.querySelector('.apolo-text');
const galoText = document.querySelector('.galo-text');



VerAye.addEventListener('click', () => {
    if (AyelenText.style.display === 'none' || AyelenText.style.display === '') {
      AyelenText.style.display = 'block';
      Ayelen.style.height = '720px'; // Puedes ajustar la altura según sea necesario
      VerAye.innerHTML = 'Ver menos';
    } else {
      AyelenText.style.display = 'none';
      Ayelen.style.height = '400px'; // 
      VerAye.innerHTML = 'Ver más';
    }
  });
  verFede.addEventListener('click', () => {
    if (fedeText.style.display === 'none' || fedeText.style.display === '') {
      fedeText.style.display = 'block';
      Federico.style.height = '720px'; // 
      verFede.innerHTML = 'Ver menos';
    } else {
      fedeText.style.display = 'none';
      Federico.style.height = '400px'; // 
      verFede.innerHTML = 'Ver más';
    }
  });
  verApo.addEventListener('click', () => {
    if (apoloText.style.display === 'none' || apoloText.style.display === '') {
      apoloText.style.display = 'block';
      Apolo.style.height = '720px'; // 
      verApo.innerHTML = 'Ver menos';
    } else {
      apoloText.style.display = 'none';
      Apolo.style.height = '400px'; // 
      verApo.innerHTML = 'Ver más';
    }
  });
  VerGalo.addEventListener('click', () => {
    if (galoText.style.display === 'none' || galoText.style.display === '') {
      galoText.style.display = 'block';
      Galo.style.height = '720px'; // 
      VerGalo.innerHTML = 'Ver menos';
    } else {
      galoText.style.display = 'none';
      Galo.style.height = '400px'; // 
      VerGalo.innerHTML = 'Ver más';
    }
  });



