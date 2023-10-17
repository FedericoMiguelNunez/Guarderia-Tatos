const cambio = document.getElementById("cambiar");
const DondeTuGato = document.getElementById("donde-tu-gato");
const Home = document.getElementById('Home');
const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
const navBar = document.querySelector('.icon-bar');
const nav = document.querySelector('.nav');
const servicios = document.getElementById('servicios');
const navQuienesSomos = document.querySelector('#Nav-Quienes_somos');
const cambiarSub = document.getElementsByClassName('main-subtitulo')[0];
const texto =  document.querySelectorAll('.texto');
const ver = document.querySelectorAll('.ver')
const aumentar = document.querySelectorAll('.aumentar')



Home.addEventListener('click', function(){
    const HomeRedirigidos = 'Guarderia-Tatos.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href    = HomeRedirigidos
})

servicios.addEventListener('click', function () {
    const serviciosRedirigidos = 'servicios.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = serviciosRedirigidos;
})

navQuienesSomos.addEventListener('click', () => {
    const QuienesSomosRedirigidos = 'Quienes-somos.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = QuienesSomosRedirigidos;
})

if (gato != null && nombre != null && gato != "" && nombre != "") {
    cambio.innerHTML = `¡Requisitos que debe tener ${gato}!`;
    cambiarSub.innerHTML = `En Guarderia Tatos sabemos que cuidar del bienestar de ${gato} es una prioridad tanto para ustedes cómo para nosotros. 
    Para garantizar un ambiente sano y seguro cada pensionado debe cumplir con los siguientes requisitos sanitarios.`;

   

}
else {
    cambio.innerHTML = `¡Requisitos que debe tener tu Michi!`;
    cambiarSub.innerHTML = `En Guarderia Tatos sabemos que cuidar del bienestar de tu Michi es una prioridad tanto para ustedes cómo para nosotros. 
    Para garantizar un ambiente sano y seguro cada pensionado debe cumplir con los siguientes requisitos sanitarios.`;

}

navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})
window.addEventListener('scroll', () => {

    if (nav.classList.contains('active-nav')) {

        nav.classList.remove('active-nav');
    }
});

texto.forEach(texto=>{
    texto.style.display = 'none'
})
ver.forEach((elemento)=>{
    const texto = elemento.nextElementSibling;
    const aumentar = elemento.parentElement;
    elemento.addEventListener('click',()=>{
if(texto.style.display === 'none' || texto.style.display === ''){
    texto.style.display = 'block'
    elemento.textContent = 'Ver menos';
    aumentar.style.height ='750px'
}
else{
    texto.style.display = 'none';
      elemento.textContent = 'Ver más';
      aumentar.style.height ='400px'
}
    })
})