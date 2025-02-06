// Inicializar Realtime Database y Storage
const db = firebase.database();
const storage = firebase.storage();

// Función para agregar un producto con imagen
async function agregarProducto(nombre, precio, stock, imagen) {
  try {
    // Subir imagen a Firebase Storage
    const storageRef = storage.ref(`imagenes/${imagen.name}`);
    await storageRef.put(imagen);
    const imagenURL = await storageRef.getDownloadURL();

    // Agregar producto a Realtime Database
    const newProductRef = db.ref('productos').push();
    await newProductRef.set({
      nombre: nombre,
      precio: precio,
      stock: stock,
      imagenURL: imagenURL
    });
    console.log("Producto agregado con ID: ", newProductRef.key);
  } catch (e) {
    console.error("Error al agregar producto: ", e);
  }
}

// Función para actualizar un producto
async function actualizarProducto(productId, nombre, precio, stock, imagen) {
  const productoRef = db.ref('productos/' + productId);
  try {
    let imagenURL;
    if (imagen) {
      // Subir nueva imagen a Firebase Storage
      const storageRef = storage.ref(`imagenes/${imagen.name}`);
      await storageRef.put(imagen);
      imagenURL = await storageRef.getDownloadURL();
    }

    // Actualizar producto en Realtime Database
    await productoRef.update({
      nombre: nombre,
      precio: precio,
      stock: stock,
      ...(imagenURL && { imagenURL: imagenURL })
    });
    console.log("Producto actualizado");
  } catch (e) {
    console.error("Error al actualizar producto: ", e);
  }
}

// Función para cargar productos
async function cargarProductos() {
  const productosRef = db.ref('productos');
  productosRef.on('value', (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const childData = childSnapshot.val();
      console.log(`${childSnapshot.key} => ${childData.nombre}, ${childData.precio}, ${childData.stock}, ${childData.imagenURL}`);
    });
  });
}

// Manejador del formulario
document.getElementById('producto-form').addEventListener('submit', function(event) {
  event.preventDefault();
  const nombre = document.getElementById('nombre').value;
  const precio = document.getElementById('precio').value;
  const stock = document.getElementById('stock').value;
  const imagen = document.getElementById('imagen').files[0];
  agregarProducto(nombre, precio, stock, imagen);
});

// Ejemplo de uso
// agregarProducto("Producto 1", 100, 10, archivoImagen);
// cargarProductos();
// actualizarProducto("ID_DEL_PRODUCTO", "Nuevo Nombre", 150, 5, nuevoArchivoImagen);