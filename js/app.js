// ==========================================
// ⚠️ SECURITY WARNING & CONFIG ⚠️
// 1. En producción, usa variables de entorno (Vite: import.meta.env.VITE_SUPABASE_URL)
// 2. La clave Anon es segura de exponer en el frontend SI Y SOLO SI tienes 
//    Row Level Security (RLS) configurado correctamente en Supabase.
// ==========================================
const CONFIG = {
    SUPABASE_URL: 'https://yliohprzqxzpyyrpvlvh.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaW9ocHJ6cXh6cHl5cnB2bHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTIyNTcsImV4cCI6MjA5MTc2ODI1N30.vvWoWAnHbfmZMEDWTKV8aGs6OsTKjpMam1h2OXVCjQI',
    IVA_RATE: 0.19,
    WHATSAPP_NUMBER: '573192654225'
};

const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
});

// State
let productos = [];
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
let isAdmin = false;

// DOM Elements
const DOM = {
    productos: document.getElementById("productos"),
    detalleCarrito: document.getElementById("detalle-carrito"),
    subtotal: document.getElementById("subtotal"),
    iva: document.getElementById("iva"),
    total: document.getElementById("total"),
    contador: document.getElementById("contador"),
    carrito: document.getElementById("carrito"),
    overlay: document.getElementById("overlay"),
    toast: document.getElementById("toast"),
    busqueda: document.getElementById("busqueda"),
    filtroCategoria: document.getElementById("filtroCategoria"),
    numCot: document.getElementById("numCot"),
    adminModal: document.getElementById("adminModal"),
    formProducto: document.getElementById("formProducto"),
    adminLista: document.getElementById("adminLista"),
    btnTop: document.getElementById("btnTop"),
    nombreCliente: document.getElementById("nombreCliente"),
    telefonoCliente: document.getElementById("telefonoCliente"),
    observacionesCliente: document.getElementById("observacionesCliente"),
    authContainer: document.getElementById("authContainer"),
    adminContainer: document.getElementById("adminContainer"),
    formLogin: document.getElementById("formLogin"),
    adminEmail: document.getElementById("adminEmail")
};

// --- UTILITIES ---
// Previene inyección HTML (XSS) al renderizar productos
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

let toastTimer;
function toast(msg) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => DOM.toast.classList.remove("show"), 2500);
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- AUTH LOGIC ---
async function checkAdminSession() {
    const { data: { session } } = await client.auth.getSession();
    if (session) {
        isAdmin = true;
        showAdminUI(session.user.email);
    } else {
        isAdmin = false;
        showAuthUI();
    }
}

function showAdminUI(email) {
    DOM.authContainer.style.display = 'none';
    DOM.adminContainer.style.display = 'block';
    DOM.adminEmail.textContent = `👤 ${email}`;
}

function showAuthUI() {
    DOM.authContainer.style.display = 'block';
    DOM.adminContainer.style.display = 'none';
}

async function loginAdmin(e) {
    e.preventDefault();
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
        toast("Error: " + error.message);
    } else {
        isAdmin = true;
        toast("Inicio de sesión exitoso");
        showAdminUI(data.user.email);
        renderAdminList();
    }
}

async function logoutAdmin() {
    const { error } = await client.auth.signOut();
    if (error) {
        toast("Error al cerrar sesión");
    } else {
        isAdmin = false;
        toast("Sesión cerrada");
        showAuthUI();
    }
}

client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        isAdmin = true;
        showAdminUI(session.user.email);
    } else if (event === 'SIGNED_OUT') {
        isAdmin = false;
        showAuthUI();
    }
});

// --- PRODUCTS LOGIC ---
async function cargarProductos() {
    DOM.productos.innerHTML = "<p>Cargando productos...</p>";

    const { data, error } = await client
        .from("productos")
        .select("id, categoria, nombre, descripcion, precio, imagen_url")
        .order("categoria", { ascending: true })
        .order("nombre", { ascending: true });

    if (error) {
        DOM.productos.innerHTML = "<p>Error cargando productos.</p>";
        return console.error(error);
    }

    productos = data || [];
    cargarCategorias();
    renderProductos(productos);
    checkDeepLink();
}

function cargarCategorias() {
    const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
    DOM.filtroCategoria.innerHTML = `
        <option value="">Todas las categorías</option>
        ${categorias.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('')}
    `;
}

function renderProductos(lista) {
    if (!lista.length) {
        DOM.productos.innerHTML = "<p>No hay productos disponibles.</p>";
        return;
    }

    DOM.productos.innerHTML = lista.map(p => `
        <div class="producto" data-id="${p.id}" id="producto-${p.id}">
            <div class="img-container">
                <img src="${escapeHTML(p.imagen_url) || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${escapeHTML(p.nombre)}" loading="lazy">
            </div>
            <div class="producto-info">
                <span class="categoria-badge">${escapeHTML(p.categoria) || 'Sin categoría'}</span>
                <h3>${escapeHTML(p.nombre)}</h3>
                <p>${escapeHTML(p.descripcion) || ''}</p>
                <strong>${money.format(p.precio || 0)}</strong>
                
                <div class="producto-actions">
                    <button class="btn-add-cart btn-success" data-id="${p.id}">Agregar</button>
                    <button class="btn-share" data-id="${p.id}">🔗</button>
                    <div class="share-dropdown" id="share-dropdown-${p.id}">
                        <a href="#" class="share-wa" data-id="${p.id}">💬 WhatsApp</a>
                        <a href="#" class="share-fb" data-id="${p.id}">📘 Facebook</a>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

const filtrarProductos = debounce(() => {
    const txt = DOM.busqueda.value.toLowerCase();
    const categoria = DOM.filtroCategoria.value;

    const filtrados = productos.filter(p => {
        const coincideTexto = p.nombre?.toLowerCase().includes(txt) || 
                              p.descripcion?.toLowerCase().includes(txt) || 
                              p.categoria?.toLowerCase().includes(txt);
        const coincideCategoria = !categoria || p.categoria === categoria;
        return coincideTexto && coincideCategoria;
    });

    renderProductos(filtrados);
}, 300);

// --- DEEP LINKING & SHARING LOGIC ---

function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('producto');
    
    if (productId) {
        // Usamos requestAnimationFrame para asegurar que el DOM esté pintado
        requestAnimationFrame(() => {
            const targetProduct = document.getElementById(`producto-${productId}`);
            if (targetProduct) {
                targetProduct.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetProduct.style.boxShadow = "0 0 0 4px var(--primary)";
                setTimeout(() => { targetProduct.style.boxShadow = ""; }, 3000);
            }
        });
    }
}

function toggleShareDropdown(productId) {
    document.querySelectorAll('.share-dropdown.active').forEach(dd => {
        if (dd.id !== `share-dropdown-${productId}`) dd.classList.remove('active');
    });
    
    const dropdown = document.getElementById(`share-dropdown-${productId}`);
    if (dropdown) dropdown.classList.toggle('active');
}

function updateMetaTags(product) {
    const baseUrl = window.location.origin + window.location.pathname;
    const productUrl = `${baseUrl}?producto=${product.id}`;
    
    document.getElementById('og-title')?.setAttribute('content', product.nombre);
    document.getElementById('og-desc')?.setAttribute('content', `${product.descripcion || ''} - ${money.format(product.precio)}`);
    document.getElementById('og-image')?.setAttribute('content', product.imagen_url || '');
    document.getElementById('og-url')?.setAttribute('content', productUrl);
    
    return productUrl;
}

function shareWhatsApp(productId) {
    const p = productos.find(x => String(x.id) === String(productId));
    if (!p) return;

    const productUrl = updateMetaTags(p);
    const texto = `🛍️ ${p.nombre}\n\n${p.descripcion || ''}\n\n💰 Precio: ${money.format(p.precio || 0)}\n\n🔗 ${productUrl}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

// Se eliminó la función duplicada de Facebook y se unificó
function shareFacebook(productId) {
    const p = productos.find(x => String(x.id) === String(productId));
    if (!p) return;
    
    const productUrl = updateMetaTags(p);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`, '_blank');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-share') && !e.target.closest('.share-dropdown')) {
        document.querySelectorAll('.share-dropdown.active').forEach(dd => dd.classList.remove('active'));
    }
});

// --- CART LOGIC ---
function agregarAlCarrito(id) {
    const p = productos.find(x => String(x.id) === String(id));
    if (!p) return;

    const item = carrito.find(x => String(x.id) === String(id));
    if (item) {
        item.cantidad++;
    } else {
        carrito.push({ ...p, cantidad: 1 });
    }
    guardarCarrito();
    toast(`${p.nombre} agregado al carrito`); // Mejor UX
}

function actualizarCarrito() {
    let subtotal = 0;

    if (carrito.length === 0) {
        DOM.detalleCarrito.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tu carrito está vacío</td></tr>`;
    } else {
        DOM.detalleCarrito.innerHTML = carrito.map((p, i) => {
            const total = p.precio * p.cantidad;
            subtotal += total;
            return `
                <tr>
                    <td>${escapeHTML(p.nombre)}<br><small>${escapeHTML(p.categoria) || ''}</small></td>
                    <td>
                        <button class="btn-cantidad" data-index="${i}" data-change="-1">-</button>
                        ${p.cantidad}
                        <button class="btn-cantidad" data-index="${i}" data-change="1">+</button>
                    </td>
                    <td>${money.format(total)}</td>
                    <td><button class="btn-danger btn-eliminar" data-index="${i}">✕</button></td>
                </tr>
            `;
        }).join('');
    }

    const iva = subtotal * CONFIG.IVA_RATE;
    const total = subtotal + iva;

    DOM.subtotal.textContent = money.format(subtotal);
    DOM.iva.textContent = money.format(iva);
    DOM.total.textContent = money.format(total);
    DOM.contador.textContent = carrito.reduce((a, b) => a + b.cantidad, 0);
}

function cambiarCantidad(i, n) {
    carrito[i].cantidad += n;
    if (carrito[i].cantidad <= 0) carrito.splice(i, 1);
    guardarCarrito();
}

function eliminarDelCarrito(i) {
    carrito.splice(i, 1);
    guardarCarrito();
}

function vaciarCarrito() {
    if(confirm("¿Estás seguro de vaciar el carrito?")) {
        carrito = [];
        guardarCarrito();
    }
}

function guardarCarrito() {
    localStorage.setItem("carrito", JSON.stringify(carrito));
    actualizarCarrito();
}

function toggleCarrito(show) {
    const isVisible = typeof show === 'boolean' ? show : !DOM.carrito.classList.contains("visible");
    
    DOM.carrito.classList.toggle("visible", isVisible);
    DOM.overlay.classList.toggle("active", isVisible);
    DOM.carrito.setAttribute('aria-hidden', !isVisible);
    DOM.overlay.setAttribute('aria-hidden', !isVisible);
}

function enviarWhatsApp() {
    if (!carrito.length) return toast("El carrito está vacío");
    
    const nombre = DOM.nombreCliente.value.trim();
    const telefono = DOM.telefonoCliente.value.trim();
    const obs = DOM.observacionesCliente.value.trim();

    if (!nombre) return toast("Por favor, ingrese su nombre");

    let msg = `*PEDIDO*\n`;
    msg += `Cliente: ${nombre}\n`;
    if (telefono) msg += `Teléfono: ${telefono}\n`;
    if (obs) msg += `Observaciones: ${obs}\n`;
    msg += `\n`;

    carrito.forEach(p => {
        msg += `• ${p.nombre} (${p.categoria || 'General'}) x${p.cantidad} = ${money.format(p.precio * p.cantidad)}\n`;
    });

    msg += `\n*TOTAL:* ${DOM.total.textContent}`;
    
    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

// --- ADMIN LOGIC ---
function toggleAdmin(show) {
    const isActive = typeof show === 'boolean' ? show : !DOM.adminModal.classList.contains("active");
    DOM.adminModal.classList.toggle("active", isActive);
    
    if (isActive && isAdmin) renderAdminList();
}

function renderAdminList() {
    if (!productos.length) {
        DOM.adminLista.innerHTML = '<p>No hay productos para administrar.</p>';
        return;
    }

    DOM.adminLista.innerHTML = productos.map(p => `
        <div class="admin-item">
            <div class="admin-item-info">
                <strong>${escapeHTML(p.nombre)}</strong> - ${money.format(p.precio)}<br>
                <small>${escapeHTML(p.categoria) || 'Sin categoría'}</small>
            </div>
            <button class="btn-danger btn-admin-eliminar" data-id="${p.id}">Eliminar</button>
        </div>
    `).join('');
}

async function agregarProductoDB(e) {
    e.preventDefault();
    
    const nuevoProducto = {
        nombre: document.getElementById("adminNombre").value.trim(),
        categoria: document.getElementById("adminCategoria").value.trim(),
        descripcion: document.getElementById("adminDesc").value.trim(),
        precio: parseFloat(document.getElementById("adminPrecio").value),
        imagen_url: document.getElementById("adminImagen").value.trim() || null
    };

    if (!nuevoProducto.nombre || isNaN(nuevoProducto.precio) || nuevoProducto.precio <= 0) {
        return toast("Nombre y precio válido son obligatorios");
    }

    const { error } = await client.from("productos").insert([nuevoProducto]);
    
    if (error) {
        toast("Error al agregar producto: " + error.message);
        console.error(error);
    } else {
        toast("Producto agregado exitosamente");
        DOM.formProducto.reset();
        cargarProductos();
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
        // Optimización: eliminamos de la lista local sin recargar todo de Supabase
        productos = productos.filter(p => String(p.id) !== String(id));
        renderAdminList();
        renderProductos(productos);
    }
}

// --- EVENT LISTENERS (Event Delegation) ---
function initEventListeners() {
    document.getElementById("btnCarrito").addEventListener("click", () => toggleCarrito());
    document.getElementById("btnAdmin").addEventListener("click", () => toggleAdmin());
    DOM.busqueda.addEventListener("input", filtrarProductos);
    DOM.filtroCategoria.addEventListener("change", filtrarProductos);
    DOM.overlay.addEventListener("click", () => toggleCarrito(false));
    document.getElementById("btnCloseCart").addEventListener("click", () => toggleCarrito(false));
    document.getElementById("btnCloseAdmin").addEventListener("click", () => toggleAdmin(false));

    document.getElementById("btnWhatsApp").addEventListener("click", enviarWhatsApp);
    document.getElementById("btnPrint").addEventListener("click", () => window.print());
    document.getElementById("btnVaciar").addEventListener("click", vaciarCarrito);

    DOM.formLogin.addEventListener("submit", loginAdmin);
    document.getElementById("btnLogout").addEventListener("click", logoutAdmin);

    DOM.formProducto.addEventListener("submit", agregarProductoDB);

    // Delegated listener for Product Grid
    DOM.productos.addEventListener("click", (e) => {
        const btnAdd = e.target.closest(".btn-add-cart");
        if (btnAdd) {
            agregarAlCarrito(btnAdd.dataset.id); // Se pasa como string para evitar problemas con UUID
            return;
        }

        const btnShare = e.target.closest(".btn-share");
        if (btnShare) {
            toggleShareDropdown(btnShare.dataset.id);
            return;
        }

        const btnWa = e.target.closest(".share-wa");
        if (btnWa) {
            e.preventDefault();
            shareWhatsApp(btnWa.dataset.id);
            return;
        }

        const btnFb = e.target.closest(".share-fb");
        if (btnFb) {
            e.preventDefault();
            shareFacebook(btnFb.dataset.id);
            return;
        }
    });

    // Delegated listener for Cart Table
    DOM.detalleCarrito.addEventListener("click", (e) => {
        const target = e.target;
        
        if (target.classList.contains("btn-cantidad")) {
            const index = parseInt(target.dataset.index, 10);
            const change = parseInt(target.dataset.change, 10);
            cambiarCantidad(index, change);
        } 
        
        if (target.classList.contains("btn-eliminar")) {
            const index = parseInt(target.dataset.index, 10);
            eliminarDelCarrito(index);
        }
    });

    // Delegated listener for Admin List
    DOM.adminLista.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-admin-eliminar");
        if (btn) {
            eliminarProductoDB(btn.dataset.id); // String para UUID
        }
    });

    // Scroll & Top Button
    let isScrolling;
    window.addEventListener('scroll', () => {
        DOM.btnTop.style.display = window.scrollY > 300 ? "block" : "none";
        
        // Ocultar dropdowns de compartir al hacer scroll
        clearTimeout(isScrolling);
        isScrolling = setTimeout(() => {
            document.querySelectorAll('.share-dropdown.active').forEach(dd => dd.classList.remove('active'));
        }, 100);
    });
    
    DOM.btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleCarrito(false);
            toggleAdmin(false);
        }
    });
}

// --- INITIALIZATION ---
// Usar DOMContentLoaded es más rápido y seguro que window.onload
document.addEventListener('DOMContentLoaded', () => {
    DOM.numCot.textContent = "Cotización #" + Date.now().toString().slice(-6);
    initEventListeners();
    checkAdminSession(); 
    cargarProductos();
    actualizarCarrito();
});
