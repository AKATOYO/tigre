// ==========================================
// ⚠️ SECURITY WARNING ⚠️
// 1. NEVER expose your Supabase keys in public source code in production. 
//    Use environment variables (e.g., Vite's import.meta.env) or a backend proxy.
// 2. This implementation uses Supabase Auth for secure admin access.
// ==========================================

const SUPABASE_URL = 'https://yliohprzqxzpyyrpvlvh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaW9ocHJ6cXh6cHl5cnB2bHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTIyNTcsImV4cCI6MjA5MTc2ODI1N30.vvWoWAnHbfmZMEDWTKV8aGs6OsTKjpMam1h2OXVCjQI'; // Replace securely!

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
function toast(msg) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add("show");
    setTimeout(() => DOM.toast.classList.remove("show"), 2500);
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
    
    // Check if URL has a product ID to deep-link
    checkDeepLink();
}

function cargarCategorias() {
    const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
    DOM.filtroCategoria.innerHTML = `
        <option value="">Todas las categorías</option>
        ${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
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
                <img src="${p.imagen_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${p.nombre}" loading="lazy">
            </div>
            <div class="producto-info">
                <span class="categoria-badge">${p.categoria || 'Sin categoría'}</span>
                <h3>${p.nombre}</h3>
                <p>${p.descripcion || ''}</p>
                <strong>${money.format(p.precio || 0)}</strong>
                
                <div class="producto-actions">
                    <button class="btn-add-cart btn-success" data-id="${p.id}">Agregar</button>
                    <button class="btn-share" data-id="${p.id}">🔗</button>
                    <div class="share-dropdown" id="share-dropdown-${p.id}">
                        <a href="#" class="share-wa" data-id="${p.id}"><span class="icon-whatsapp">💬</span> WhatsApp</a>
                        <a href="#" class="share-fb" data-id="${p.id}"><span class="icon-facebook">📘</span> Facebook</a>
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

// 1. Handle Deep Link (Redirect from shared URL)
function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('producto');
    
    if (productId) {
        const targetProduct = document.getElementById(`producto-${productId}`);
        if (targetProduct) {
            setTimeout(() => {
                targetProduct.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetProduct.style.boxShadow = "0 0 0 4px var(--primary)";
                setTimeout(() => { targetProduct.style.boxShadow = ""; }, 3000);
            }, 500); // Small delay to ensure rendering
        }
    }
}

// 2. Toggle Share Dropdown
function toggleShareDropdown(productId) {
    // Close all other dropdowns first
    document.querySelectorAll('.share-dropdown.active').forEach(dd => {
        if (dd.id !== `share-dropdown-${productId}`) dd.classList.remove('active');
    });
    
    const dropdown = document.getElementById(`share-dropdown-${productId}`);
    dropdown.classList.toggle('active');
}

// 3. Update Open Graph Meta Tags dynamically for previews
function updateMetaTags(product) {
    const baseUrl = window.location.origin + window.location.pathname;
    const productUrl = `${baseUrl}?producto=${product.id}`;
    
    document.getElementById('og-title').setAttribute('content', product.nombre);
    document.getElementById('og-desc').setAttribute('content', `${product.descripcion || ''} - ${money.format(product.precio)}`);
    document.getElementById('og-image').setAttribute('content', product.imagen_url || '');
    document.getElementById('og-url').setAttribute('content', productUrl);
    
    return productUrl;
}

// 4. Share to WhatsApp
function shareWhatsApp(productId) {
    const p = productos.find(x => x.id === productId);
    if (!p) return;
    
    const productUrl = updateMetaTags(p);
    const text = `¡Mira este producto!\n\n*${p.nombre}*\n${p.descripcion || ''}\n*Precio:* ${money.format(p.precio)}\n\nVer más: ${productUrl}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// 5. Share to Facebook
function shareFacebook(productId) {
    const p = productos.find(x => x.id === productId);
    if (!p) return;
    
    const productUrl = updateMetaTags(p);
    // Facebook uses the URL to scrape Open Graph meta tags
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`, '_blank');
}

// Close dropdowns if clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-share') && !e.target.closest('.share-dropdown')) {
        document.querySelectorAll('.share-dropdown.active').forEach(dd => dd.classList.remove('active'));
    }
});


// --- CART LOGIC ---
function agregarAlCarrito(id) {
    const p = productos.find(x => x.id === id);
    if (!p) return;

    const item = carrito.find(x => x.id === id);
    if (item) {
        item.cantidad++;
    } else {
        carrito.push({ ...p, cantidad: 1 });
    }
    guardarCarrito();
    toast("Producto agregado al carrito");
}

function actualizarCarrito() {
    let subtotal = 0;

    DOM.detalleCarrito.innerHTML = carrito.map((p, i) => {
        const total = p.precio * p.cantidad;
        subtotal += total;
        return `
            <tr>
                <td>${p.nombre}<br><small>${p.categoria || ''}</small></td>
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

    const iva = subtotal * 0.19;
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
    if (!carrito.length) return toast("Carrito vacío");
    
    const nombre = DOM.nombreCliente.value.trim();
    const telefono = DOM.telefonoCliente.value.trim();
    const obs = DOM.observacionesCliente.value.trim();

    if (!nombre) return toast("Por favor, ingrese su nombre");

    let msg = `*PEDIDO*\n`;
    msg += `Cliente: ${nombre}\n`;
    msg += `Teléfono: ${telefono}\n`;
    msg += `Observaciones: ${obs}\n\n`;

    carrito.forEach(p => {
        msg += `• ${p.nombre} (${p.categoria || 'General'}) x${p.cantidad} = ${money.format(p.precio * p.cantidad)}\n`;
    });

    msg += `\nTOTAL: ${DOM.total.textContent}`;
    
    window.open(`https://wa.me/573192654225?text=${encodeURIComponent(msg)}`);
}

// --- ADMIN LOGIC ---
function toggleAdmin(show) {
    const isActive = typeof show === 'boolean' ? show : !DOM.adminModal.classList.contains("active");
    
    DOM.adminModal.classList.toggle("active", isActive);
    
    if (isActive && isAdmin) {
        renderAdminList();
    }
}

function renderAdminList() {
    DOM.adminLista.innerHTML = productos.map(p => `
        <div class="admin-item">
            <div class="admin-item-info">
                <strong>${p.nombre}</strong> - ${money.format(p.precio)}<br>
                <small>${p.categoria || 'Sin categoría'}</small>
            </div>
            <button class="btn-danger btn-admin-eliminar" data-id="${p.id}">Eliminar</button>
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

    const { error } = await client.from("productos").insert([nuevoProducto]);
    
    if (error) {
        toast("Error al agregar producto");
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
        cargarProductos();
    }
}

// --- EVENT LISTENERS (Event Delegation) ---
function initEventListeners() {
    // Header & Filters
    document.getElementById("btnCarrito").addEventListener("click", () => toggleCarrito());
    document.getElementById("btnAdmin").addEventListener("click", () => toggleAdmin());
    DOM.busqueda.addEventListener("input", filtrarProductos);
    DOM.filtroCategoria.addEventListener("change", filtrarProductos);
    DOM.overlay.addEventListener("click", () => toggleCarrito(false));
    document.getElementById("btnCloseCart").addEventListener("click", () => toggleCarrito(false));
    document.getElementById("btnCloseAdmin").addEventListener("click", () => toggleAdmin(false));

    // Cart Actions
    document.getElementById("btnWhatsApp").addEventListener("click", enviarWhatsApp);
    document.getElementById("btnPrint").addEventListener("click", () => window.print());
    document.getElementById("btnVaciar").addEventListener("click", vaciarCarrito);

    // Auth Actions
    DOM.formLogin.addEventListener("submit", loginAdmin);
    document.getElementById("btnLogout").addEventListener("click", logoutAdmin);

    // Admin Actions
    DOM.formProducto.addEventListener("submit", agregarProductoDB);

    // Delegated listener for Product Grid (Add to cart, Share buttons)
    DOM.productos.addEventListener("click", (e) => {
        // Add to cart
        const btnAdd = e.target.closest(".btn-add-cart");
        if (btnAdd) {
            const id = parseInt(btnAdd.dataset.id, 10);
            agregarAlCarrito(id);
            return;
        }

        // Toggle Share Dropdown
        const btnShare = e.target.closest(".btn-share");
        if (btnShare) {
            const id = parseInt(btnShare.dataset.id, 10);
            toggleShareDropdown(id);
            return;
        }

        // WhatsApp Share Click
        const btnWa = e.target.closest(".share-wa");
        if (btnWa) {
            e.preventDefault();
            const id = parseInt(btnWa.dataset.id, 10);
            shareWhatsApp(id);
            return;
        }

        // Facebook Share Click
        const btnFb = e.target.closest(".share-fb");
        if (btnFb) {
            e.preventDefault();
            const id = parseInt(btnFb.dataset.id, 10);
            shareFacebook(id);
            return;
        }
    });

    // Delegated listener for Cart Table (Quantity & Delete)
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

    // Delegated listener for Admin List (Delete DB item)
    DOM.adminLista.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-admin-eliminar");
        if (btn) {
            const id = parseInt(btn.dataset.id, 10);
            eliminarProductoDB(id);
        }
    });

    // Scroll & Top Button
    window.addEventListener('scroll', () => {
        DOM.btnTop.style.display = window.scrollY > 300 ? "block" : "none";
    });
    
    DOM.btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleCarrito(false);
            toggleAdmin(false);
        }
    });
}

// --- INITIALIZATION ---
window.onload = () => {
    DOM.numCot.textContent = "Cotización #" + Date.now().toString().slice(-6);
    initEventListeners();
    checkAdminSession(); 
    cargarProductos();
    actualizarCarrito();
};
