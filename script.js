
const Continuar = document.getElementById("continuar");
function Saludo(event) {
    event.preventDefault();
    console.log("anda todo bien");
    const nombre = document.getElementById("Nombre").value;
    cambio.innerHTML = `hola${nombre}`;
  
}
Continuar.addEventListener("click", Saludo);
