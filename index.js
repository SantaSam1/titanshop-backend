require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

// Инициализация
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ==============================================
// БАЗА ДАННЫХ - Функции
// ==============================================

async function getCategories() {
  const result = await pool.query(
    'SELECT * FROM categories WHERE active = true ORDER BY order_index'
  );
  return result.rows;
}

async function getProductsByCategory(categoryId) {
  const result = await pool.query(
    'SELECT * FROM products WHERE category_id = $1 AND active = true ORDER BY order_index',
    [categoryId]
  );
  return result.rows;
}

async function getAllProducts() {
  const result = await pool.query(
    'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = true ORDER BY c.order_index, p.order_index'
  );
  return result.rows;
}

async function getProduct(id) {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0];
}

async function createOrder(userId, items, total, paymentMethod, phone, address, comment) {
  const orderNumber = 'ORD-' + Date.now();
  const result = await pool.query(
    'INSERT INTO orders (order_number, user_id, items, total, payment_method, phone, delivery_address, comment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [orderNumber, userId, JSON.stringify(items), total, paymentMethod, phone, address, comment]
  );
  return result.rows[0];
}

async function getPaymentMethods() {
  const result = await pool.query(
    'SELECT * FROM payment_methods WHERE active = true ORDER BY order_index'
  );
  return result.rows;
}

async function saveUser(user) {
  await pool.query(
    'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4) ON CONFLICT (telegram_id) DO UPDATE SET username = $2, first_name = $3, last_name = $4',
    [user.id, user.username, user.first_name, user.last_name]
  );
}

// ==============================================
// TELEGRAM BOT - Обработчики
// ==============================================

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  await saveUser(user);
  
  const keyboard = {
    keyboard: [
      [{ text: '🛍 Открыть магазин', web_app: { url: process.env.WEB_APP_URL } }],
      [{ text: '📦 Мои заказы' }, { text: 'ℹ️ О магазине' }],
      [{ text: '📞 Контакты' }, { text: '⚙️ Настройки' }]
    ],
    resize_keyboard: true
  };
  
  bot.sendMessage(chatId, 
    `Привет, ${user.first_name}! 👋\n\n` +
    '🍔 Добро пожаловать в наш магазин!\n\n' +
    'Нажмите "🛍 Открыть магазин" чтобы посмотреть меню и сделать заказ.',
    { reply_markup: keyboard }
  );
});

// Мои заказы
bot.onText(/📦 Мои заказы/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
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
    const status = getStatusEmoji(order.status);
    message += `${status} Заказ №${order.order_number}\n`;
    message += `💰 Сумма: ${order.total} ₽\n`;
    message += `📅 Дата: ${new Date(order.created_at).toLocaleString('ru-RU')}\n`;
    message += `\n`;
  });
  
  bot.sendMessage(chatId, message);
});

// О магазине
bot.onText(/ℹ️ О магазине/, async (msg) => {
  const chatId = msg.chat.id;
  const settings = await pool.query('SELECT * FROM settings');
  const settingsMap = {};
  settings.rows.forEach(s => settingsMap[s.key] = s.value);
  
  const message = 
    `🏪 ${settingsMap.shop_name || 'Наш магазин'}\n\n` +
    `⏰ Время работы: ${settingsMap.working_hours || '10:00 - 22:00'}\n` +
    `💰 Минимальный заказ: ${settingsMap.min_order_amount || '0'} ₽\n` +
    `🚚 Доставка: ${settingsMap.delivery_cost || '0'} ₽\n` +
    `🎁 Бесплатная доставка от: ${settingsMap.free_delivery_from || '0'} ₽`;
  
  bot.sendMessage(chatId, message);
});

// Контакты
bot.onText(/📞 Контакты/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '📞 Наши контакты:\n\n' +
    '☎️ Телефон: +7 (XXX) XXX-XX-XX\n' +
    '📧 Email: support@shop.com\n' +
    '🌐 Сайт: www.shop.com\n\n' +
    '🕐 Работаем ежедневно с 10:00 до 22:00'
  );
});

// ==============================================
// WEB APP - Обработка данных из Mini App
// ==============================================

bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  try {
    const data = JSON.parse(msg.web_app_data.data);
    console.log('Received data from Mini App:', data);
    
    // Создаем заказ
    const order = await createOrder(
      userId,
      data.cart,
      data.total,
      data.paymentMethod,
      data.phone,
      data.address,
      data.comment
    );
    
    // Формируем сообщение о заказе
    let orderMessage = `✅ Заказ №${order.order_number} принят!\n\n`;
    orderMessage += '🛍 Ваш заказ:\n';
    
    data.cart.forEach(item => {
      orderMessage += `  • ${item.name} x${item.quantity} - ${item.price * item.quantity} ₽\n`;
    });
    
    orderMessage += `\n💰 Итого: ${data.total} ₽\n`;
    orderMessage += `💳 Оплата: ${data.paymentMethod}\n`;
    
    if (data.address) {
      orderMessage += `📍 Адрес: ${data.address}\n`;
    }
    
    if (data.phone) {
      orderMessage += `📞 Телефон: ${data.phone}\n`;
    }
    
    // Если выбрана онлайн оплата - отправляем инвойс
    if (data.paymentMethod === 'Онлайн оплата' && process.env.PAYMENT_TOKEN) {
      const prices = data.cart.map(item => ({
        label: `${item.name} x${item.quantity}`,
        amount: Math.round(item.price * item.quantity * 100) // в копейках
      }));
      
      await bot.sendInvoice(
        chatId,
        `Заказ №${order.order_number}`,
        'Оплата заказа',
        order.order_number,
        process.env.PAYMENT_TOKEN,
        'RUB',
        prices,
        {
          need_phone_number: false,
          need_shipping_address: false,
          is_flexible: false
        }
      );
    } else {
      bot.sendMessage(chatId, orderMessage);
    }
    
    // Уведомление администратора
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',') || [];
    adminIds.forEach(adminId => {
      bot.sendMessage(adminId, 
        `🔔 НОВЫЙ ЗАКАЗ №${order.order_number}\n\n` +
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
// ПЛАТЕЖИ - Обработка
// ==============================================

bot.on('pre_checkout_query', async (query) => {
  await bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', async (msg) => {
  const chatId = msg.chat.id;
  const payment = msg.successful_payment;
  
  // Обновляем статус заказа
  await pool.query(
    'UPDATE orders SET payment_status = $1, status = $2 WHERE order_number = $3',
    ['paid', 'confirmed', payment.invoice_payload]
  );
  
  bot.sendMessage(chatId, 
    '✅ Оплата прошла успешно!\n' +
    'Ваш заказ принят в обработку.\n\n' +
    'Ожидайте звонка курьера.'
  );
});

// ==============================================
// API для Mini App
// ==============================================

// Получить все категории
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить все товары
app.get('/api/products', async (req, res) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить товары по категории
app.get('/api/categories/:id/products', async (req, res) => {
  try {
    const products = await getProductsByCategory(req.params.id);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить способы оплаты
app.get('/api/payment-methods', async (req, res) => {
  try {
    const methods = await getPaymentMethods();
    res.json(methods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить настройки магазина
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

// ==============================================
// Вспомогательные функции
// ==============================================

function getStatusEmoji(status) {
  const statuses = {
    'pending': '⏳',
    'confirmed': '✅',
    'preparing': '👨‍🍳',
    'delivering': '🚚',
    'completed': '✅',
    'cancelled': '❌'
  };
  return statuses[status] || '❓';
}

// ==============================================
// Запуск сервера
// ==============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`✅ Бот запущен`);
});

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});
