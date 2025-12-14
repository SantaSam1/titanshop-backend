-- Удаляем старые таблицы если нужно
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Таблица пользователей
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    is_admin BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица категорий
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица товаров
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    old_price DECIMAL(10, 2),
    image_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    in_stock BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица способов оплаты
CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица заказов
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(255),
    payment_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'pending',
    phone VARCHAR(50),
    delivery_address TEXT,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица настроек
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_categories_active ON categories(active);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Начальные настройки
INSERT INTO settings (key, value, description) VALUES
    ('shop_name', 'Мой магазин', 'Название магазина'),
    ('working_hours', '10:00 - 22:00', 'Часы работы'),
    ('min_order_amount', '0', 'Минимальная сумма заказа'),
    ('delivery_cost', '200', 'Стоимость доставки'),
    ('free_delivery_from', '1000', 'Бесплатная доставка от'),
    ('welcome_message', 'Добро пожаловать в наш магазин!', 'Приветственное сообщение'),
    ('contact_phone', '+7 (XXX) XXX-XX-XX', 'Контактный телефон'),
    ('contact_email', 'support@shop.com', 'Email для связи')
ON CONFLICT (key) DO NOTHING;

-- Начальные способы оплаты
INSERT INTO payment_methods (name, description, order_index) VALUES
    ('Наличными курьеру', 'Оплата наличными при получении', 1),
    ('Картой курьеру', 'Оплата картой при получении', 2),
    ('Онлайн оплата', 'Оплата картой онлайн', 3)
ON CONFLICT DO NOTHING;