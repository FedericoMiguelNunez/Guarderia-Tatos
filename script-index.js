const errorNombre = document.getElementsByClassName("Error-nombre")[0];
errorNombre.style.display = "none";
const errorMichi = document.getElementsByClassName("Error-michi")[0];
errorMichi.style.display = "none";
const caracterMichi = document.getElementsByClassName('Error-caracter-michi')[0]
caracterMichi.style.display = "none"
const caracterNombe =  document.getElementsByClassName('Error-caracter-nombre')[0]
caracterNombe.style.display = "none";
function Saludo(event) {
    event.preventDefault();
            const nombre = document.getElementById("Nombre").value;
            const gato = document.getElementById('Michi').value;
            if (nombre.length < 1 ){
                
                errorNombre.style.display = "block";
                caracterNombe.style.display = 'none'
                errorMichi.style.display = "none";
                caracterMichi.style.display = 'none'

            }
            else if(nombre.length > 15){
                caracterNombe.style.display = 'block';
                errorMichi.style.display = 'none';
                errorNombre.style.display = 'none';
                caracterMichi.style.display = 'none';
              
            }
            
            else if(gato.length < 1){
                errorMichi.style.display = "block";
                errorNombre.style.display = "none";
                caracterMichi.style.display = 'none'
                caracterNombe.style.display = 'none';
            }
        
            else if(gato.length > 15){
                caracterMichi.style.display = 'block';
                errorMichi.style.display = 'none';
                errorNombre.style.display = 'none';
                caracterNombe.style.display = 'none';
            }
         
            else{
          
            window.location.href = `Guarderia-Tatos.html?nombre=${nombre}&gato=${gato}`;
        }
        }
        
        const Continuar = document.getElementById("continuar");
        Continuar.addEventListener("click", Saludo);