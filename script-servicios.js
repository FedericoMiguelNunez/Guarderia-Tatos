const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
const cambio = document.getElementById("cambiar");
const navBar = document.querySelector('.icon-bar');
const nav = document.querySelector('.nav');
const Home = document.getElementById('Home');
const navQuienesSomos = document.querySelector('#Nav-Quienes_somos');
const requisitos = document.getElementById("requisitos")
const apuntamos = document.querySelector('.apuntamos')




navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})

window.addEventListener('scroll', () => {

    if (nav.classList.contains('active-nav')) {

        nav.classList.remove('active-nav');
    }
});
