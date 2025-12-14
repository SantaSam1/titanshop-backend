# 📋 Шпаргалка команд

## 🚀 Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск бота в режиме разработки
npm run dev

# Запуск бота в продакшене
npm start

# Инициализация базы данных
node init-db.js
```

---

## 🗄️ База данных

```bash
# Подключение к PostgreSQL
psql "postgresql://user:password@host:5432/database"

# Просмотр таблиц
\dt

# Просмотр данных таблицы
SELECT * FROM products;
SELECT * FROM categories;
SELECT * FROM orders;

# Очистка таблицы
TRUNCATE TABLE products CASCADE;

# Добавление тестовых данных
psql "postgresql://..." < seed-data.sql
```

---

## 🚂 Railway CLI

```bash
# Установка Railway CLI
npm install -g @railway/cli

# Вход в аккаунт
railway login

# Инициализация проекта
railway init

# Просмотр логов
railway logs

# Просмотр переменных
railway variables

# Установка переменной
railway variables set KEY=value

# Развертывание
railway up

# Подключение к базе данных
railway connect

# Открыть в браузере
railway open
```

---

## 🔧 Git команды

```bash
# Инициализация репозитория
git init

# Добавить все файлы
git add .

# Коммит изменений
git commit -m "Initial commit"

# Добавить удаленный репозиторий
git remote add origin https://github.com/username/repo.git

# Отправить на GitHub
git push -u origin main

# Проверить статус
git status

# Посмотреть изменения
git diff
```

---

## 📱 BotFather команды

```
/newbot                  - Создать нового бота
/setname                 - Изменить имя бота
/setdescription         - Установить описание
/setabouttext           - Установить текст "О боте"
/setuserpic             - Установить аватар бота
/setcommands            - Установить команды
/setmenubutton          - Настроить кнопку меню
/newapp                 - Создать Web App
/mybots                 - Список ваших ботов
```

---

## 🛠️ Полезные команды для отладки

```bash
# Проверка порта
lsof -i :3000

# Убить процесс на порту
kill -9 $(lsof -t -i:3000)

# Проверка подключения к БД
node -e "const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT NOW()', (err, res) => {console.log(err || res.rows); process.exit();})"

# Просмотр логов (Linux/Mac)
tail -f logs/bot.log

# Очистка node_modules
rm -rf node_modules package-lock.json
npm install

# Проверка версий
node -v
npm -v
git --version
```

---

## 🔍 SQL запросы для администрирования

```sql
-- Количество товаров по категориям
SELECT c.name, COUNT(p.id) 
FROM categories c 
LEFT JOIN products p ON c.id = p.category_id 
GROUP BY c.name;

-- Последние 10 заказов
SELECT * FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

-- Сумма заказов за сегодня
SELECT SUM(total) FROM orders 
WHERE DATE(created_at) = CURRENT_DATE;

-- Топ-5 популярных товаров
SELECT 
  p.name, 
  COUNT(*) as order_count 
FROM orders o, 
  jsonb_array_elements(o.items) as item
JOIN products p ON (item->>'id')::int = p.id
GROUP BY p.name 
ORDER BY order_count DESC 
LIMIT 5;

-- Активные пользователи
SELECT COUNT(DISTINCT user_id) 
FROM orders;

-- Добавить администратора
UPDATE users 
SET is_admin = true 
WHERE telegram_id = 123456789;

-- Деактивировать товар
UPDATE products 
SET active = false 
WHERE id = 1;

-- Изменить цену товара
UPDATE products 
SET price = 1500.00 
WHERE id = 1;
```

---

## 📊 Мониторинг

```bash
# Проверка работы сервера
curl http://localhost:3000/api/categories

# Проверка API с токеном
curl -H "X-Telegram-Id: 123456789" http://localhost:3000/api/admin/products

# Тест загрузки файла
curl -X POST -F "image=@photo.jpg" -H "X-Telegram-Id: 123456789" http://localhost:3000/api/admin/upload
```

---

## 🆘 Частые проблемы и решения

### "EADDRINUSE: address already in use"
```bash
# Найти и убить процесс
kill -9 $(lsof -t -i:3000)
```

### "relation does not exist"
```bash
# Пересоздать базу данных
node init-db.js
```

### "Cannot find module"
```bash
# Переустановить зависимости
rm -rf node_modules package-lock.json
npm install
```

### "Permission denied"
```bash
# Дать права на выполнение
chmod +x setup.sh
./setup.sh
```

---

## 💡 Полезные ссылки

- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Railway Docs**: https://docs.railway.app/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Node.js Docs**: https://nodejs.org/docs/
- **Express.js Docs**: https://expressjs.com/

---

## 🎯 Быстрые действия

### Добавить категорию через SQL
```sql
INSERT INTO categories (name, description, order_index, active) 
VALUES ('Новая категория', 'Описание', 10, true);
```

### Добавить товар через SQL
```sql
INSERT INTO products (category_id, name, description, price, active, in_stock, order_index) 
VALUES (1, 'Новый товар', 'Описание товара', 999.00, true, true, 1);
```

### Изменить настройки через SQL
```sql
UPDATE settings 
SET value = 'Новое значение' 
WHERE key = 'shop_name';
```

### Сбросить все данные
```sql
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE categories CASCADE;
```

---

**Сохраните эту шпаргалку для быстрого доступа! 📌**