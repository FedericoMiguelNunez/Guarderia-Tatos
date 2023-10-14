const errorNombre = document.getElementsByClassName("Error-nombre")[0];
errorNombre.style.display = "none";
const errorMichi = document.getElementsByClassName("Error-michi")[0];
errorMichi.style.display = "none";
function Saludo(event) {
    event.preventDefault();
            const nombre = document.getElementById("Nombre").value;
            const gato = document.getElementById('Michi').value;
            if (nombre.length < 1 ){
                
                errorNombre.style.display = "block";
                errorMichi.style.display = "none";
            }
            else if(gato.length < 1){
                errorMichi.style.display = "block";
                errorNombre.style.display = "none";
            }
            else{
          
            window.location.href = `Guarderia-Tatos.html?nombre=${nombre}&gato=${gato}`;
        }
        }
        
        const Continuar = document.getElementById("continuar");
        Continuar.addEventListener("click", Saludo);