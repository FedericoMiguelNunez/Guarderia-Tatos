const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
const cambio = document.getElementById("cambiar");
const DondeTuGato = document.getElementById("donde-tu-gato");
const Recibimos = document.getElementById("p-recibimos");
const AyelenText = document.getElementById("ayelen-Text");
const navBar = document.querySelector('.icon-bar');
const nav = document.querySelector('.nav');
const Home = document.getElementById('Home');
const servicios = document.getElementById('servicios');


Home.addEventListener('click', function(){
    const HomeRedirigidos = 'Guarderia-Tatos.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href    = HomeRedirigidos
})

servicios.addEventListener('click', function(){
    const serviciosRedirigidos = 'servicios.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = serviciosRedirigidos;
})

if (gato != null && nombre != null && gato != "" && nombre != "") {
    cambio.innerHTML = `¿Quienes cuidaran de ${gato}?`;

    Recibimos.innerHTML = `Recibir a ${gato} en nuestro hogar requiere de trabajo en equipo constante, por eso, cada quien tiene un roll que cumplir.`
    AyelenText.innerHTML = `Es la persona encargada de ser tu punto de contacto principal. Ella te mantendrá informado/a sobre cómo está pasando los días ${gato}, proporcionándote informacion detallada y actualizada. Ademas es creadora de contenido y quien se encarga de administra nuestras redes sociales, compartiendo fotos y videos adorables y divertidas de los michis pensionados.`
}
else {
    cambio.innerHTML = `¿Quienes cuidaremos de tu Michi?`;
    DondeTuGato.innerHTML = `Hogar donde tu michi es parte de la familia`;
    AyelenText.innerHTML = `Es la persona encargada de ser tu punto de contacto principal. Ella te mantendrá informado/a sobre cómo está pasando los días tu michi, proporcionándote informacion detallada y actualizada. Ademas es creadora de contenido y quien se encarga de administra nuestras redes sociales, compartiendo fotos y videos adorables y divertidas de los michis pensionados.`;

}
navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})
window.addEventListener('scroll', () => {
    
    if (nav.classList.contains('active-nav')) {
      
        nav.classList.remove('active-nav');
    }
});