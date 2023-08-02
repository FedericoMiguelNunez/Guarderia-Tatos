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

    H2HomePrincipal.innerHTML = `El hogar ideal para ${gato} .Le ofrecemos un ambiente seguro  y cariñoso, con atención personalizada y juegos divertidos . Contamos con instalaciones seguras y espacios gatificados . Goza de tu ausencia que tu michi esta en buenas manos`

}
else {
    cambio.innerHTML = `¡Bienvenidos a Guarderia Tatos!`;
    H2HomePrincipal.innerHTML = `El hogar ideal para tu michi consentido.Le ofrecemos un ambiente seguro  y cariñoso, con atención personalizada y juegos divertidos . Contamos con instalaciones seguras y espacios gatificados . Goza de tu ausencia que tu michi esta en buenas manos`

}
navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})
window.addEventListener('scroll', () => {

    if (nav.classList.contains('active-nav')) {

        nav.classList.remove('active-nav');
    }
});
function iniciarMap(){
    var coord = {lat: -34.6266254,lng: -58.5076332};
    var map = new google.maps.Map(document.getElementById('map'),{
      zoom: 15,
      center: coord
    });
    var marker = new google.maps.Marker({
      position: coord,
      map: map
    });
}