require('dotenv').config();
const { Client } = require('pg');

// Получаем URL из переменной окружения
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL не найден!');
    console.log('\nСоздайте файл .env с содержимым:');
    console.log('DATABASE_URL=postgresql://postgres:PASSWORD@host:5432/railway?sslmode=disable');
    console.log('\nИли установите переменную окружения:');
    console.log('export DATABASE_URL="postgresql://..."');
    process.exit(1);
}

// Добавляем sslmode=disable если его нет
if (!connectionString.includes('sslmode')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=disable';
}

console.log('🔗 Подключение к базе данных...');
console.log('📍 URL:', connectionString.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@'));

const client = new Client({
    connectionString: connectionString,
});

const schema = `
-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица товаров
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    category VARCHAR(100),
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица заказов
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    username VARCHAR(255),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица товаров в заказе
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

-- Таблица категорий
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица настроек
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
`;

async function initDatabase() {
    try {
        console.log('⏳ Подключаемся...');
        await client.connect();
        console.log('✅ Подключено к базе данных!\n');
        
        console.log('📋 Создаем таблицы...');
        await client.query(schema);
        console.log('✅ Схема применена успешно!\n');
        
        // Проверяем созданные таблицы
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('📊 Созданные таблицы:');
        tables.rows.forEach(row => {
            console.log('  ✓', row.table_name);
        });
        
        // Проверяем количество записей в каждой таблице
        console.log('\n📈 Количество записей:');
        for (const row of tables.rows) {
            const count = await client.query(`SELECT COUNT(*) FROM ${row.table_name}`);
            console.log(`  ${row.table_name}: ${count.rows[0].count}`);
        }
        
        await client.end();
        console.log('\n✅ База данных успешно инициализирована!');
        console.log('🎉 Готово к использованию!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Ошибка:', error.message);
        
        if (error.message.includes('SSL')) {
            console.error('\n💡 Совет: Добавьте ?sslmode=disable к DATABASE_URL');
            console.error('Пример: postgresql://user:pass@host:5432/db?sslmode=disable');
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Совет: Проверьте что PostgreSQL запущен и доступен');
        }
        
        process.exit(1);
    }
}

initDatabase();
