const API_URL = 'http://localhost:3000/api';
let tg = window.Telegram.WebApp;
let cart = [];
let products = [];
let categories = [];
let paymentMethods = [];
let settings = {};

// Инициализация
tg.ready();
tg.expand();

// Загрузка данных
async function init() {
    try {
        // Загружаем все данные параллельно
        const [productsData, categoriesData, paymentsData, settingsData] = await Promise.all([
            fetch(`${API_URL}/products`).then(r => r.json()),
            fetch(`${API_URL}/categories`).then(r => r.json()),
            fetch(`${API_URL}/payment-methods`).then(r => r.json()),
            fetch(`${API_URL}/settings`).then(r => r.json())
        ]);
        
        products = productsData;
        categories = categoriesData;
        paymentMethods = paymentsData;
        settings = settingsData;
        
        // Устанавливаем название магазина
        document.getElementById('shopName').textContent = settings.shop_name || 'Магазин';
        
        // Отображаем данные
        renderCategories();
        renderProducts();
        renderPaymentMethods();
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('products').innerHTML = 
            '<div class="loading">Ошибка загрузки данных</div>';
    }
}

// Отображение категорий
function renderCategories() {
    const container = document.getElementById('categories');
    
    const allButton = document.createElement('button');
    allButton.className = 'category-chip active';
    allButton.textContent = 'Все';
    allButton.onclick = () => filterByCategory(null);
    container.appendChild(allButton);
    
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-chip';
        button.textContent = category.name;
        button.onclick = () => filterByCategory(category.id);
        container.appendChild(button);
    });
}

// Фильтрация по категории
function filterByCategory(categoryId) {
    // Обновляем активную кнопку
    document.querySelectorAll('.category-chip').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Фильтруем товары
    const filtered = categoryId 
        ? products.filter(p => p.category_id === categoryId)
        : products;
    
    renderProducts(filtered);
}

// Отображение товаров
function renderProducts(productsToShow = products) {
    const container = document.getElementById('products');
    
    if (productsToShow.length === 0) {
        container.innerHTML = '<div class="loading">Товары не найдены</div>';
        return;
    }
    
    container.innerHTML = productsToShow.map(product => `
        <div class="product-card" onclick="addToCart(${product.id})">
            <img src="${product.image || 'https://via.placeholder.com/160'}" 
                 alt="${product.name}" 
                 class="product-image">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-description">${product.description || ''}</div>
                <div class="product-price">
                    ${product.price} ₽
                    ${product.old_price ? `<span class="old-price">${product.old_price} ₽</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Добавить в корзину
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }
    
    updateCart();
    
    // Вибрация при добавлении
    tg.HapticFeedback.impactOccurred('light');
}

// Обновить корзину
function updateCart() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const cartButton = document.getElementById('cartButton');
    document.getElementById('cartTotal').textContent = `${total} ₽`;
    
    if (cart.length > 0) {
        cartButton.classList.add('active');
    } else {
        cartButton.classList.remove('active');
    }
}

// Открыть корзину
document.getElementById('cartButton').onclick = function() {
    const modal = document.getElementById('cartModal');
    modal.classList.add('active');
    renderCartItems();
};

// Закрыть корзину
function closeCart() {
    document.getElementById('cartModal').classList.remove('active');
}

// Отображение товаров в корзине
function renderCartItems() {
    const container = document.getElementById('cartItems');
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Корзина пуста</div>';
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('modalTotal').textContent = `${total} ₽`;
    
    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image || 'https://via.placeholder.com/60'}" 
                 alt="${item.name}" 
                 class="cart-item-image">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${item.price} ₽</div>
                <div class="quantity-control">
                    <button class="quantity-button" onclick="changeQuantity(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-button" onclick="changeQuantity(${item.id}, 1)">+</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Изменить количество
function changeQuantity(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    
    item.quantity += delta;
    
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }
    
    updateCart();
    renderCartItems();
    tg.HapticFeedback.impactOccurred('light');
}

// Отображение способов оплаты
function renderPaymentMethods() {
    const select = document.getElementById('paymentMethod');
    select.innerHTML = paymentMethods.map(method => 
        `<option value="${method.name}">${method.name}</option>`
    ).join('');
}

// Оформить заказ
function checkout() {
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const comment = document.getElementById('comment').value;
    
    if (!phone || !address) {
        tg.showAlert('Заполните все обязательные поля');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Проверка минимальной суммы заказа
    const minOrderAmount = parseFloat(settings.min_order_amount || 0);
    if (total < minOrderAmount) {
        tg.showAlert(`Минимальная сумма заказа: ${minOrderAmount} ₽`);
        return;
    }
    
    const orderData = {
        cart: cart,
        total: total,
        phone: phone,
        address: address,
        paymentMethod: paymentMethod,
        comment: comment
    };
    
    // Отправляем данные боту
    tg.sendData(JSON.stringify(orderData));
    
    // Закрываем приложение
    tg.close();
}

// Закрытие модального окна по клику вне его
window.onclick = function(event) {
    if (event.target.id === 'cartModal') {
        closeCart();
    }
}

// Запуск
init();
