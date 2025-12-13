require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('admin-public'));
app.use('/uploads', express.static('uploads'));

// Создаем папку для загрузки файлов
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images only!');
    }
  }
});

// ==============================================
// КАТЕГОРИИ
// ==============================================

// Получить все категории
app.get('/api/admin/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY order_index');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать категорию
app.post('/api/admin/categories', upload.single('image'), async (req, res) => {
  try {
    const { name, description, order_index, active } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    const result = await pool.query(
      'INSERT INTO categories (name, description, image, order_index, active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, image, order_index || 0, active !== 'false']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить категорию
app.put('/api/admin/categories/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, order_index, active } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image;
    
    const result = await pool.query(
      'UPDATE categories SET name = $1, description = $2, image = $3, order_index = $4, active = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
      [name, description, image, order_index || 0, active !== 'false', id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удалить категорию
app.delete('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// ТОВАРЫ
// ==============================================

// Получить все товары
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

// Создать товар
app.post('/api/admin/products', upload.single('image'), async (req, res) => {
  try {
    const { category_id, name, description, price, old_price, in_stock, active, order_index } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    const result = await pool.query(
      'INSERT INTO products (category_id, name, description, price, old_price, image, in_stock, active, order_index) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [category_id, name, description, price, old_price || null, image, in_stock !== 'false', active !== 'false', order_index || 0]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить товар
app.put('/api/admin/products/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, description, price, old_price, in_stock, active, order_index } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image;
    
    const result = await pool.query(
      'UPDATE products SET category_id = $1, name = $2, description = $3, price = $4, old_price = $5, image = $6, in_stock = $7, active = $8, order_index = $9, updated_at = NOW() WHERE id = $10 RETURNING *',
      [category_id, name, description, price, old_price || null, image, in_stock !== 'false', active !== 'false', order_index || 0, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удалить товар
app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// ЗАКАЗЫ
// ==============================================

// Получить все заказы
app.get('/api/admin/orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT o.*, u.first_name, u.last_name, u.username FROM orders o LEFT JOIN users u ON o.user_id = u.telegram_id ORDER BY o.created_at DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить статус заказа
app.put('/api/admin/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// СПОСОБЫ ОПЛАТЫ
// ==============================================

// Получить все способы оплаты
app.get('/api/admin/payment-methods', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payment_methods ORDER BY order_index');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать способ оплаты
app.post('/api/admin/payment-methods', async (req, res) => {
  try {
    const { name, type, description, active, order_index } = req.body;
    
    const result = await pool.query(
      'INSERT INTO payment_methods (name, type, description, active, order_index) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, type, description, active !== false, order_index || 0]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить способ оплаты
app.put('/api/admin/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, active, order_index } = req.body;
    
    const result = await pool.query(
      'UPDATE payment_methods SET name = $1, type = $2, description = $3, active = $4, order_index = $5 WHERE id = $6 RETURNING *',
      [name, type, description, active !== false, order_index || 0, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удалить способ оплаты
app.delete('/api/admin/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
    res.json({ message: 'Payment method deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// НАСТРОЙКИ
// ==============================================

// Получить настройки
app.get('/api/admin/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => settings[row.key] = row.value);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить настройки
app.put('/api/admin/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [key, value]
      );
    }
    
    res.json({ message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// СТАТИСТИКА
// ==============================================

app.get('/api/admin/statistics', async (req, res) => {
  try {
    const stats = {};
    
    // Общее количество заказов
    const ordersCount = await pool.query('SELECT COUNT(*) as count FROM orders');
    stats.totalOrders = parseInt(ordersCount.rows[0].count);
    
    // Общая сумма заказов
    const ordersSum = await pool.query('SELECT SUM(total) as sum FROM orders WHERE payment_status = \'paid\'');
    stats.totalRevenue = parseFloat(ordersSum.rows[0].sum) || 0;
    
    // Количество товаров
    const productsCount = await pool.query('SELECT COUNT(*) as count FROM products WHERE active = true');
    stats.totalProducts = parseInt(productsCount.rows[0].count);
    
    // Количество пользователей
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    stats.totalUsers = parseInt(usersCount.rows[0].count);
    
    // Заказы за сегодня
    const todayOrders = await pool.query('SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURRENT_DATE');
    stats.todayOrders = parseInt(todayOrders.rows[0].count);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// Запуск сервера
// ==============================================

const PORT = process.env.ADMIN_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Админ-панель запущена на порту ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});
