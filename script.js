const cambio = document.getElementById("cambiar");
const DondeTuGato = document.getElementById("donde-tu-gato");
const H2HomePrincipal = document.getElementById("h2-home-prin")
const requisitos = document.getElementById("requisitos")
const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
const navBar = document.querySelector('.icon-bar');
const nav = document.querySelector('.nav');
const servicios = document.getElementById('servicios');
const navQuienesSomos = document.querySelector('#Nav-Quienes_somos');
const images = document.querySelectorAll(".img");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const closeButton = document.getElementById("close");
const prevButton = document.getElementById("prev");
const nextButton = document.getElementById("next");
var currentIndex = 0;
var touchStartX = 0;
const items = document.querySelectorAll('.acordeon-item');
var btnmostraracordeon = document.querySelector('.mostra_acordeon');
var acordeon = document.querySelector('.acordeon');
var acordeonSeVe = document.querySelector('.acordeon-seve')
 


navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})
window.addEventListener('scroll', () => {

    if (nav.classList.contains('active-nav')) {

        nav.classList.remove('active-nav');
    }
});
images.forEach(function(img, index) {
    img.addEventListener("click", function() {
        openLightbox(index);
    });
});

function openLightbox(index) {
    currentIndex = index;
    showImage(currentIndex);
    lightbox.style.display = "flex";}
    
function showImage(index) {
    lightboxImg.src = images[index].src;
}

function showNextImage() {
    currentIndex = (currentIndex + 1) % images.length;
    showImage(currentIndex);
}

function showPrevImage() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    showImage(currentIndex);
}

closeButton.addEventListener("click", function() {
    lightbox.style.display = "none";
});
function closeLightbox() {
    lightbox.style.display = "none";
}

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape" || event.key === "Esc") {
        closeLightbox();
    }
});
document.addEventListener("keydown", function(event) {
    if (event.key === "ArrowLeft") {
        showPrevImage();
    } else if (event.key === "ArrowRight") {
        showNextImage();
    }
});

lightboxImg.addEventListener("touchstart", function(event) {
    touchStartX = event.touches[0].clientX;
});

lightboxImg.addEventListener("touchend", function(event) {
    var touchEndX = event.changedTouches[0].clientX;
    var threshold = 50; // Ajusta este valor según sea necesario
    if (touchStartX - touchEndX > threshold) {
        showNextImage();
    } else if (touchEndX - touchStartX > threshold) {
        showPrevImage();
    }
});
nextButton.addEventListener("click", showNextImage);
prevButton.addEventListener("click", showPrevImage);

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
//maps
