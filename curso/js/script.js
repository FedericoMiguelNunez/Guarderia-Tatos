const btnMostrarTemario = document.getElementById('ver-temario');

btnMostrarTemario.addEventListener('click', () => {
    const temario = document.querySelector('.temario');
    if (temario.style.display === 'block') {
        temario.style.display = 'none';
        btnMostrarTemario.textContent = 'Ver temario';
    } else {
        temario.style.display = 'block';
        btnMostrarTemario.textContent = 'Ocultar temario';
    }

});
window.ityped.init(document.querySelector('.tipeado'),{
    strings:['Seguro', 'Estimulado', 'Sano', 'respetuoso'],
        loop : true
    
    
})
window.onload = function() {
    // Configuración inicial del tiempo en segundos (4 horas, 27 minutos y 14 segundos)
    let tiempoRestante = 4 * 3600 + 27 * 60 + 14;

    // Referencias a los elementos del contador
    const horasElemento = document.getElementById('horas');
    const minutosElemento = document.getElementById('minutos');
    const segundosElemento = document.getElementById('segundos');

    // Función para actualizar el contador
    function actualizarContador() {
        if (tiempoRestante <= 0) {
            clearInterval(intervalo);
            return;
        }

        tiempoRestante--;

        const horas = Math.floor(tiempoRestante / 3600);
        const minutos = Math.floor((tiempoRestante % 3600) / 60);
        const segundos = tiempoRestante % 60;

        horasElemento.textContent = String(horas).padStart(2, '0');
        minutosElemento.textContent = String(minutos).padStart(2, '0');
        segundosElemento.textContent = String(segundos).padStart(2, '0');
    }

    // Actualizar el contador cada segundo
    const intervalo = setInterval(actualizarContador, 1000);
}
document.querySelectorAll('.acordeon-header').forEach(button => {
    button.addEventListener('click', () => {
        const acordeonContent = button.nextElementSibling;
        const flecha = button.querySelector('.flecha');

        if (acordeonContent.style.display === 'block') {
            acordeonContent.style.display = 'none';
            flecha.innerHTML = '&#9660;';
        } else {
            acordeonContent.style.display = 'block';
            flecha.innerHTML = '&#9650;';
        }
    });
});
