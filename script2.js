const cambio = document.getElementById("cambiar");
const params = new URLSearchParams(window.location.search);
const nombre = params.get('nombre');
const gato = params.get('gato');
cambio.innerHTML = `¡Bienvenidos <br> ${nombre} y ${gato}!`;