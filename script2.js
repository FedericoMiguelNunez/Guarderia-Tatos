const cambio = document.getElementById("cambiar");
const DondeTuGato = document.getElementById("donde-tu-gato");
const Recibimos = document.getElementById("p-recibimos");
const requisitos = document.getElementById("requisitos")
const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
const navBar = document.querySelector('.icon-bar');
const nav = document.querySelector('.nav');
const servicios = document.getElementById('servicios');
const navQuienesSomos = document.querySelector('#Nav-Quienes_somos');

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

    const DondeTuGato = document.getElementById("donde-tu-gato");

}
else {
    cambio.innerHTML = `¡Bienvenidos a Guarderia Tatos!`;

}
navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})
window.addEventListener('scroll', () => {

    if (nav.classList.contains('active-nav')) {

        nav.classList.remove('active-nav');
    }
});