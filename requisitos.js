const cambiarSub = document.getElementsByClassName('main-subtitulo')[0];
const texto =  document.querySelectorAll('.texto');
const ver = document.querySelectorAll('.ver')
const aumentar = document.querySelectorAll('.aumentar')
texto.forEach(texto=>{
    texto.style.display = 'none'
})
ver.forEach((elemento)=>{
    const texto = elemento.nextElementSibling;
    const aumentar = elemento.parentElement;
    elemento.addEventListener('click',()=>{
if(texto.style.display === 'none' || texto.style.display === ''){
    texto.style.display = 'block'
    elemento.textContent = 'Ver menos';
    aumentar.style.height ='850px'
}
else{
    texto.style.display = 'none';
      elemento.textContent = 'Ver más';
      aumentar.style.height ='400px'
}
    })
})