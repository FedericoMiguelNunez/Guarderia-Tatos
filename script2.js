const cambio = document.getElementById("cambiar");
const DondeTuGato = document.getElementById("donde-tu-gato");
const pRecibimos = document.getElementById("p-recibimos");
const AyelenText = document.getElementById("ayelen-Text");
const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
const navBar = document.querySelector('.icon-bar');
const nav = document.querySelector('.nav');

cambio.innerHTML = `¡Bienvenidos  ${nombre} y ${gato}!`;
DondeTuGato.innerHTML = `Hogar donde a ${gato} es parte de la familia`;
pRecibimos.innerHTML = `Recibir a ${gato} en nuestro hogar requiere de trabajo en equipo constante, por eso, cada quien tiene un roll que cumplir.`
AyelenText.innerHTML = `Es la persona encargada de ser tu punto de contacto principal. Ella te mantendrá informado/a sobre cómo está pasando los días ${gato}, proporcionándote informacion detallada y actualizada. Ademas es creadora de contenido y quien se encarga de administra nuestras redes sociales, compartiendo fotos y videos adorables y divertidas de los michis pensionados.`

navBar.addEventListener('click',()=>{
    navBar.classList.toggle('rotate-icon-bar')
    nav.classList.toggle('active-nav')
})