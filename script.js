

const items = document.querySelectorAll('.acordeon-item');
var btnmostraracordeon = document.querySelector('.mostra_acordeon');
var acordeon = document.querySelector('.acordeon');
var acordeonSeVe = document.querySelector('.acordeon-seve')
 
document.addEventListener("DOMContentLoaded", function() {
    const images = [
      'imagenes/fondo-home-movile.webp',
      'imagenes/fondo-home-movile-dos.webp',
      'imagenes/fondo-home-movile-tres.webp',
      'imagenes/fondo-home-movile-cuatro.webp',
      'imagenes/fondo-home-movile-cinco.webp',
      'imagenes/fondo-home.webp)',
      'imagenes/fondo-home-dos.webp',
      'imagenes/fondo-home-tres.webp',
        'imagenes/fondo-home-cuatro.webp',
        'imagenes/fondo-home-cinco.webp'

    ];
    images.forEach(image => {
      const img = new Image();
      img.src = image;
    });
  });



btnmostraracordeon.addEventListener("click",()=>{
    acordeon.style.display=acordeon.style.display==="block"?"none":"block";
    btnmostraracordeon.innerHTML=acordeon.style.display==="block"?"Ocultar ":"Ver mas ";
    acordeonSeVe.style.margin=acordeon.style.display==='block'?'0px auto 0px':'0px auto 0px';
   
})
items.forEach(item => {
    item.addEventListener('click', function() {
        // Alterna la clase 'active' para mostrar u ocultar el contenido
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        content.style.display = content.style.display === 'flex' ? 'none' : 'flex';
        // Alterna el icono entre '+' y '-'
        const icon = this.querySelector('i');
        if (this.classList.contains('active')) {
            
            icon.classList.remove('fa-plus');
            icon.classList.add('fa-minus');
        } else {
            
            icon.classList.remove('fa-minus');
            icon.classList.add('fa-plus');
        }
    });
});

