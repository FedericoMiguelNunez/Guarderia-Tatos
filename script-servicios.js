const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
const cambio = document.getElementById("cambiar");
const navBar = document.querySelector('.icon-bar');
const nav = document.querySelector('.nav');
const Home = document.getElementById('Home');
const HomeRedirigidos = Home.getAttribute('href') + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
Home.href = HomeRedirigidos
navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})
if (gato != "" || nombre != "") {
    cambio.innerHTML = `Servicios para ${gato}`;

}
else {
    cambio.innerHTML = `Servicios Tatos`;


}
