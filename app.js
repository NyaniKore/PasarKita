// ==========================================
// 1. DATA ENCAPSULATION & USERS
// ==========================================
class User {
    #password; 
    constructor(username, password, avatar = null, description = "", banner = null) { 
        this.username = username; 
        this.#password = password; 
        this.avatar = avatar || "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400"; 
        this.description = description || "Welcome to my shop! I sell high-quality local goods.";
        this.banner = banner || ""; 
    }
    checkPassword(input) { return this.#password === input; }
    toJSON() { return { username: this.username, password: this.#password, avatar: this.avatar, description: this.description, banner: this.banner }; }
}

class SellerAccount extends User {
    constructor(username) {
        const dbUser = DatabaseManager.getUser(username);
        super(dbUser.username, dbUser.password, dbUser.avatar, dbUser.description, dbUser.banner);
        this.shopName = `${username}'s Shop`;
    }
    
    renderDashboard() {
        const nameEl = document.getElementById('shop-name');
        const avatarEl = document.getElementById('shop-avatar');
        const descEl = document.getElementById('shop-desc-text');
        const descInput = document.getElementById('shop-desc-input');
        const bannerEl = document.getElementById('shop-banner');
        const showMoreBtn = document.getElementById('show-more-desc-btn');

        if (nameEl) nameEl.innerText = this.shopName;
        if (avatarEl) avatarEl.src = this.avatar;
        if (descInput) descInput.value = this.description;
        if (bannerEl) bannerEl.style.backgroundImage = this.banner !== "" ? `url(${this.banner})` : '';

        if (descEl) {
            descEl.innerText = this.description;
            descEl.classList.add('truncated'); 
            
            setTimeout(() => {
                if (showMoreBtn) {
                    if (descEl.scrollHeight > descEl.clientHeight) {
                        showMoreBtn.style.display = 'inline-block';
                        showMoreBtn.innerText = 'Show more';
                        
                        showMoreBtn.onclick = () => {
                            if (descEl.classList.contains('truncated')) {
                                descEl.classList.remove('truncated');
                                showMoreBtn.innerText = 'Show less';
                            } else {
                                descEl.classList.add('truncated');
                                showMoreBtn.innerText = 'Show more';
                            }
                        };
                    } else {
                        showMoreBtn.style.display = 'none'; 
                    }
                }
            }, 10);
        }
    }
}

// ==========================================
// 2. DATABASE MANAGER (Users)
// ==========================================
const DatabaseManager = {
    getUsers() {
        const storedUsers = localStorage.getItem('pasarkita_users');
        const parsed = storedUsers ? JSON.parse(storedUsers) : [];
        return parsed.map(u => new User(u.username, u.password, u.avatar, u.description, u.banner));
    },
    getUser(username) {
        return this.getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
    },
    registerUser(username, password) {
        const users = this.getUsers();
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) throw new Error("Username already exists.");
        users.push(new User(username, password));
        localStorage.setItem('pasarkita_users', JSON.stringify(users));
    },
    verifyUser(username, password) {
        const user = this.getUser(username);
        if (!user) throw new Error("User not found.");
        if (!user.checkPassword(password)) throw new Error("Incorrect password.");
        return true;
    },
    updateProfile(username, newAvatar, newDescription, newBanner) {
        const users = this.getUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (user) {
            if (newAvatar !== null) user.avatar = newAvatar;
            if (newDescription !== null) user.description = newDescription;
            if (newBanner !== null) user.banner = newBanner;
            localStorage.setItem('pasarkita_users', JSON.stringify(users));
        }
    }
};

// ==========================================
// 3. NOTIFICATION MANAGER
// ==========================================
const NotificationManager = {
    getNotifications() {
        return JSON.parse(localStorage.getItem('pasarkita_notifications') || '[]');
    },
    // NEW: Get mute settings from storage
    getMuteSettings() {
        return JSON.parse(localStorage.getItem('pasarkita_mute_settings') || '{"save": false, "message": false}');
    },
    // NEW: Toggle mute state and refresh the page UI
    toggleMute(type) {
        const settings = this.getMuteSettings();
        settings[type] = !settings[type];
        localStorage.setItem('pasarkita_mute_settings', JSON.stringify(settings));
        AppRouter.renderNotificationsPage(); 
    },
    // UPDATED: Added 'type' parameter
    addNotification(username, text, link, type = "general") {
        const notifs = this.getNotifications();
        notifs.unshift({ 
            id: Date.now(),
            username: username,
            text: text,
            link: link,
            read: false,
            type: type, // Tag as "save" or "message"
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('pasarkita_notifications', JSON.stringify(notifs));
        SessionManager.updateHeaderUI(); 
    },
// Replace these two methods inside NotificationManager
    markAllAsRead(username) {
        const notifs = this.getNotifications();
        const settings = this.getMuteSettings();
        let changed = false;
        notifs.forEach(n => { 
            // NEW: Only mark as read if the notification is NOT muted
            if (n.username === username && !n.read && !settings[n.type]) { 
                n.read = true; 
                changed = true; 
            } 
        });
        if (changed) {
            localStorage.setItem('pasarkita_notifications', JSON.stringify(notifs));
            SessionManager.updateHeaderUI();
        }
    },
    getUnreadCount(username) {
        const settings = this.getMuteSettings();
        // NEW: Filter out muted types from the counter
        return this.getNotifications().filter(n => 
            n.username === username && 
            !n.read && 
            !settings[n.type]
        ).length;
    }
};

// ==========================================
// 4. MESSAGING ENGINE
// ==========================================
const MessageManager = {
    getMessages() {
        return JSON.parse(localStorage.getItem('pasarkita_messages') || '[]');
    },
    sendMessage(receiver, text) {
        if (!SessionManager.isLoggedIn()) throw new Error("You must be logged in to send messages.");
        const sender = SessionManager.getCurrentUser();
        const msgs = this.getMessages();
        
        msgs.push({
            id: Date.now(),
            sender: sender,
            receiver: receiver,
            text: text,
            read: false, // Added for counter
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('pasarkita_messages', JSON.stringify(msgs));

        NotificationManager.addNotification(receiver, `<strong>${sender}:</strong> "${text.length > 50 ? text.substring(0, 50) + '...' : text}"`, `messages.html?user=${sender}`);

        if (window.location.pathname.includes('messages.html')) {
            AppRouter.renderChatInterface(receiver);
        }
    },
    getUnreadCount(username) {
        return this.getMessages().filter(m => m.receiver === username && !m.read).length;
    },
    markAsRead(sender, receiver) {
        const msgs = this.getMessages();
        let changed = false;
        msgs.forEach(m => {
            if (m.sender === sender && m.receiver === receiver && !m.read) {
                m.read = true;
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem('pasarkita_messages', JSON.stringify(msgs));
            SessionManager.updateHeaderUI();
        }
    },
    getConversations(username) {
        const msgs = this.getMessages();
        const contacts = new Set();
        msgs.forEach(m => {
            if (m.sender === username) contacts.add(m.receiver);
            if (m.receiver === username) contacts.add(m.sender);
        });
        return Array.from(contacts);
    },
    getChatHistory(user1, user2) {
        return this.getMessages().filter(m => 
            (m.sender === user1 && m.receiver === user2) || 
            (m.sender === user2 && m.receiver === user1)
        );
    }
};

// ==========================================
// 5. PRODUCT MANAGER
// ==========================================
const ProductManager = {
    getProducts() {
        const stored = localStorage.getItem('pasarkita_products');
        if (!stored) return []; 
        return JSON.parse(stored).map(p => new Product(p.id, p.title, p.price, p.location, p.imgUrl, p.sellerUsername));
    },
    addProduct(title, price, location, imgUrl) {
        if (!SessionManager.isLoggedIn()) throw new Error("You must be logged in to sell items.");
        const products = this.getProducts();
        const newId = Date.now(); 
        const seller = SessionManager.getCurrentUser();
        products.push(new Product(newId, title, parseFloat(price), location, imgUrl, seller));
        localStorage.setItem('pasarkita_products', JSON.stringify(products));
    },
    updateProduct(id, newTitle, newPrice, newImgUrl) {
        let products = this.getProducts();
        const index = products.findIndex(p => p.id === id);
        
        if (index === -1) throw new Error("Product not found.");
        if (products[index].sellerUsername !== SessionManager.getCurrentUser()) throw new Error("Unauthorized.");

        products[index].title = newTitle;
        products[index].price = parseFloat(newPrice);
        if (newImgUrl) products[index].imgUrl = newImgUrl;

        localStorage.setItem('pasarkita_products', JSON.stringify(products));

        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (key.startsWith('pasarkita_saved_')) {
                let userSaved = JSON.parse(localStorage.getItem(key)) || [];
                let updatedSaved = userSaved.map(item => {
                    if (item.id === id) {
                        item.title = newTitle;
                        item.price = parseFloat(newPrice);
                        if (newImgUrl) item.imgUrl = newImgUrl;
                    }
                    return item;
                });
                localStorage.setItem(key, JSON.stringify(updatedSaved));
            }
        });
    },
    deleteProduct(productId) {
        if (!confirm("Are you sure you want to delete this listing? This action cannot be undone.")) return;
        let products = this.getProducts();
        products = products.filter(p => p.id !== productId);
        localStorage.setItem('pasarkita_products', JSON.stringify(products));
        
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (key.startsWith('pasarkita_saved_')) {
                let userSaved = JSON.parse(localStorage.getItem(key)) || [];
                userSaved = userSaved.filter(item => item.id !== productId);
                localStorage.setItem(key, JSON.stringify(userSaved));
            }
        });
        window.location.href = "selleraccount.html";
    }
};

// ==========================================
// 6. LOCAL STORAGE SESSION MANAGER
// ==========================================
const SessionManager = {
    login(username) { localStorage.setItem('pasarkita_logged_in_user', username); },
    logout() { localStorage.removeItem('pasarkita_logged_in_user'); window.location.href = "index.html"; },
    getCurrentUser() { return localStorage.getItem('pasarkita_logged_in_user'); },
    isLoggedIn() { return this.getCurrentUser() !== null; },
    updateHeaderUI() {
        const userProfileDivs = document.querySelectorAll('.user-profile');
        const welcomeMessageSpan = document.getElementById('welcome-message');
        
        if (this.isLoggedIn()) {
            const currentUser = this.getCurrentUser();
            if (welcomeMessageSpan) { welcomeMessageSpan.innerText = `Welcome, ${currentUser}`; welcomeMessageSpan.style.display = 'block'; }
            userProfileDivs.forEach(div => { div.innerHTML = `<a href="#" class="logout-btn">Logout</a>`; });
            document.querySelectorAll('.logout-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); this.logout(); }); });
            
            // --- Notification Counter ---
            const unreadNotifs = NotificationManager.getUnreadCount(currentUser);
            const notifLink = document.getElementById('nav-notifications-link');
            if (notifLink) {
                notifLink.innerHTML = `Notifications ${unreadNotifs > 0 ? `<span style="background: red; color: white; border-radius: 10px; padding: 2px 6px; font-size: 11px; margin-left: 4px;">${unreadNotifs}</span>` : ''}`;
            }

            // --- Message Counter (New) ---
            const unreadMsgs = MessageManager.getUnreadCount(currentUser);
            const msgLink = document.getElementById('nav-messages-link');
            if (msgLink) {
                msgLink.innerHTML = `Messages ${unreadMsgs > 0 ? `<span style="background: red; color: white; border-radius: 10px; padding: 2px 6px; font-size: 11px; margin-left: 4px;">${unreadMsgs}</span>` : ''}`;
            }

        } else {
            if (welcomeMessageSpan) welcomeMessageSpan.style.display = 'none';
            userProfileDivs.forEach(div => { div.innerHTML = `<a href="login.html">Log in</a>`; });
        }
    }
};

// ==========================================
// 7. PRODUCT & SAVED CLASSES
// ==========================================
class Product {
    constructor(id, title, price, location, imgUrl, sellerUsername) {
        this.id = id; this.title = title; this.price = price; this.location = location; this.imgUrl = imgUrl; this.sellerUsername = sellerUsername; 
    }
    render(isSellerView = false) {
        const actionButton = isSellerView 
            ? `<button class="btn btn-dark product-card__btn" onclick="ProductManager.deleteProduct(${this.id})">Delete Listing</button>`
            : `<button class="btn btn-primary product-card__btn" onclick="SiteSaved.saveItemById(${this.id})">Save Item</button>`;

        return `
            <div class="product-card">
                <a href="product.html?id=${this.id}" style="flex-grow: 1; display: flex; flex-direction: column;">
                    <img src="${this.imgUrl}" alt="${this.title}" class="product-card__img">
                    <div class="product-card__body">
                        <div class="product-card__title">${this.title}</div>
                        <div class="product-card__price">RM${this.price.toFixed(2)}</div>
                        <div class="product-card__meta">
                            <span>📍 ${this.location}</span>
                            <span>By ${this.sellerUsername}</span>
                        </div>
                    </div>
                </a>
                ${actionButton}
            </div>`;
    }
}

class SavedManager {
    #items = [];
    constructor() { this.loadSaved(); }
    
    loadSaved() { 
        const activeUser = SessionManager.getCurrentUser();
        if (!activeUser) { this.#items = []; return; }
        const stored = localStorage.getItem(`pasarkita_saved_${activeUser}`); 
        if (stored) this.#items = JSON.parse(stored); 
    }
    
    saveData() { 
        const activeUser = SessionManager.getCurrentUser();
        if (!activeUser) return;
        localStorage.setItem(`pasarkita_saved_${activeUser}`, JSON.stringify(this.#items)); 
    }
    
    saveItemById(productId) {
        try {
            if (!SessionManager.isLoggedIn()) throw new Error("Please log in to save items.");
            const product = AppRouter.catalog.find(p => p.id === productId);
            if (!product) throw new Error("Item not found in catalog.");
            if (SessionManager.getCurrentUser() === product.sellerUsername) throw new Error("You cannot save your own product.");
            if (this.#items.find(item => item.id === productId)) throw new Error(`${product.title} is already in your saved list!`);
            
            this.#items.push(product);
            this.saveData();
            alert(`${product.title} saved for later!`);
        } catch (error) { alert(error.message); }
    }
    
    removeItemByIndex(index) { 
        this.#items.splice(index, 1); 
        this.saveData(); 
        this.renderSavedPage(); 
    }

    renderSavedPage() {
        const container = document.getElementById('saved-items-container');
        if (!container) return; 

        if (this.#items.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <h3 style="margin-bottom: 8px;">No saved items</h3>
                    <p style="color: var(--color-text-muted); margin-bottom: 24px;">Items you save will appear here so you can easily contact the seller later.</p>
                    <a href="index.html" class="btn btn-primary">Browse Marketplace</a>
                </div>`;
            return;
        }

        container.innerHTML = this.#items.map((item, index) => `
            <div class="cart-item" style="align-items: center;">
                <img src="${item.imgUrl}" alt="${item.title}" class="cart-item__img">
                <div class="cart-item__details">
                    <div>
                        <h4 class="cart-item__title">${item.title}</h4>
                        <p class="cart-item__seller">Seller: <span style="font-weight: 600;">${item.sellerUsername}</span></p>
                    </div>
                    <div class="cart-item__price">RM${item.price.toFixed(2)}</div>
                </div>
                <div class="cart-item__actions" style="align-items: center; gap: 12px; flex-direction: row;">
                    <button class="btn-remove" onclick="SiteSaved.removeItemByIndex(${index})">Remove</button>
                    <button class="btn btn-primary btn-sm" onclick="window.location.href='messages.html?user=${item.sellerUsername}'">Message Seller</button>
                </div>
            </div>`).join('');
    }
}
const SiteSaved = new SavedManager();

// ==========================================
// 8. PAGE ROUTER, SEARCH, MESSAGES & ALERTS
// ==========================================
const AppRouter = {
    catalog: [], 
    displayLimit: 8, 
    currentSearchQuery: "", 
    currentLocation: "All Sarawak",
    availableLocations: ["All Sarawak", "Kuching, Sarawak", "Serian, Sarawak", "Sibu, Sarawak", "Samarahan, Sarawak", "Bintulu, Sarawak", "Miri, Sarawak"],

    renderHomepageCatalog(query = this.currentSearchQuery, resetPagination = false) {
        const mainGrid = document.getElementById('main-product-grid');
        if (!mainGrid) return;

        if (resetPagination) this.displayLimit = 8;
        this.currentSearchQuery = query;
        const q = query.toLowerCase().trim();

        const filtered = this.catalog.filter(p => {
            const matchesText = p.title.toLowerCase().includes(q) || p.sellerUsername.toLowerCase().includes(q);
            const matchesLocation = this.currentLocation === "All Sarawak" || p.location === this.currentLocation;
            return matchesText && matchesLocation;
        });

        const itemsToShow = filtered.slice(0, this.displayLimit);
        const oldContainer = document.getElementById('load-more-container');
        if (oldContainer) oldContainer.remove();

        if (itemsToShow.length > 0) {
            mainGrid.innerHTML = itemsToShow.map(item => item.render()).join('');
            if (this.displayLimit < filtered.length) {
                const btnHTML = `<div id="load-more-container" style="grid-column: 1 / -1; text-align: center; padding-top: 24px;"><button id="load-more-btn" class="btn btn-primary" style="padding: 12px 32px; border-radius: 50px;">Load More Products</button></div>`;
                mainGrid.insertAdjacentHTML('beforeend', btnHTML);
                document.getElementById('load-more-btn').addEventListener('click', () => {
                    this.displayLimit += 8; this.renderHomepageCatalog(this.currentSearchQuery, false);
                });
            }
        } else {
            mainGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-text-muted);"><h3 style="color: var(--color-text-main); margin-bottom: 8px;">No products found</h3><p>Be the first to list something here!</p></div>`;
        }
    },

    initLocationModal() {
        const modal = document.getElementById('location-modal');
        const openBtn = document.getElementById('location-picker-btn');
        const closeBtn = document.getElementById('close-location-modal');
        const overlay = document.getElementById('modal-overlay');
        const listContainer = document.getElementById('location-list');
        const searchInput = document.getElementById('location-search-input');
        const locationBtnText = document.getElementById('location-btn-text');
        const liveLocationBtn = document.getElementById('live-location-btn');

        if (!modal || !openBtn) return; 

        const openModal = () => { modal.classList.add('active'); renderList(this.availableLocations); if(searchInput) searchInput.value = ""; };
        const closeModal = () => modal.classList.remove('active');

        const renderList = (locations) => {
            listContainer.innerHTML = locations.map(loc => `
                <li class="location-item" data-loc="${loc}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${loc}</li>
            `).join('');

            document.querySelectorAll('.location-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const selectedLoc = e.currentTarget.getAttribute('data-loc');
                    this.currentLocation = selectedLoc;
                    locationBtnText.innerText = `Location: ${selectedLoc}`;
                    closeModal();
                    this.renderHomepageCatalog(this.currentSearchQuery, true); 
                });
            });
        };

        if (liveLocationBtn) {
            liveLocationBtn.addEventListener('click', () => {
                if (!navigator.geolocation) return alert("Your browser does not support live location tracking.");
                const originalText = liveLocationBtn.innerHTML;
                liveLocationBtn.innerHTML = "Detecting location...";
                
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude; const lon = position.coords.longitude;
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                        const data = await response.json();
                        const city = data.address.city || data.address.town || data.address.village || "Unknown City";
                        const state = data.address.state || "Unknown Province";
                        const fullLocation = `${city}, ${state}`;
                        this.currentLocation = fullLocation; locationBtnText.innerText = `Location: ${fullLocation}`;
                        if(!this.availableLocations.includes(fullLocation)) this.availableLocations.unshift(fullLocation);
                        liveLocationBtn.innerHTML = originalText; closeModal();
                        this.renderHomepageCatalog(this.currentSearchQuery, true); 
                    } catch (error) { alert("Could not detect your exact city."); liveLocationBtn.innerHTML = originalText; }
                }, () => { alert("Location access denied."); liveLocationBtn.innerHTML = originalText; });
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                renderList(this.availableLocations.filter(loc => loc.toLowerCase().includes(term)));
            });
        }
        openBtn.addEventListener('click', openModal); closeBtn.addEventListener('click', closeModal); overlay.addEventListener('click', closeModal);
    },

    renderProductPage() {
        const container = document.getElementById('product-detail-container');
        if (!container) return;

        const urlParams = new URLSearchParams(window.location.search);
        const paramId = parseInt(urlParams.get('id')); 
        const product = this.catalog.find(p => p.id === paramId);

        if (!product) {
            container.innerHTML = `<div style="text-align:center; width: 100%; padding: 60px;"><h2>Product not found</h2><p>This product may have been deleted.</p></div>`;
            return;
        }

        const isBase64 = product.imgUrl.startsWith('data:');
        const highResImgUrl = isBase64 ? product.imgUrl : product.imgUrl.replace('?w=400', '?w=1200');
        const isOwner = SessionManager.getCurrentUser() === product.sellerUsername;

        let actionButtonsHtml = `
            <button class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 15px;" onclick="window.location.href='messages.html?user=${product.sellerUsername}'">Message</button>
            <button class="btn btn-dark" style="flex: 1; padding: 12px; font-size: 15px; background: white; color: #333; border: 1px solid #ddd;" onclick="SiteSaved.saveItemById(${product.id})">Save Item</button>
        `;
        let editFormHtml = "";

        if (isOwner) {
            actionButtonsHtml = `
                <button id="toggle-edit-btn" class="btn btn-dark" style="flex: 1; padding: 12px; font-size: 15px; background: #e5e5e5; color: #333;">✎ Edit Listing</button>
                <button class="btn" style="flex: 1; padding: 12px; font-size: 15px; background: #ffebee; color: #c62828; border: 1px solid #ffcdd2;" onclick="ProductManager.deleteProduct(${product.id})">🗑 Delete</button>
            `;

            editFormHtml = `
                <form id="edit-product-form" style="display: none; margin-top: 24px; border-top: 1px solid var(--color-border); padding-top: 24px;">
                    <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px;">Update Details</h3>
                    <div class="form-group">
                        <label style="font-weight: 600; font-size: 13px; display:block; margin-bottom: 6px;">Product Title</label>
                        <input type="text" id="edit-prod-title" class="form-input" required value="${product.title}">
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 600; font-size: 13px; display:block; margin-bottom: 6px;">Price (RM)</label>
                        <input type="number" id="edit-prod-price" class="form-input" required min="1" step="0.50" value="${product.price}">
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 600; font-size: 13px; display:block; margin-bottom: 6px;">Change Image (Optional)</label>
                        <input type="file" id="edit-prod-img" class="form-input" accept="image/*" style="padding: 8px;">
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 16px;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Save</button>
                        <button type="button" id="cancel-edit-btn" class="btn btn-dark" style="flex: 1;">Cancel</button>
                    </div>
                </form>
            `;
        }
        
        container.innerHTML = `
            <div class="product-gallery">
                <div class="product-gallery__viewer"><img src="${highResImgUrl}" alt="${product.title}"></div>
                <div class="surface-card" style="margin-top: 24px;"><h3>Description</h3><p style="color: var(--color-text-muted);">This is a highly rated ${product.title} available right now in ${product.location}.</p></div>
            </div>
            <aside class="product-sidebar">
                <div class="surface-card">
                    <h1 style="font-size: 24px; margin-bottom: 8px;">${product.title}</h1>
                    <p style="font-size: 20px; font-weight: bold; margin-bottom: 8px; color: var(--color-primary);">RM${product.price.toFixed(2)}</p>
                    <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 24px;">Listed in ${product.location} • Seller: <span style="font-weight:600">${product.sellerUsername}</span></p>
                    
                    <div style="display: flex; gap: 12px;">
                        ${actionButtonsHtml}
                    </div>
                    
                    ${editFormHtml}
                </div>
            </aside>`;

        if (isOwner) {
            const toggleBtn = document.getElementById('toggle-edit-btn');
            const cancelBtn = document.getElementById('cancel-edit-btn');
            const editForm = document.getElementById('edit-product-form');

            toggleBtn.addEventListener('click', () => editForm.style.display = 'block');
            cancelBtn.addEventListener('click', () => editForm.style.display = 'none');

            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const newTitle = document.getElementById('edit-prod-title').value.trim();
                const newPrice = document.getElementById('edit-prod-price').value;
                const fileInput = document.getElementById('edit-prod-img');
                
                if (fileInput.files && fileInput.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            if (img.width < 500 || img.height < 500) return alert(`Image is too small (${img.width}x${img.height}px). Minimum requirement is 500x500px.`);
                            ProductManager.updateProduct(product.id, newTitle, newPrice, event.target.result);
                            window.location.reload();
                        };
                        img.src = event.target.result;
                    }
                    reader.readAsDataURL(fileInput.files[0]);
                } else {
                    ProductManager.updateProduct(product.id, newTitle, newPrice, null);
                    window.location.reload();
                }
            });
        }
    },

    renderChatInterface(activeContact) {
        const sidebarEl = document.getElementById('chat-sidebar');
        const windowEl = document.getElementById('chat-window');

        if (!SessionManager.isLoggedIn()) {
            sidebarEl.innerHTML = '';
            windowEl.innerHTML = `
                <div style="padding: 60px; text-align: center; width: 100%; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <h3>You must be logged in to send messages.</h3>
                    <br><a href="login.html" class="btn btn-primary" style="align-self: center;">Log In Now</a>
                </div>`;
            return;
        }

        const currentUser = SessionManager.getCurrentUser();

        // Clear Unread Status for the active contact
        if (activeContact) {
            MessageManager.markAsRead(activeContact, currentUser);
        }

        let contacts = MessageManager.getConversations(currentUser);
        
        if (activeContact && !contacts.includes(activeContact) && activeContact !== currentUser) {
            contacts.unshift(activeContact);
        }
        
        if (!activeContact && contacts.length > 0) {
            activeContact = contacts[0];
            MessageManager.markAsRead(activeContact, currentUser);
        }

        sidebarEl.innerHTML = contacts.map(c => {
            const contactUser = DatabaseManager.getUser(c);
            const avatar = contactUser ? contactUser.avatar : "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400";
            return `
                <div class="chat-contact ${c === activeContact ? 'active' : ''}" onclick="window.location.href='messages.html?user=${c}'">
                    <img src="${avatar}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover;">
                    <div style="font-weight: 600; font-size: 15px;">${c}</div>
                </div>`;
        }).join('');

        if (contacts.length === 0 && !activeContact) {
            sidebarEl.innerHTML = `<div style="padding: 24px; color: var(--color-text-muted); text-align: center;">No messages yet.</div>`;
        }

        if (activeContact) {
            const history = MessageManager.getChatHistory(currentUser, activeContact);
            const activeUserObj = DatabaseManager.getUser(activeContact);
            const activeAvatar = activeUserObj ? activeUserObj.avatar : "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400";
            
            windowEl.innerHTML = `
                <div class="chat-header">
                    <img src="${activeAvatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-right: 8px;">
                    ${activeContact}
                </div>
                
                <div class="chat-messages" id="chat-messages-container">
                    ${history.length === 0 ? `<div style="text-align: center; color: var(--color-text-muted); margin-top: 40px; font-size: 14px;">Send a message to start the conversation!</div>` : ''}
                    ${history.map(m => `
                        <div class="chat-bubble ${m.sender === currentUser ? 'sent' : 'received'}">
                            ${m.text}
                        </div>
                    `).join('')}
                </div>
                
                <form class="chat-input-area" id="chat-form">
                    <input type="text" id="chat-input-text" class="chat-input" placeholder="Type your message..." required autocomplete="off">
                    <button type="submit" class="btn btn-primary" style="border-radius: 50px; padding: 0 24px;">Send</button>
                </form>
            `;

            const msgContainer = document.getElementById('chat-messages-container');
            msgContainer.scrollTop = msgContainer.scrollHeight;

            document.getElementById('chat-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const textInput = document.getElementById('chat-input-text');
                const text = textInput.value.trim();
                
                if (text) {
                    MessageManager.sendMessage(activeContact, text);
                    this.renderChatInterface(activeContact); 
                }
            });
        } else {
            windowEl.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 16px; background: #f9f9f9;">Select a conversation to start messaging</div>`;
        }
    },

renderNotificationsPage() {
    const listEl = document.getElementById('notification-list');
    if (!listEl) return;
    const currentUser = SessionManager.getCurrentUser();
    if (!currentUser) return;

    const settings = NotificationManager.getMuteSettings();
    const allNotifs = NotificationManager.getNotifications().filter(n => n.username === currentUser);
    
    // NEW: Filter out muted types for the display list ONLY
    const visibleNotifs = allNotifs.filter(n => !settings[n.type]);

    const muteControls = `
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button class="btn btn-sm ${settings.message ? 'btn-primary' : 'btn-dark'}" onclick="NotificationManager.toggleMute('message')">
                ${settings.message ? 'Unmute Messages' : 'Mute Messages'}
            </button>
            <button class="btn btn-sm ${settings.save ? 'btn-primary' : 'btn-dark'}" onclick="NotificationManager.toggleMute('save')">
                ${settings.save ? 'Unmute Save Alerts' : 'Mute Save Alerts'}
            </button>
        </div>`;
    
    if (visibleNotifs.length === 0) {
        listEl.innerHTML = muteControls + `<div style="padding: 20px; color: gray;">No unmuted notifications.</div>`;
    } else {
        listEl.innerHTML = muteControls + visibleNotifs.map(n => `
            <div style="padding: 16px; border-bottom: 1px solid #eee; background: ${n.read ? 'transparent' : 'rgba(0,123,255,0.05)'}; cursor: pointer;" onclick="window.location.href='${n.link}'">
                <div><strong>${n.text}</strong></div>
                <div style="font-size: 12px; color: gray;">${new Date(n.timestamp).toLocaleString()}</div>
            </div>`).join('');
    }

    NotificationManager.markAllAsRead(currentUser);
},

    init() {
        this.catalog = ProductManager.getProducts();
        SessionManager.updateHeaderUI();
        SiteSaved.renderSavedPage(); 
        this.initLocationModal(); 
        this.renderNotificationsPage();

        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const user = document.getElementById('username').value.trim();
                const pass = document.getElementById('password').value;
                try {
                    DatabaseManager.verifyUser(user, pass);
                    SessionManager.login(user);
                    alert("Login successful! Welcome back.");
                    window.location.href = "index.html"; 
                } catch (err) {
                    alert("Login failed: " + err.message);
                }
            });
        }

        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const user = document.getElementById('username').value.trim();
                const pass = document.getElementById('password').value;
                try {
                    DatabaseManager.registerUser(user, pass);
                    SessionManager.login(user);
                    alert("Account created successfully! Welcome to PasarKita.");
                    window.location.href = "index.html";
                } catch (err) {
                    alert("Registration failed: " + err.message);
                }
            });
        }
        
        if (document.getElementById('main-product-grid')) this.renderHomepageCatalog("", true);

        const addProductForm = document.getElementById('add-product-form');
        if (addProductForm) {
            addProductForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = document.getElementById('prod-title').value.trim();
                const price = document.getElementById('prod-price').value;
                const location = document.getElementById('prod-location').value;
                const fileInput = document.getElementById('prod-img');

                if (!fileInput.files || fileInput.files.length === 0) return alert("Please select an image.");
                const file = fileInput.files[0];
                const reader = new FileReader();

                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        if (img.width < 500 || img.height < 500) return alert(`Upload failed: Image is too small (${img.width}x${img.height}px). Minimum requirement is 500x500px.`);
                        try {
                            ProductManager.addProduct(title, price, location, event.target.result);
                            alert("Product listed successfully!"); window.location.href = "selleraccount.html"; 
                        } catch (err) { alert("Error saving product: " + err.message); }
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        const sellerGrid = document.getElementById('seller-product-grid');
        if (sellerGrid) {
            if (!SessionManager.isLoggedIn()) {
                sellerGrid.innerHTML = `<p style="color: var(--color-text-muted);">Please <a href="login.html" style="color: var(--color-primary); font-weight: bold;">log in</a> to view your active listings.</p>`;
            } else {
                const activeUsername = SessionManager.getCurrentUser();
                const myListings = this.catalog.filter(item => item.sellerUsername === activeUsername);
                
                if (myListings.length > 0) sellerGrid.innerHTML = myListings.map(item => item.render(true)).join('');
                else sellerGrid.innerHTML = `<p style="grid-column: 1 / -1; color: var(--color-text-muted);">You currently have no active listings.</p>`;
                
                new SellerAccount(activeUsername).renderDashboard();

                const attachUpload = (inputId, targetImgId, dbField, isBg = false, minWidth = 400, minHeight = 400) => {
                    const input = document.getElementById(inputId);
                    if (!input) return;
                    input.addEventListener('change', (e) => {
                        const file = e.target.files[0]; if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const b64 = event.target.result;
                            
                            const img = new Image();
                            img.onload = () => {
                                if (img.width < minWidth || img.height < minHeight) {
                                    alert(`Upload failed: Image is too small (${img.width}x${img.height}px). Minimum requirement for this is ${minWidth}x${minHeight}px.`);
                                    input.value = ""; 
                                    return;
                                }
                                
                                if (dbField === 'avatar') DatabaseManager.updateProfile(activeUsername, b64, null, null);
                                if (dbField === 'banner') DatabaseManager.updateProfile(activeUsername, null, null, b64);
                                
                                if (isBg) document.getElementById(targetImgId).style.backgroundImage = `url(${b64})`;
                                else document.getElementById(targetImgId).src = b64;
                            };
                            img.src = b64;
                        };
                        reader.readAsDataURL(file);
                    });
                };
                
                attachUpload('avatar-upload', 'shop-avatar', 'avatar', false, 400, 400);
                attachUpload('banner-upload', 'shop-banner', 'banner', true, 800, 200);

                const editDescBtn = document.getElementById('edit-desc-btn');
                if (editDescBtn) {
                    const [descCont, editCont, saveBtn, cancelBtn, descInput, descText] = ['shop-desc-container', 'shop-desc-edit', 'save-desc-btn', 'cancel-desc-btn', 'shop-desc-input', 'shop-desc-text'].map(id => document.getElementById(id));
                    
                    editDescBtn.addEventListener('click', () => { 
                        descCont.style.display = 'none'; 
                        editCont.style.display = 'block'; 
                    });
                    
                    cancelBtn.addEventListener('click', () => { 
                        editCont.style.display = 'none'; 
                        descCont.style.display = 'block'; 
                        descInput.value = descText.innerText; 
                    });
                    
                    saveBtn.addEventListener('click', () => {
                        const newDesc = descInput.value.trim();
                        DatabaseManager.updateProfile(activeUsername, null, newDesc, null);
                        
                        new SellerAccount(activeUsername).renderDashboard();
                        
                        editCont.style.display = 'none'; 
                        descCont.style.display = 'block';
                    });
                }

                const clearAvatarBtn = document.getElementById('clear-avatar-btn');
                if (clearAvatarBtn) clearAvatarBtn.addEventListener('click', () => {
                    if (confirm("Remove custom profile picture?")) {
                        const def = "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400";
                        DatabaseManager.updateProfile(activeUsername, def, null, null); document.getElementById('shop-avatar').src = def;
                    }
                });
                const clearBannerBtn = document.getElementById('clear-banner-btn');
                if (clearBannerBtn) clearBannerBtn.addEventListener('click', () => {
                    if (confirm("Remove custom banner?")) {
                        DatabaseManager.updateProfile(activeUsername, null, null, ""); document.getElementById('shop-banner').style.backgroundImage = '';
                    }
                });
            }
        }

        const searchInput = document.querySelector('.search-bar__input');
        const searchBtn = document.querySelector('.search-bar__btn');
        if (searchInput && searchBtn) {
            const executeSearch = () => {
                const query = searchInput.value.trim();
                if (!document.getElementById('main-product-grid')) window.location.href = `index.html?q=${encodeURIComponent(query)}`;
                else this.renderHomepageCatalog(query, true); 
            };
            searchBtn.addEventListener('click', executeSearch);
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') executeSearch(); 
                else if (document.getElementById('main-product-grid')) this.renderHomepageCatalog(e.target.value, true); 
            });
        }
        
        this.renderProductPage();
        
        if (window.location.pathname.includes('messages.html')) {
            this.renderChatInterface(new URLSearchParams(window.location.search).get('user'));
        }
    }
};

document.addEventListener('DOMContentLoaded', () => AppRouter.init());