window.API = "/api";
const API = window.API;

// Toast System
function showToast(message, isError = false) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast" + (isError ? " error" : "");
  toast.innerHTML = (isError ? "⚠️ " : "✅ ") + message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Warenkorb Badge
async function updateCartBadge() {
  try {
    const res = await fetch(`${API}/shop/cart`, { credentials: "include" });
    if (!res.ok) return;
    const items = await res.json();
    const count = items.reduce((acc, item) => acc + item.menge, 0);
    const badge = document.getElementById("cartBadge");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "flex" : "none";
    }
  } catch (err) {}
}

// Artikel in Warenkorb
async function addToCart(accessoryId) {
  try {
    const res = await fetch(`${API}/shop/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessory_id: accessoryId }),
    });
    const data = await res.json();
    if (data.erfolg) {
      showToast("Zum Warenkorb hinzugefügt 🛒");
      updateCartBadge();
      if (typeof window.loadWarenkorb === "function") window.loadWarenkorb();
    }
  } catch (err) {
    showToast("Fehler beim Hinzufügen", true);
  }
}

// Navbar Warenkorb Link einfügen
function injectCartButton() {
  const navLinks = document.querySelector(".nav-links");
  if (!navLinks) return;
  if (document.getElementById("cartNavBtn")) return;

  const cartBtn = document.createElement("a");
  cartBtn.id = "cartNavBtn";
  cartBtn.href = "warenkorb.html";
  cartBtn.style.cssText = "position: relative; text-decoration: none; color: var(--text-dark); font-weight: 700;";
  cartBtn.innerHTML = `🛒 Warenkorb <span id="cartBadge" style="display:none; background: var(--ikea-blue); color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 0.75rem; font-weight: 800; align-items: center; justify-content: center; margin-left: 4px;"></span>`;
  navLinks.appendChild(cartBtn);
}

document.addEventListener("DOMContentLoaded", () => {
  injectCartButton();
  updateCartBadge();
});