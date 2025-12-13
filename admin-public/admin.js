const API_URL = 'http://localhost:3001/api/admin';

// ==============================================
// Переключение разделов
// ==============================================
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
    
    // Загружаем данные для раздела
    loadSectionData(sectionId);
}

// ==============================================
// Загрузка данных
// ==============================================
async function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            loadStatistics();
            break;
        case 'products':
            loadProducts();
            break;
        case 'categories':
            loadCategories();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'payments':
            loadPaymentMethods();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Загрузка статистики
async function loadStatistics() {
    try {
        const response = await fetch(`${API_URL}/statistics`);
        const stats = await response.json();
        
        document.getElementById('totalOrders').textContent = stats.totalOrders;
        document.getElementById('totalRevenue').textContent = stats.totalRevenue.toFixed(2) + ' ₽';
        document.getElementById('totalProducts').textContent = stats.totalProducts;
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('todayOrders').textContent = stats.todayOrders;
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Загрузка товаров
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();
        
        const tbody = document.querySelector('#productsTable tbody');
        tbody.innerHTML = products.map(product => `
            <tr>
                <td>
                    ${product.image ? `<img src="${product.image}" class="product-image">` : '📦'}
                </td>
                <td>${product.name}</td>
                <td>${product.category_name || '-'}</td>
                <td>${product.price} ₽</td>
                <td>
                    <span class="status-badge ${product.active ? 'status-active' : 'status-inactive'}">
                        ${product.active ? 'Активен' : 'Неактивен'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary" onclick="editProduct(${product.id})">Изменить</button>
                    <button class="btn btn-danger" onclick="deleteProduct(${product.id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Загрузка категорий
async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();
        
        const tbody = document.querySelector('#categoriesTable tbody');
        tbody.innerHTML = categories.map(category => `
            <tr>
                <td>${category.name}</td>
                <td>${category.description || '-'}</td>
                <td>${category.order_index}</td>
                <td>
                    <span class="status-badge ${category.active ? 'status-active' : 'status-inactive'}">
                        ${category.active ? 'Активна' : 'Неактивна'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary" onclick="editCategory(${category.id})">Изменить</button>
                    <button class="btn btn-danger" onclick="deleteCategory(${category.id})">Удалить</button>
                </td>
            </tr>
        `).join('');
        
        // Обновляем селект категорий в форме товара
        updateCategorySelect(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Загрузка заказов
async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`);
        const orders = await response.json();
        
        const tbody = document.querySelector('#ordersTable tbody');
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.order_number}</td>
                <td>${order.first_name || ''} ${order.last_name || ''} (@${order.username || '-'})</td>
                <td>${order.total} ₽</td>
                <td>
                    <select onchange="updateOrderStatus(${order.id}, this.value)">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ Ожидает</option>
                        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>✅ Подтвержден</option>
                        <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>👨‍🍳 Готовится</option>
                        <option value="delivering" ${order.status === 'delivering' ? 'selected' : ''}>🚚 Доставляется</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>✅ Выполнен</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Отменен</option>
                    </select>
                </td>
                <td>${new Date(order.created_at).toLocaleString('ru-RU')}</td>
                <td>
                    <button class="btn btn-primary" onclick="viewOrder(${order.id})">Подробнее</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Загрузка способов оплаты
async function loadPaymentMethods() {
    try {
        const response = await fetch(`${API_URL}/payment-methods`);
        const methods = await response.json();
        
        const tbody = document.querySelector('#paymentsTable tbody');
        tbody.innerHTML = methods.map(method => `
            <tr>
                <td>${method.name}</td>
                <td>${method.type}</td>
                <td>${method.description || '-'}</td>
                <td>
                    <span class="status-badge ${method.active ? 'status-active' : 'status-inactive'}">
                        ${method.active ? 'Активен' : 'Неактивен'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary" onclick="editPaymentMethod(${method.id})">Изменить</button>
                    <button class="btn btn-danger" onclick="deletePaymentMethod(${method.id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading payment methods:', error);
    }
}

// Загрузка настроек
async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/settings`);
        const settings = await response.json();
        
        const form = document.getElementById('settingsForm');
        Object.keys(settings).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = settings[key];
            }
        });
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// ==============================================
// Товары
// ==============================================
function showProductModal(productId = null) {
    document.getElementById('productModal').classList.add('active');
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = productId || '';
    document.getElementById('productModalTitle').textContent = productId ? 'Редактировать товар' : 'Добавить товар';
    
    if (productId) {
        // Загрузить данные товара
        // TODO: Implement edit functionality
    }
}

async function editProduct(id) {
    // TODO: Load product data and show modal
    showProductModal(id);
}

async function deleteProduct(id) {
    if (!confirm('Удалить товар?')) return;
    
    try {
        await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        loadProducts();
    } catch (error) {
        alert('Ошибка при удалении товара');
    }
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const productId = formData.get('id');
    
    try {
        const url = productId ? `${API_URL}/products/${productId}` : `${API_URL}/products`;
        const method = productId ? 'PUT' : 'POST';
        
        await fetch(url, {
            method: method,
            body: formData
        });
        
        closeModal('productModal');
        loadProducts();
    } catch (error) {
        alert('Ошибка при сохранении товара');
    }
});

// ==============================================
// Категории
// ==============================================
function showCategoryModal(categoryId = null) {
    document.getElementById('categoryModal').classList.add('active');
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = categoryId || '';
}

async function editCategory(id) {
    showCategoryModal(id);
}

async function deleteCategory(id) {
    if (!confirm('Удалить категорию?')) return;
    
    try {
        await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
        loadCategories();
    } catch (error) {
        alert('Ошибка при удалении категории');
    }
}

document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const categoryId = formData.get('id');
    
    try {
        const url = categoryId ? `${API_URL}/categories/${categoryId}` : `${API_URL}/categories`;
        const method = categoryId ? 'PUT' : 'POST';
        
        await fetch(url, {
            method: method,
            body: formData
        });
        
        closeModal('categoryModal');
        loadCategories();
    } catch (error) {
        alert('Ошибка при сохранении категории');
    }
});

// ==============================================
// Способы оплаты
// ==============================================
function showPaymentModal(paymentId = null) {
    document.getElementById('paymentModal').classList.add('active');
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentId').value = paymentId || '';
}

async function deletePaymentMethod(id) {
    if (!confirm('Удалить способ оплаты?')) return;
    
    try {
        await fetch(`${API_URL}/payment-methods/${id}`, { method: 'DELETE' });
        loadPaymentMethods();
    } catch (error) {
        alert('Ошибка при удалении');
    }
}

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const paymentId = data.id;
    delete data.id;
    
    try {
        const url = paymentId ? `${API_URL}/payment-methods/${paymentId}` : `${API_URL}/payment-methods`;
        const method = paymentId ? 'PUT' : 'POST';
        
        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        closeModal('paymentModal');
        loadPaymentMethods();
    } catch (error) {
        alert('Ошибка при сохранении');
    }
});

// ==============================================
// Заказы
// ==============================================
async function updateOrderStatus(orderId, status) {
    try {
        await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
    } catch (error) {
        alert('Ошибка при обновлении статуса');
    }
}

function viewOrder(orderId) {
    // TODO: Show order details
    alert('Просмотр заказа ' + orderId);
}

// ==============================================
// Настройки
// ==============================================
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const settings = Object.fromEntries(formData);
    
    try {
        await fetch(`${API_URL}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        alert('Настройки сохранены');
    } catch (error) {
        alert('Ошибка при сохранении настроек');
    }
});

// ==============================================
// Вспомогательные функции
// ==============================================
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function updateCategorySelect(categories) {
    const select = document.getElementById('productCategory');
    select.innerHTML = '<option value="">Выберите категорию</option>' +
        categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
}

// Закрытие модального окна по клику вне его
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// Загрузка данных при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    loadCategories();
});
