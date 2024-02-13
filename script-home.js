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

 
servicios.addEventListener('click', function () {
    const serviciosRedirigidos = 'servicios.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = serviciosRedirigidos;
})

navQuienesSomos.addEventListener('click', () => {
    const QuienesSomosRedirigidos = 'Quienes-somos.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = QuienesSomosRedirigidos;
})

requisitos.addEventListener('click', () => {
    const RequisitosRedirigido = 'requisitos.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = RequisitosRedirigido;
}

)
if (gato != null && nombre != null && gato != "" && nombre != "") {
    cambio.innerHTML = `¡Bienvenidos  ${nombre} y ${gato}!`;

    H2HomePrincipal.innerHTML = `Guardería Tatos es el lugar perfecto si buscas dejar a tu gato ${gato} en un ambiente familiar y seguro, dónde los juegos y mimos son ilimitados, brindamos un entorno con gatificaciones, camitas y rascadores para que se divierta y descanse a gusto. 
    Podés disfrutar tu tiempo lejos sabiendo que tu mascota ${gato} la está pasando excelente y bien cuidado.`

}
else {
    cambio.innerHTML = `¡Bienvenidos a Guarderia Tatos!`;
    H2HomePrincipal.innerHTML = `Guardería Tatos es el lugar perfecto si buscas dejar a tu Michi en un ambiente familiar y seguro, dónde los juegos y mimos son ilimitados, brindamos un entorno con gatificaciones, camitas y rascadores para que se divierta y descanse a gusto. 
    Podés disfrutar tu tiempo lejos sabiendo que tu Michi la está pasando excelente y bien cuidado`

}
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
//maps
