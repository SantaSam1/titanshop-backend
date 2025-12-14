require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Инициализация
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Создаем папку для загрузок
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Настройка multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Только изображения разрешены!'));
    }
});

// ==============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==============================================

async function isAdmin(telegramId) {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',').map(id => id.trim()) || [];
    return adminIds.includes(String(telegramId));
}

async function saveUser(user) {
    const admin = await isAdmin(user.id);
    await pool.query(
        'INSERT INTO users (telegram_id, username, first_name, last_name, is_admin) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (telegram_id) DO UPDATE SET username = $2, first_name = $3, last_name = $4, is_admin = $5, updated_at = CURRENT_TIMESTAMP',
        [user.id, user.username, user.first_name, user.last_name, admin]
    );
}

function getStatusEmoji(status) {
    const statuses = {
        'pending': '⏳ Ожидает',
        'confirmed': '✅ Подтвержден',
        'preparing': '👨‍🍳 Готовится',
        'delivering': '🚚 Доставляется',
        'completed': '✅ Завершен',
        'cancelled': '❌ Отменен'
    };
    return statuses[status] || '❓ Неизвестно';
}

// ==============================================
// ГЛАВНОЕ МЕНЮ
// ==============================================

async function getMainKeyboard(userId) {
    const isAdminUser = await isAdmin(userId);
    
    const keyboard = {
        keyboard: [
            [{ text: '🛍 Открыть магазин', web_app: { url: process.env.WEB_APP_URL } }],
            [{ text: '📦 Мои заказы' }, { text: 'ℹ️ О магазине' }],
            [{ text: '📞 Контакты' }]
        ],
        resize_keyboard: true
    };
    
    if (isAdminUser) {
        keyboard.keyboard.push([{ text: '⚙️ Админ-панель' }]);
    }
    
    return keyboard;
}

function getAdminKeyboard() {
    return {
        keyboard: [
            [{ text: '📊 Статистика' }, { text: '📦 Заказы' }],
            [{ text: '🏷 Категории' }, { text: '📦 Товары' }],
            [{ text: '💳 Способы оплаты' }, { text: '⚙️ Настройки' }],
            [{ text: '👥 Пользователи' }, { text: '📤 Рассылка' }],
            [{ text: '🔙 Назад в главное меню' }]
        ],
        resize_keyboard: true
    };
}

// ==============================================
// КОМАНДЫ БОТА
// ==============================================

// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    await saveUser(user);
    const keyboard = await getMainKeyboard(user.id);
    
    bot.sendMessage(chatId, 
        `Привет, ${user.first_name}! 👋\n\n` +
        '🏪 Добро пожаловать в наш магазин!\n\n' +
        'Нажмите "🛍 Открыть магазин" чтобы посмотреть меню и сделать заказ.',
        { reply_markup: keyboard }
    );
});

// Мои заказы
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    
    if (!text) return;
    
    // Мои заказы
    if (text === '📦 Мои заказы') {
        const result = await pool.query(
            'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
            [userId]
        );
        
        if (result.rows.length === 0) {
            bot.sendMessage(chatId, '❌ У вас пока нет заказов');
            return;
        }
        
        let message = '📦 Ваши последние заказы:\n\n';
        result.rows.forEach(order => {
            message += `${getStatusEmoji(order.status)}\n`;
            message += `Заказ №${order.order_number}\n`;
            message += `💰 Сумма: ${order.total} ₸\n`;
            message += `📅 Дата: ${new Date(order.created_at).toLocaleString('ru-RU')}\n\n`;
        });
        
        bot.sendMessage(chatId, message);
    }
    
    // О магазине
    else if (text === 'ℹ️ О магазине') {
        const settings = await pool.query('SELECT * FROM settings');
        const settingsMap = {};
        settings.rows.forEach(s => settingsMap[s.key] = s.value);
        
        const message = 
            `🏪 ${settingsMap.shop_name || 'Наш магазин'}\n\n` +
            `⏰ Время работы: ${settingsMap.working_hours || '10:00 - 22:00'}\n` +
            `💰 Минимальный заказ: ${settingsMap.min_order_amount || '0'} ₸\n` +
            `🚚 Доставка: ${settingsMap.delivery_cost || '0'} ₸\n` +
            `🎁 Бесплатная доставка от: ${settingsMap.free_delivery_from || '0'} ₸`;
        
        bot.sendMessage(chatId, message);
    }
    
    // Контакты
    else if (text === '📞 Контакты') {
        const settings = await pool.query('SELECT * FROM settings');
        const settingsMap = {};
        settings.rows.forEach(s => settingsMap[s.key] = s.value);
        
        bot.sendMessage(chatId, 
            '📞 Наши контакты:\n\n' +
            `☎️ Телефон: ${settingsMap.contact_phone || '+7 (XXX) XXX-XX-XX'}\n` +
            `📧 Email: ${settingsMap.contact_email || 'support@shop.com'}\n\n` +
            `⏰ Работаем: ${settingsMap.working_hours || 'ежедневно с 10:00 до 22:00'}`
        );
    }
    
    // Админ-панель
    else if (text === '⚙️ Админ-панель') {
        if (!await isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ У вас нет доступа к админ-панели');
            return;
        }
        
        const keyboard = getAdminKeyboard();
        bot.sendMessage(chatId, '⚙️ *Админ-панель*\n\nВыберите действие:', {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    }
    
    // Назад в главное меню
    else if (text === '🔙 Назад в главное меню') {
        const keyboard = await getMainKeyboard(userId);
        bot.sendMessage(chatId, 'Главное меню:', { reply_markup: keyboard });
    }
    
    // Статистика (админ)
    else if (text === '📊 Статистика') {
        if (!await isAdmin(userId)) return;
        
        const ordersCount = await pool.query('SELECT COUNT(*) FROM orders');
        const productsCount = await pool.query('SELECT COUNT(*) FROM products WHERE active = true');
        const categoriesCount = await pool.query('SELECT COUNT(*) FROM categories WHERE active = true');
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const todayOrders = await pool.query(
            "SELECT COUNT(*), SUM(total) FROM orders WHERE DATE(created_at) = CURRENT_DATE"
        );
        
        const message = 
            '📊 *Статистика магазина*\n\n' +
            `👥 Всего пользователей: ${usersCount.rows[0].count}\n` +
            `📦 Всего заказов: ${ordersCount.rows[0].count}\n` +
            `🏷 Категорий: ${categoriesCount.rows[0].count}\n` +
            `📦 Активных товаров: ${productsCount.rows[0].count}\n\n` +
            `📅 Заказов сегодня: ${todayOrders.rows[0].count || 0}\n` +
            `💰 Сумма за сегодня: ${todayOrders.rows[0].sum || 0} ₸`;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
    
    // Заказы (админ)
    else if (text === '📦 Заказы') {
        if (!await isAdmin(userId)) return;
        
        const orders = await pool.query(
            'SELECT o.*, u.first_name, u.username FROM orders o LEFT JOIN users u ON o.user_id = u.telegram_id ORDER BY o.created_at DESC LIMIT 10'
        );
        
        if (orders.rows.length === 0) {
            bot.sendMessage(chatId, '❌ Заказов пока нет');
            return;
        }
        
        let message = '📦 *Последние заказы:*\n\n';
        orders.rows.forEach(order => {
            message += `${getStatusEmoji(order.status)}\n`;
            message += `№${order.order_number}\n`;
            message += `👤 ${order.first_name || 'Пользователь'} (@${order.username || 'нет'})\n`;
            message += `💰 ${order.total} ₸\n`;
            message += `📅 ${new Date(order.created_at).toLocaleString('ru-RU')}\n\n`;
        });
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
    
    // Категории (админ)
    else if (text === '🏷 Категории') {
        if (!await isAdmin(userId)) return;
        
        const categories = await pool.query('SELECT * FROM categories ORDER BY order_index');
        
        if (categories.rows.length === 0) {
            bot.sendMessage(chatId, '❌ Категорий пока нет\n\nИспользуйте веб-админку для управления категориями:\n' + 
                process.env.WEB_APP_URL + '/admin.html');
            return;
        }
        
        let message = '🏷 *Категории:*\n\n';
        categories.rows.forEach(cat => {
            message += `📁 ${cat.name}\n`;
            message += `   Статус: ${cat.active ? '✅' : '❌'}\n`;
            message += `   Порядок: ${cat.order_index}\n\n`;
        });
        message += '\nДля редактирования откройте веб-админку:\n' + process.env.WEB_APP_URL + '/admin.html';
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
    
    // Товары (админ)
    else if (text === '📦 Товары') {
        if (!await isAdmin(userId)) return;
        
        const products = await pool.query(
            'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.order_index LIMIT 20'
        );
        
        if (products.rows.length === 0) {
            bot.sendMessage(chatId, '❌ Товаров пока нет\n\nИспользуйте веб-админку для добавления товаров:\n' + 
                process.env.WEB_APP_URL + '/admin.html');
            return;
        }
        
        let message = '📦 *Товары:*\n\n';
        products.rows.forEach(prod => {
            message += `${prod.active ? '✅' : '❌'} ${prod.name}\n`;
            message += `   Категория: ${prod.category_name || 'Без категории'}\n`;
            message += `   Цена: ${prod.price} ₸\n`;
            message += `   ${prod.in_stock ? '📦 В наличии' : '❌ Нет в наличии'}\n\n`;
        });
        message += '\nДля редактирования откройте веб-админку:\n' + process.env.WEB_APP_URL + '/admin.html';
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
});

// ==============================================
// WEB APP - Обработка заказов
// ==============================================

bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const data = JSON.parse(msg.web_app_data.data);
        
        const orderNumber = 'ORD-' + Date.now();
        const order = await pool.query(
            'INSERT INTO orders (order_number, user_id, items, total, payment_method, phone, delivery_address, comment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [orderNumber, userId, JSON.stringify(data.cart), data.total, data.paymentMethod, data.phone, data.address, data.comment]
        );
        
        let orderMessage = `✅ Заказ №${orderNumber} принят!\n\n`;
        orderMessage += '🛒 Ваш заказ:\n';
        
        data.cart.forEach(item => {
            orderMessage += `  • ${item.name} x${item.quantity} - ${item.price * item.quantity} ₸\n`;
        });
        
        orderMessage += `\n💰 Итого: ${data.total} ₸\n`;
        orderMessage += `💳 Оплата: ${data.paymentMethod}\n`;
        
        if (data.address) orderMessage += `📍 Адрес: ${data.address}\n`;
        if (data.phone) orderMessage += `📞 Телефон: ${data.phone}\n`;
        
        bot.sendMessage(chatId, orderMessage);
        
        // Уведомление администраторов
        const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',') || [];
        adminIds.forEach(adminId => {
            bot.sendMessage(adminId, 
                `🔔 НОВЫЙ ЗАКАЗ №${orderNumber}\n\n` +
                `👤 Клиент: ${msg.from.first_name} (@${msg.from.username || 'нет'})\n` +
                orderMessage
            );
        });
        
    } catch (error) {
        console.error('Error processing order:', error);
        bot.sendMessage(chatId, '❌ Ошибка при обработке заказа. Попробуйте еще раз.');
    }
});

// ==============================================
// API ДЛЯ MINI APP
// ==============================================

// Проверка админа (упрощенная)
app.use('/api/admin/*', async (req, res, next) => {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId || !await isAdmin(telegramId)) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }
    next();
});

// Публичные API
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories WHERE active = true ORDER BY order_index');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = true ORDER BY c.order_index, p.order_index'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/payment-methods', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payment_methods WHERE active = true ORDER BY order_index');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/settings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM settings');
        const settings = {};
        result.rows.forEach(row => settings[row.key] = row.value);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Админ API
app.get('/api/admin/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY order_index');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/categories', upload.single('image'), async (req, res) => {
    try {
        const { name, description, active, order_index } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;
        
        const result = await pool.query(
            'INSERT INTO categories (name, description, image_url, active, order_index) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, image_url, active !== 'false', order_index || 0]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/categories/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, active, order_index } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
        
        const result = await pool.query(
            'UPDATE categories SET name = $1, description = $2, image_url = $3, active = $4, order_index = $5 WHERE id = $6 RETURNING *',
            [name, description, image_url, active !== 'false', order_index || 0, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/categories/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/products', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.order_index'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/products', upload.single('image'), async (req, res) => {
    try {
        const { category_id, name, description, price, old_price, active, in_stock, order_index } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;
        
        const result = await pool.query(
            'INSERT INTO products (category_id, name, description, price, old_price, image_url, active, in_stock, order_index) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [category_id, name, description, price, old_price || null, image_url, active !== 'false', in_stock !== 'false', order_index || 0]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/products/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, name, description, price, old_price, active, in_stock, order_index } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
        
        const result = await pool.query(
            'UPDATE products SET category_id = $1, name = $2, description = $3, price = $4, old_price = $5, image_url = $6, active = $7, in_stock = $8, order_index = $9, updated_at = CURRENT_TIMESTAMP WHERE id = $10 RETURNING *',
            [category_id, name, description, price, old_price || null, image_url, active !== 'false', in_stock !== 'false', order_index || 0, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT o.*, u.first_name, u.username FROM orders o LEFT JOIN users u ON o.user_id = u.telegram_id ORDER BY o.created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const result = await pool.query(
            'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );
        
        const order = result.rows[0];
        bot.sendMessage(order.user_id, 
            `📦 Статус вашего заказа №${order.order_number} изменен:\n${getStatusEmoji(status)}`
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/settings', async (req, res) => {
    try {
        const settings = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await pool.query(
                'UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
                [value, key]
            );
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    res.json({ url: `/uploads/${req.file.filename}` });
});

// ==============================================
// ЗАПУСК СЕРВЕРА
// ==============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`✅ Бот запущен`);
    console.log(`📱 Админ-панель: ${process.env.WEB_APP_URL}/admin.html`);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});