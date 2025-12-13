-- Создание базы данных
CREATE DATABASE shopbot;

-- Подключаемся к базе

-- Таблица категорий
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image VARCHAR(500),
  order_index INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица товаров
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  old_price DECIMAL(10, 2),
  image VARCHAR(500),
  images JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT true,
  in_stock BOOLEAN DEFAULT true,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица пользователей
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица заказов
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  items JSONB NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  delivery_address TEXT,
  phone VARCHAR(50),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица способов оплаты
CREATE TABLE payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  icon VARCHAR(500),
  active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  order_index INT DEFAULT 0
);

-- Таблица настроек
CREATE TABLE settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Вставка базовых данных
INSERT INTO categories (name, description, order_index) VALUES
('Бургеры', 'Сочные бургеры', 1),
('Напитки', 'Холодные и горячие напитки', 2),
('Десерты', 'Сладкие десерты', 3);

INSERT INTO payment_methods (name, type, description, active, order_index) VALUES
('Наличными курьеру', 'cash', 'Оплата наличными при получении', true, 1),
('Картой курьеру', 'card_courier', 'Оплата картой при получении', true, 2),
('Онлайн оплата', 'online', 'Оплата онлайн через Telegram', true, 3);

INSERT INTO settings (key, value) VALUES
('shop_name', 'Мой магазин'),
('min_order_amount', '500'),
('delivery_cost', '200'),
('free_delivery_from', '1500'),
('working_hours', '10:00 - 22:00');
