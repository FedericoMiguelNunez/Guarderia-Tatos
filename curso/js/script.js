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
