const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
const cambio = document.getElementById("cambiar");
const requisitos = document.getElementById("requisitos")
const Recibimos = document.getElementById("p-recibimos");
const AyelenText = document.getElementById("ayelen-Text");
const navBar = document.querySelector('.icon-bar');
const nav = document.querySelector('.nav');
const Home = document.getElementById('Home');
const servicios = document.getElementById('servicios');
const VerAye = document.getElementById('ver-aye');
const Ayelen = document.querySelector('.ayelen');
const verFede = document.querySelector('#ver-fede');
const Federico = document.querySelector('.federico');
const verApo = document.getElementById('ver-apo');
const Apolo = document.querySelector('.apolo');
const VerGalo = document.querySelector('#ver-galo');
const Galo = document.querySelector('.galo');
const fedeText = document.querySelector('.fede-text');
const  apoloText = document.querySelector('.apolo-text');
const galoText = document.querySelector('.galo-text');





Home.addEventListener('click', function(){
    const HomeRedirigidos = 'Guarderia-Tatos.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = HomeRedirigidos
})

servicios.addEventListener('click', function(){
    const serviciosRedirigidos = 'servicios.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = serviciosRedirigidos;
})

requisitos.addEventListener('click', () => {
    const RequisitosRedirigido = 'requisitos.html' + '?gato=' + encodeURI(gato || '') + '&nombre=' + encodeURI(nombre || '');
    window.location.href = RequisitosRedirigido;
}
)
if (gato != null && nombre != null && gato != "" && nombre != "") {
    cambio.innerHTML = `¿Quienes cuidaran de ${gato}?`;

    
    AyelenText.innerHTML = `Es la persona encargada de ser tu punto de contacto principal. Ella te mantendrá informado/a sobre cómo está pasando los días ${gato}, proporcionándote informacion detallada y actualizada. Ademas es creadora de contenido y quien se encarga de administra nuestras redes sociales, compartiendo fotos y videos adorables y divertidas de los michis pensionados.`;
}
else {
    cambio.innerHTML = `¿Quienes cuidaremos de tu Michi?`;
    
    AyelenText.innerHTML = `Es la persona encargada de ser tu punto de contacto principal. Ella te mantendrá informado/a sobre cómo está pasando los días tu michi, proporcionándote informacion detallada y actualizada. Ademas es creadora de contenido y quien se encarga de administra nuestras redes sociales, compartiendo fotos y videos adorables y divertidas de los michis pensionados.`;

}
VerAye.addEventListener('click', () => {
    if (AyelenText.style.display === 'none' || AyelenText.style.display === '') {
      AyelenText.style.display = 'block';
      Ayelen.style.height = '720px'; // Puedes ajustar la altura según sea necesario
      VerAye.innerHTML = 'Ver menos';
    } else {
      AyelenText.style.display = 'none';
      Ayelen.style.height = '400px'; // 
      VerAye.innerHTML = 'Ver más';
    }
  });
  verFede.addEventListener('click', () => {
    if (fedeText.style.display === 'none' || fedeText.style.display === '') {
      fedeText.style.display = 'block';
      Federico.style.height = '720px'; // 
      verFede.innerHTML = 'Ver menos';
    } else {
      fedeText.style.display = 'none';
      Federico.style.height = '400px'; // 
      verFede.innerHTML = 'Ver más';
    }
  });
  verApo.addEventListener('click', () => {
    if (apoloText.style.display === 'none' || apoloText.style.display === '') {
      apoloText.style.display = 'block';
      Apolo.style.height = '720px'; // 
      verApo.innerHTML = 'Ver menos';
    } else {
      apoloText.style.display = 'none';
      Apolo.style.height = '400px'; // 
      verApo.innerHTML = 'Ver más';
    }
  });
  VerGalo.addEventListener('click', () => {
    if (galoText.style.display === 'none' || galoText.style.display === '') {
      galoText.style.display = 'block';
      Galo.style.height = '720px'; // 
      VerGalo.innerHTML = 'Ver menos';
    } else {
      galoText.style.display = 'none';
      Galo.style.height = '400px'; // 
      VerGalo.innerHTML = 'Ver más';
    }
  });

navBar.addEventListener('click', () => {

    nav.classList.toggle('active-nav')
})
window.addEventListener('scroll', () => {
    
    if (nav.classList.contains('active-nav')) {
      
        nav.classList.remove('active-nav');
    }
});

