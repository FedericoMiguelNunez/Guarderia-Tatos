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

Home.addEventListener('click', function () {
    const HomeRedirigidos = 'Guarderia-Tatos.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = HomeRedirigidos
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
navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})

window.addEventListener('scroll', () => {

    if (nav.classList.contains('active-nav')) {

        nav.classList.remove('active-nav');
    }
});
if (gato !== "" && nombre !== "" && gato !== null && nombre !== null) {
    cambio.innerHTML = `Servicios para ${gato}`;
    apuntamos.innerHTML = `Sabemos que ${gato} merece lo mejor, por eso, ofrecemos un servicio completo para satisfacer todas sus necesidades.  Te mostramos en detalle como hacemos que su experiencia sea extraordinaria.`;

}
else {
    cambio.innerHTML = `Servicios Tatos`;
    apuntamos.innerHTML = `Sabemos que tu Michi merece lo mejor, por eso, ofrecemos un servicio completo para satisfacer todas sus necesidades.  Te mostramos en detalle como hacemos que su experiencia sea extraordinaria.`;
}
