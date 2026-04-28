// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
// Troque pela URL gerada pelo Railway após o deploy
// linha 2 do cart.js
const API_URL = "https://mel-real-api.onrender.com";

// ─── CATÁLOGO ─────────────────────────────────────────────────────────────────
const PRODUCTS = {
  "doce-leite": { name: "Doce de Leite", price: 9 },
  ninho: { name: "Ninho", price: 10 },
  nutella: { name: "Nutella", price: 11 },
  "kit-trio": { name: "Kit Trio (D. Leite + Ninho + Nutella)", price: 28 },
};

// ─── ESTADO ───────────────────────────────────────────────────────────────────
const cart = {}; // { id: qty }
let estoqueDisponivel = 99; // será atualizado ao carregar a página

// ─── ESTOQUE: consulta inicial ────────────────────────────────────────────────
async function carregarEstoque() {
  try {
    const res = await fetch(`${API_URL}/estoque`);
    const data = await res.json();
    estoqueDisponivel = data.disponivel;
    atualizarBannerEstoque(data);
  } catch (e) {
    console.warn("Não foi possível carregar o estoque:", e);
    // Se a API estiver fora do ar, o site funciona normalmente sem bloqueio
  }
}

function atualizarBannerEstoque(data) {
  const banner = document.getElementById("estoque-banner");
  if (!banner) return;

  if (data.esgotado) {
    banner.textContent = "⚠️ Estoque esgotado para hoje!";
    banner.className = "estoque-banner esgotado";
    // Desabilita todos os botões de adicionar
    document.querySelectorAll(".btn-add-cart").forEach((btn) => {
      btn.disabled = true;
      btn.textContent = "Esgotado";
    });
  } else {
    banner.textContent = `Restam ${data.disponivel} unidades hoje!`;
    banner.className = "estoque-banner disponivel";
  }
}

// ─── CARRINHO: adicionar ──────────────────────────────────────────────────────
function addToCart(id) {
  const totalNoCarrinho = Object.values(cart).reduce((s, q) => s + q, 0);

  if (totalNoCarrinho >= estoqueDisponivel) {
    mostrarToast(`Só restam ${estoqueDisponivel} unidade(s) disponíveis hoje!`);
    return;
  }

  cart[id] = (cart[id] || 0) + 1;
  syncQtyWidget(id);
  updateCartUI();
  animateFab();
}

// ─── CARRINHO: alterar quantidade pelo card do produto ────────────────────────
function changeQty(id, delta) {
  const atual = cart[id] || 0;
  const totalSemEste = Object.entries(cart)
    .filter(([k]) => k !== id)
    .reduce((s, [, q]) => s + q, 0);

  if (delta > 0 && totalSemEste + atual + 1 > estoqueDisponivel) {
    mostrarToast(`Só restam ${estoqueDisponivel} unidade(s) disponíveis hoje!`);
    return;
  }

  cart[id] = Math.max(0, atual + delta);
  if (cart[id] === 0) delete cart[id];
  syncQtyWidget(id);
  updateCartUI();
}

// ─── CARRINHO: alterar quantidade dentro do painel ───────────────────────────
function changeCartQty(id, delta) {
  if (!cart[id]) return;

  if (delta > 0) {
    const total = Object.values(cart).reduce((s, q) => s + q, 0);
    if (total >= estoqueDisponivel) {
      mostrarToast(
        `Só restam ${estoqueDisponivel} unidade(s) disponíveis hoje!`,
      );
      return;
    }
  }

  cart[id] = Math.max(0, cart[id] + delta);
  if (cart[id] === 0) delete cart[id];
  syncQtyWidget(id);
  updateCartUI();
}

// ─── SINCRONIZA contador visível no card ──────────────────────────────────────
function syncQtyWidget(id) {
  const qty = cart[id] || 0;
  const numEl = document.getElementById("num-" + id);
  const qtyEl = document.getElementById("qty-" + id);
  const btnEl = qtyEl ? qtyEl.previousElementSibling : null;

  if (numEl) numEl.textContent = qty;
  if (qtyEl) qtyEl.classList.toggle("visible", qty > 0);
  if (btnEl) btnEl.style.display = qty > 0 ? "none" : "";
}

// ─── ATUALIZA UI completa do painel ──────────────────────────────────────────
function updateCartUI() {
  const itemsEl = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  const badgeEl = document.getElementById("cartBadge");
  const checkoutEl = document.getElementById("btnCheckout");

  const ids = Object.keys(cart).filter((id) => cart[id] > 0);
  const totalQty = ids.reduce((s, id) => s + cart[id], 0);
  const totalVal = ids.reduce((s, id) => s + cart[id] * PRODUCTS[id].price, 0);

  badgeEl.textContent = totalQty;
  badgeEl.classList.toggle("visible", totalQty > 0);
  totalEl.textContent = "R$ " + totalVal;
  checkoutEl.disabled = totalQty === 0;

  if (ids.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <p>Seu carrinho está vazio</p>
      </div>`;
    return;
  }

  itemsEl.innerHTML = ids
    .map((id) => {
      const p = PRODUCTS[id];
      const qty = cart[id];
      const sub = qty * p.price;
      return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price">R$ ${p.price} cada</div>
        </div>
        <div class="cart-item-qty">
          <button class="cart-qty-btn" onclick="changeCartQty('${id}', -1)">−</button>
          <span class="cart-qty-num">${qty}</span>
          <button class="cart-qty-btn" onclick="changeCartQty('${id}', 1)">+</button>
        </div>
        <div class="cart-item-subtotal">R$ ${sub}</div>
      </div>`;
    })
    .join("");
}

// ─── ABRIR / FECHAR painel ───────────────────────────────────────────────────
function toggleCart() {
  const panel = document.getElementById("cartPanel");
  const overlay = document.getElementById("cartOverlay");
  const isOpen = panel.classList.contains("open");
  panel.classList.toggle("open", !isOpen);
  overlay.classList.toggle("open", !isOpen);
  document.body.style.overflow = isOpen ? "" : "hidden";
}

// ─── LIMPAR carrinho ─────────────────────────────────────────────────────────
function clearCart() {
  Object.keys(cart).forEach((id) => {
    cart[id] = 0;
    syncQtyWidget(id);
  });
  Object.keys(cart).forEach((id) => delete cart[id]);
  updateCartUI();
}

// ─── ANIMAÇÃO do botão flutuante ─────────────────────────────────────────────
function animateFab() {
  const fab = document.getElementById("cartFab");
  fab.classList.remove("pop");
  void fab.offsetWidth;
  fab.classList.add("pop");
  fab.addEventListener("animationend", () => fab.classList.remove("pop"), {
    once: true,
  });
}

// ─── TOAST de aviso ──────────────────────────────────────────────────────────
function mostrarToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
      background:#1e2847; border:1px solid rgba(222,179,79,0.5);
      color:#deb34f; padding:12px 24px; border-radius:2px;
      font-family:Belleza,sans-serif; font-size:0.85rem; letter-spacing:1px;
      z-index:2000; white-space:nowrap; box-shadow:0 8px 30px rgba(0,0,0,0.4);
      transition:opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);
}

// ─── FINALIZAR COMPRA ────────────────────────────────────────────────────────
async function checkout() {
  const ids = Object.keys(cart).filter((id) => cart[id] > 0);
  if (ids.length === 0) return;

  const totalQty = ids.reduce((s, id) => s + cart[id], 0);
  const totalVal = ids.reduce((s, id) => s + cart[id] * PRODUCTS[id].price, 0);

  const btnCheckout = document.getElementById("btnCheckout");
  btnCheckout.disabled = true;
  btnCheckout.textContent = "Confirmando...";

  // 1. Tenta reservar no backend
  try {
    const res = await fetch(`${API_URL}/estoque/reservar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantidade: totalQty }),
    });
    const data = await res.json();

    // Atualiza estoque local
    estoqueDisponivel = data.disponivel;

    if (!data.sucesso) {
      mostrarToast(data.mensagem);
      btnCheckout.disabled = false;
      btnCheckout.textContent = "Finalizar pelo WhatsApp";
      return;
    }
  } catch (e) {
    // Se a API estiver fora do ar, deixa prosseguir normalmente
    console.warn("API indisponível, prosseguindo sem reserva:", e);
  }

  // 2. Monta mensagem e abre WhatsApp
  const linhas = ids
    .map((id) => {
      const p = PRODUCTS[id];
      return `• ${p.name} x${cart[id]} = R$ ${cart[id] * p.price}`;
    })
    .join("\n");

  const msg =
    `Oi! Fiz meu pedido pelo site da Mel Real!\n\n` +
    `*Resumo do pedido:*\n${linhas}\n\n` +
    `*Total: R$ ${totalVal}*\n\n` +
    `Pode confirmar a disponibilidade?`;

  window.open(
    "https://wa.me/5519988865745?text=" + encodeURIComponent(msg),
    "_blank",
  );

  // 3. Limpa o carrinho
  clearCart();
  toggleCart();

  btnCheckout.disabled = false;
  btnCheckout.textContent = "Finalizar pelo WhatsApp";

  // 4. Atualiza banner de estoque
  try {
    const res = await fetch(`${API_URL}/estoque`);
    const data = await res.json();
    atualizarBannerEstoque(data);
  } catch (_) {}
}

// ─── INICIALIZAÇÃO ───────────────────────────────────────────────────────────
carregarEstoque();
updateCartUI();
