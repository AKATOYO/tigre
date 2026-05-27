// ==========================================
// ⚠️ SECURITY WARNING ⚠️
// 1. Ensure SUPABASE_KEY is your 'anon' (public) key, NOT a 'service_role' key.
//    Service role keys bypass Row Level Security (RLS) and give users full admin access!
// 2. Client-side password checking (admin123) is highly insecure. 
//    Anyone can view the source code and bypass it. Use Supabase Auth for production.
// ==========================================

const SUPABASE_URL = 'https://yliohprzqxzpyyrpvlvh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaW9ocHJ6cXh6cHl5cnB2bHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTIyNTcsImV4cCI6MjA5MTc2ODI1N30.vvWoWAnHbfmZMEDWTKV8aGs6OsTKjpMam1h2OXVCjQI'; // VERIFY THIS IS YOUR ANON KEY!

// If using ES Modules, uncomment the following line and comment out the CDN script:
// import { createClient } from '@supabase/supabase-js';
// const client = createClient(SUPABASE_URL, SUPABASE_KEY);

// If using CDN, ensure `supabase` is globally available
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
});

let productos = [];
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

// DOM Elements
const productosDiv = document.getElementById("productos");
const detalleCarrito = document.getElementById("detalle-carrito");
const subtotalEl = document.getElementById("subtotal");
const ivaEl = document.getElementById("iva");
const totalEl = document.getElementById("total");
const contador = document.getElementById("contador");
const carritoPanel = document.getElementById("carrito");
const overlay = document.getElementById("overlay");
const toastDiv = document.getElementById("toast");
const btnCarrito = document.getElementById("btnCarrito");
const btnAdmin = document.getElementById("btnAdmin");
const busqueda = document.getElementById("busqueda");
const filtroCategoria = document.getElementById("filtroCategoria");
const numCot = document.getElementById("numCot");
const adminModal = document.getElementById("adminModal");
const formProducto = document.getElementById("formProducto");
const adminLista = document.getElementById("adminLista");
const btnTop = document.getElementById("btnTop");

// Added previously missing DOM elements to prevent Null Reference Errors
const nombreCliente = document.getElementById("nombreCliente");
const telefonoCliente = document.getElementById("telefonoCliente");
const observacionesCliente = document.getElementById("observacionesCliente");

// Event Listeners
btnCarrito.addEventListener("click", toggleCarrito);
overlay.addEventListener("click", toggleCarrito); // Close cart when clicking overlay
btnAdmin.addEventListener("click", toggleAdmin);
busqueda.addEventListener("input", filtrarProductos);
filtroCategoria.addEventListener("change", filtrarProductos);
formProducto.addEventListener("submit", agregarProductoDB); // Changed to match the actual function name
window.addEventListener('scroll', () => {
    btnTop.style.display = window.scrollY > 300 ? "block" : "none";
});
btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Initialize
window.onload = () => {
    numCot.textContent = "Cotización #" + Date.now().toString().slice(-6);
    cargarProductos();
    actualizarCarrito();
};

// --- PRODUCTS LOGIC ---
async function cargarProductos() {
    productosDiv.innerHTML = "<p>Cargando productos...</p>";

    const { data, error } = await client
        .from("productos")
        .select(`id, categoria, nombre, descripcion, precio, imagen_url`)
        .order("categoria", { ascending: true })
        .order("nombre", { ascending: true });

    if (error) {
        productosDiv.innerHTML = "<p>Error cargando productos.</p>";
        console.error(error);
        return;
    }

    productos = data || [];
    cargarCategorias();
    renderProductos(productos);
}

function cargarCategorias() {
    const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
    filtroCategoria.innerHTML = `
        <option value="">Todas las categorías</option>
        ${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
    `;
}

function renderProductos(lista) {
    if (!lista.length) {
        productosDiv.innerHTML = "<p>No hay productos disponibles.</p>";
        return;
    }

    productosDiv.innerHTML = lista.map(p => `
        <div class="producto">
            <div class="img-container">
                <img src="${p.imagen_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${p.nombre}" loading="lazy">
            </div>
            <div class="producto-info">
                <span class="categoria-badge">${p.categoria || 'Sin categoría'}</span>
                <h3>${p.nombre}</h3>
                <p>${p.descripcion || ''}</p>
                <strong>${money.format(p.precio || 0)}</strong>
                <button onclick="agregar(${p.id})">Agregar</button>
            </div>
        </div>
    `).join('');
}

function filtrarProductos() {
    const txt = busqueda.value.toLowerCase();
    const categoria = filtroCategoria.value;

    const filtrados = productos.filter(p => {
        const coincideTexto = p.nombre?.toLowerCase().includes(txt) || p.descripcion?.toLowerCase().includes(txt) || p.categoria?.toLowerCase().includes(txt);
        const coincideCategoria = !categoria || p.categoria === categoria;
        return coincideTexto && coincideCategoria;
    });

    renderProductos(filtrados);
}

// --- CART LOGIC ---
function agregar(id) {
    const p = productos.find(x => x.id === id);
    if (!p) return;

    const item = carrito.find(x => x.id === id);
    if (item) {
        item.cantidad++;
    } else {
        carrito.push({ ...p, cantidad: 1 });
    }
    guardar();
    toast("Producto agregado al carrito");
}

function actualizarCarrito() {
    let subtotal = 0;

    detalleCarrito.innerHTML = carrito.map((p, i) => {
        const total = p.precio * p.cantidad;
        subtotal += total;
        return `
            <tr>
                <td>${p.nombre}<br><small>${p.categoria || ''}</small></td>
                <td>
                    <button onclick="cambiar(${i},-1)">-</button>
                    ${p.cantidad}
                    <button onclick="cambiar(${i},1)">+</button>
                </td>
                <td>${money.format(total)}</td>
                <td><button class="btn-danger" onclick="eliminar(${i})">✕</button></td>
            </tr>
        `;
    }).join('');

    // Note: IVA is hardcoded at 0.19 (19%). If tax rates vary by product, 
    // you should add an 'iva_rate' column to your database instead.
    const iva = subtotal * 0.19;
    const total = subtotal + iva;

    subtotalEl.textContent = money.format(subtotal);
    ivaEl.textContent = money.format(iva);
    totalEl.textContent = money.format(total);
    contador.textContent = carrito.reduce((a, b) => a + b.cantidad, 0);
}

function cambiar(i, n) {
    carrito[i].cantidad += n;
    if (carrito[i].cantidad <= 0) carrito.splice(i, 1);
    guardar();
}

function eliminar(i) {
    carrito.splice(i, 1);
    guardar();
}

function vaciarCarrito() {
    if(confirm("¿Estás seguro de vaciar el carrito?")) {
        carrito = [];
        guardar();
    }
}

function guardar() {
    localStorage.setItem("carrito", JSON.stringify(carrito));
    actualizarCarrito();
}

function toggleCarrito() {
    const isVisible = carritoPanel.classList.toggle("visible");
    if (isVisible) {
        overlay.classList.add("active");
    } else {
        overlay.classList.remove("active");
    }
}

function enviarWhatsApp() {
    if (!carrito.length) return toast("Carrito vacío");
    
    // Safe checking for DOM elements in case they are missing
    const nombre = nombreCliente ? nombreCliente.value.trim() : "";
    const telefono = telefonoCliente ? telefonoCliente.value.trim() : "";
    const obs = observacionesCliente ? observacionesCliente.value.trim() : "";

    if (!nombre) return toast("Por favor, ingrese su nombre");

    let msg = `*PEDIDO*\n`;
    msg += `Cliente: ${nombre}\n`;
    msg += `Teléfono: ${telefono}\n`;
    msg += `Observaciones: ${obs}\n\n`;

    carrito.forEach(p => {
        msg += `• ${p.nombre} (${p.categoria || 'General'}) x${p.cantidad} = ${money.format(p.precio * p.cantidad)}\n`;
    });

    msg += `\nTOTAL: ${totalEl.textContent}`;
    
    // Encode the entire URI component to prevent special characters/line breaks from breaking the link
    const encodedMsg = encodeURIComponent(msg);
    window.open(`https://wa.me/573192654225?text=${encodedMsg}`);
}

// --- ADMIN LOGIC ---
function toggleAdmin() {
    const isActive = adminModal.classList.toggle("active");
    if (isActive) {
        // WARNING: Client-side password check is insecure. Replace with Supabase Auth in production.
        const pass = prompt("Ingrese contraseña de administrador:");
        if (pass !== "admin123") { 
            toast("Contraseña incorrecta");
            adminModal.classList.remove("active");
            return;
        }
        renderAdminList();
    }
}

function renderAdminList() {
    adminLista.innerHTML = productos.map(p => `
        <div class="admin-item">
            <div class="admin-item-info">
                <strong>${p.nombre}</strong> - ${money.format(p.precio)}<br>
                <small>${p.categoria || 'Sin categoría'}</small>
            </div>
            <button class="btn-danger" onclick="eliminarProductoDB(${p.id})">Eliminar</button>
        </div>
    `).join('');
}

async function agregarProductoDB(e) {
    e.preventDefault();
    
    const nuevoProducto = {
        nombre: document.getElementById("adminNombre").value,
        categoria: document.getElementById("adminCategoria").value,
        descripcion: document.getElementById("adminDesc").value,
        precio: parseFloat(document.getElementById("adminPrecio").value),
        imagen_url: document.getElementById("adminImagen").value || null
    };

    const { data, error } = await client.from("productos").insert([nuevoProducto]);
    
    if (error) {
        toast("Error al agregar producto");
        console.error(error);
    } else {
        toast("Producto agregado exitosamente");
        formProducto.reset();
        cargarProductos(); // Refresh catalog
        renderAdminList(); // Refresh admin list
    }
}

async function eliminarProductoDB(id) {
    if (!confirm("¿Eliminar este producto de la base de datos?")) return;

    const { error } = await client.from("productos").delete().eq("id", id);
    
    if (error) {
        toast("Error al eliminar producto");
        console.error(error);
    } else {
        toast("Producto eliminado");
        cargarProductos();
        renderAdminList();
    }
}

// --- UTILITIES ---
function toast(msg) {
    toastDiv.textContent = msg;
    toastDiv.classList.add("show");
    setTimeout(() => { toastDiv.classList.remove("show"); }, 2000);
}
