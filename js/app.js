// ==========================================
// ⚠️ SECURITY WARNING ⚠️
// NEVER expose Supabase keys in public source code in production. Use environment variables or a backend proxy.
// ==========================================

const SUPABASE_URL = 'https://yliohprzqxzpyyrpvlvh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaW9ocHJ6cXh6cHl5cnB2bHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTIyNTcsImV4cCI6MjA5MTc2ODI1N30.vvWoWAnHbfmZMEDWTKV8aGs6OsTKjpMam1h2OXVCjQI';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const moneyFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

// --- STATE MANAGEMENT ---
const State = {
    productos: [],
    carrito: JSON.parse(localStorage.getItem("carrito")) || [],
    isAdmin: false
};

// --- DOM SELECTORS ---
const $ = id => document.getElementById(id);
const DOM = {
    productos: $("productos"), detalleCarrito: $("detalle-carrito"), subtotal: $("subtotal"),
    iva: $("iva"), total: $("total"), contador: $("contador"), carrito: $("carrito"),
    overlay: $("overlay"), toast: $("toast"), busqueda: $("busqueda"),
    filtroCategoria: $("filtroCategoria"), numCot: $("numCot"), adminModal: $("adminModal"),
    formProducto: $("formProducto"), adminLista: $("adminLista"), btnTop: $("btnTop"),
    nombreCliente: $("nombreCliente"), telefonoCliente: $("telefonoCliente"),
    observacionesCliente: $("observacionesCliente"), authContainer: $("authContainer"),
    adminContainer: $("adminContainer"), formLogin: $("formLogin"), adminEmail: $("adminEmail")
};

// --- UTILITY FUNCTIONS ---
const showToast = (msg) => {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add("show");
    setTimeout(() => DOM.toast.classList.remove("show"), 2500);
};

const debounce = (fn, delay) => {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
};

// --- AUTH MODULE ---
const Auth = {
    checkSession: async () => {
        const { data: { session } } = await db.auth.getSession();
        Auth.updateUI(session ? session.user.email : null);
    },
    login: async (e) => {
        e.preventDefault();
        const email = $("authEmail").value;
        const password = $("authPassword").value;
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) showToast("Error: " + error.message);
        else { State.isAdmin = true; showToast("Inicio de sesión exitoso"); Auth.updateUI(data.user.email); Admin.renderList(); }
    },
    logout: async () => {
        const { error } = await db.auth.signOut();
        if (error) showToast("Error al cerrar sesión");
        else { State.isAdmin = false; showToast("Sesión cerrada"); Auth.updateUI(null); }
    },
    updateUI: (email) => {
        State.isAdmin = !!email;
        DOM.authContainer.style.display = email ? 'none' : 'block';
        DOM.adminContainer.style.display = email ? 'block' : 'none';
        DOM.adminEmail.textContent = email ? `👤 ${email}` : '';
    },
    listen: () => {
        db.auth.onAuthStateChange((event, session) => Auth.updateUI(session ? session.user.email : null));
    }
};

// --- PRODUCTS MODULE ---
const Products = {
    load: async () => {
        DOM.productos.innerHTML = "<p>Cargando productos...</p>";
        const { data, error } = await db.from("productos").select("*").order("categoria", { ascending: true });
        if (error) { DOM.productos.innerHTML = "<p>Error cargando productos.</p>"; return console.error(error); }
        State.productos = data || [];
        Products.loadCategories();
        Products.render(State.productos);
        Products.checkDeepLink();
    },
    loadCategories: () => {
        const cats = [...new Set(State.productos.map(p => p.categoria).filter(Boolean))];
        DOM.filtroCategoria.innerHTML = `<option value="">Todas las categorías</option>${cats.map(c => `<option value="${c}">${c}</option>`).join('')}`;
    },
    render: (list) => {
        if (!list.length) { DOM.productos.innerHTML = "<p>No hay productos disponibles.</p>"; return; }
        DOM.productos.innerHTML = list.map(p => `
            <div class="producto" data-id="${p.id}" id="producto-${p.id}">
                <div class="img-container">
                    <img src="${p.imagen_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${p.nombre}" loading="lazy">
                </div>
                <div class="producto-info">
                    <span class="categoria-badge">${p.categoria || 'Sin categoría'}</span>
                    <h3>${p.nombre}</h3>
                    <p>${p.descripcion || ''}</p>
                    <strong>${moneyFormatter.format(p.precio || 0)}</strong>
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
    },
    filter: debounce(() => {
        const txt = DOM.busqueda.value.toLowerCase();
        const cat = DOM.filtroCategoria.value;
        const filtered = State.productos.filter(p => 
            (p.nombre?.toLowerCase().includes(txt) || p.descripcion?.toLowerCase().includes(txt) || p.categoria?.toLowerCase().includes(txt)) &&
            (!cat || p.categoria === cat)
        );
        Products.render(filtered);
    }, 300),
    checkDeepLink: () => {
        const productId = new URLSearchParams(window.location.search).get('producto');
        if (productId) {
            setTimeout(() => {
                const el = $(`producto-${productId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.boxShadow = "0 0 0 4px var(--primary)";
                    setTimeout(() => el.style.boxShadow = "", 3000);
                }
            }, 500);
        }
    }
};

// --- SOCIAL SHARE MODULE ---
const Share = {
    getUrl: (product) => `${window.location.origin}${window.location.pathname}?producto=${product.id}`,
    whatsapp: (productId) => {
        const p = State.productos.find(x => x.id === productId);
        if (!p) return;
        const url = Share.getUrl(p);
        const text = `¡Mira este producto!\n\n*${p.nombre}*\n${p.descripcion || ''}\n*Precio:* ${moneyFormatter.format(p.precio)}\n\nVer más: ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    },
    facebook: (productId) => {
        const p = State.productos.find(x => x.id === productId);
        if (!p) return;
        const url = Share.getUrl(p);
        // Facebook will scrape the URL. The synchronous script in HTML head will serve the OG tags!
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    },
    toggleDropdown: (productId) => {
        document.querySelectorAll('.share-dropdown.active').forEach(dd => {
            if (dd.id !== `share-dropdown-${productId}`) dd.classList.remove('active');
        });
        const dropdown = $(`share-dropdown-${productId}`);
        if(dropdown) dropdown.classList.toggle('active');
    },
    closeAllDropdowns: () => {
        document.querySelectorAll('.share-dropdown.active').forEach(dd => dd.classList.remove('active'));
    }
};

// --- CART MODULE ---
const Cart = {
    add: (id) => {
        const p = State.productos.find(x => x.id === id);
        if (!p) return;
        const item = State.carrito.find(x => x.id === id);
        if (item) item.cantidad++; else State.carrito.push({ ...p, cantidad: 1 });
        Cart.save(); showToast("Producto agregado al carrito");
    },
    update: () => {
        let subtotal = 0;
        DOM.detalleCarrito.innerHTML = State.carrito.map((p, i) => {
            const total = p.precio * p.cantidad; subtotal += total;
            return `<tr>
                <td>${p.nombre}<br><small>${p.categoria || ''}</small></td>
                <td><button class="btn-cantidad" data-index="${i}" data-change="-1">-</button> ${p.cantidad} <button class="btn-cantidad" data-index="${i}" data-change="1">+</button></td>
                <td>${moneyFormatter.format(total)}</td>
                <td><button class="btn-danger btn-eliminar" data-index="${i}">✕</button></td>
            </tr>`;
        }).join('');
        const iva = subtotal * 0.19; const total = subtotal + iva;
        DOM.subtotal.textContent = moneyFormatter.format(subtotal);
        DOM.iva.textContent = moneyFormatter.format(iva);
        DOM.total.textContent = moneyFormatter.format(total);
        DOM.contador.textContent = State.carrito.reduce((a, b) => a + b.cantidad, 0);
    },
    changeQty: (i, n) => { State.carrito[i].cantidad += n; if (State.carrito[i].cantidad <= 0) State.carrito.splice(i, 1); Cart.save(); },
    remove: (i) => { State.carrito.splice(i, 1); Cart.save(); },
    empty: () => { if(confirm("¿Estás seguro de vaciar el carrito?")) { State.carrito = []; Cart.save(); } },
    save: () => { localStorage.setItem("carrito", JSON.stringify(State.carrito)); Cart.update(); },
    toggle: (show) => {
        const isVisible = typeof show === 'boolean' ? show : !DOM.carrito.classList.contains("visible");
        DOM.carrito.classList.toggle("visible", isVisible); DOM.overlay.classList.toggle("active", isVisible);
        DOM.carrito.setAttribute('aria-hidden', !isVisible); DOM.overlay.setAttribute('aria-hidden', !isVisible);
    },
    sendWhatsApp: () => {
        if (!State.carrito.length) return showToast("Carrito vacío");
        const nombre = DOM.nombreCliente.value.trim(); const telefono = DOM.telefonoCliente.value.trim(); const obs = DOM.observacionesCliente.value.trim();
        if (!nombre) return showToast("Por favor, ingrese su nombre");
        let msg = `*PEDIDO*\nCliente: ${nombre}\nTeléfono: ${telefono}\nObservaciones: ${obs}\n\n`;
        State.carrito.forEach(p => msg += `• ${p.nombre} (${p.categoria || 'General'}) x${p.cantidad} = ${moneyFormatter.format(p.precio * p.cantidad)}\n`);
        msg += `\nTOTAL: ${DOM.total.textContent}`;
        window.open(`https://wa.me/573192654225?text=${encodeURIComponent(msg)}`);
    }
};

// --- ADMIN MODULE ---
const Admin = {
    toggle: (show) => {
        const isActive = typeof show === 'boolean' ? show : !DOM.adminModal.classList.contains("active");
        DOM.adminModal.classList.toggle("active", isActive);
        if (isActive && State.isAdmin) Admin.renderList();
    },
    renderList: () => {
        DOM.adminLista.innerHTML = State.productos.map(p => `
            <div class="admin-item">
                <div class="admin-item-info"><strong>${p.nombre}</strong> - ${moneyFormatter.format(p.precio)}<br><small>${p.categoria || 'Sin categoría'}</small></div>
                <button class="btn-danger btn-admin-eliminar" data-id="${p.id}">Eliminar</button>
            </div>
        `).join('');
    },
    addProduct: async (e) => {
        e.preventDefault();
        const newProduct = { nombre: $("adminNombre").value, categoria: $("adminCategoria").value, descripcion: $("adminDesc").value, precio: parseFloat($("adminPrecio").value), imagen_url: $("adminImagen").value || null };
        const { error } = await db.from("productos").insert([newProduct]);
        if (error) { showToast("Error al agregar producto"); console.error(error); } 
        else { showToast("Producto agregado exitosamente"); DOM.formProducto.reset(); Products.load(); }
    },
    deleteProduct: async (id) => {
        if (!confirm("¿Eliminar este producto de la base de datos?")) return;
        const { error } = await db.from("productos").delete().eq("id", id);
        if (error) { showToast("Error al eliminar producto"); console.error(error); } 
        else { showToast("Producto eliminado"); Products.load(); }
    }
};

// --- GLOBAL EVENT DELEGATION (Professional Pattern) ---
function initEventListeners() {
    // Header & Modals
    $("btnCarrito").addEventListener("click", () => Cart.toggle());
    $("btnAdmin").addEventListener("click", () => Admin.toggle());
    DOM.busqueda.addEventListener("input", Products.filter);
    DOM.filtroCategoria.addEventListener("change", Products.filter);
    DOM.overlay.addEventListener("click", () => Cart.toggle(false));
    $("btnCloseCart").addEventListener("click", () => Cart.toggle(false));
    $("btnCloseAdmin").addEventListener("click", () => Admin.toggle(false));

    // Cart & Auth & Admin Actions
    $("btnWhatsApp").addEventListener("click", Cart.sendWhatsApp);
    $("btnPrint").addEventListener("click", () => window.print());
    $("btnVaciar").addEventListener("click", Cart.empty);
    DOM.formLogin.addEventListener("submit", Auth.login);
    $("btnLogout").addEventListener("click", Auth.logout);
    DOM.formProducto.addEventListener("submit", Admin.addProduct);

    // Delegated Events for Dynamic Content (Products Grid)
    DOM.productos.addEventListener("click", (e) => {
        const target = e.target;
        if (target.closest(".btn-add-cart")) return Cart.add(parseInt(target.closest(".btn-add-cart").dataset.id, 10));
        if (target.closest(".btn-share")) return Share.toggleDropdown(parseInt(target.closest(".btn-share").dataset.id, 10));
        if (target.closest(".share-wa")) { e.preventDefault(); return Share.whatsapp(parseInt(target.closest(".share-wa").dataset.id, 10)); }
        if (target.closest(".share-fb")) { e.preventDefault(); return Share.facebook(parseInt(target.closest(".share-fb").dataset.id, 10)); }
    });

    // Delegated Events for Cart Table
    DOM.detalleCarrito.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains("btn-cantidad")) Cart.changeQty(parseInt(target.dataset.index, 10), parseInt(target.dataset.change, 10));
        if (target.classList.contains("btn-eliminar")) Cart.remove(parseInt(target.dataset.index, 10));
    });

    // Delegated Events for Admin List
    DOM.adminLista.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-admin-eliminar");
        if (btn) Admin.deleteProduct(parseInt(btn.dataset.id, 10));
    });

    // Close Share Dropdowns on outside click
    document.addEventListener('click', (e) => { if (!e.target.closest('.btn-share') && !e.target.closest('.share-dropdown')) Share.closeAllDropdowns(); });

    // Scroll & UI
    window.addEventListener('scroll', () => { DOM.btnTop.style.display = window.scrollY > 300 ? "block" : "none"; });
    DOM.btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { Cart.toggle(false); Admin.toggle(false); } });
}

// --- INITIALIZATION ---
window.onload = () => {
    DOM.numCot.textContent = "Cotización #" + Date.now().toString().slice(-6);
    initEventListeners();
    Auth.listen();
    Auth.checkSession(); 
    Products.load();
    Cart.update();
};
