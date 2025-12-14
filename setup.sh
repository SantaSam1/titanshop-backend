#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🛍 Telegram Shop Bot - Быстрая настройка"
echo "========================================"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    echo "Установите Node.js с https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js установлен: $(node -v)${NC}"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm установлен: $(npm -v)${NC}"
echo ""

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Зависимости установлены${NC}"
else
    echo -e "${RED}❌ Ошибка установки зависимостей${NC}"
    exit 1
fi

echo ""

# Создание .env файла
if [ ! -f .env ]; then
    echo "⚙️ Создание .env файла..."
    
    echo ""
    echo "Пожалуйста, введите необходимые данные:"
    echo ""
    
    # BOT_TOKEN
    echo -n "Токен бота (от @BotFather): "
    read BOT_TOKEN
    
    # DATABASE_URL
    echo -n "DATABASE_URL (от Railway PostgreSQL): "
    read DATABASE_URL
    
    # ADMIN_TELEGRAM_IDS
    echo -n "Ваш Telegram ID (от @userinfobot): "
    read ADMIN_ID
    
    # Создаем .env
    cat > .env << EOF
BOT_TOKEN=$BOT_TOKEN
DATABASE_URL=$DATABASE_URL
ADMIN_TELEGRAM_IDS=$ADMIN_ID
WEB_APP_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
EOF
    
    echo -e "${GREEN}✅ Файл .env создан${NC}"
else
    echo -e "${YELLOW}⚠️  Файл .env уже существует${NC}"
fi

echo ""

# Инициализация базы данных
echo "🗄 Инициализация базы данных..."
node init-db.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ База данных инициализирована${NC}"
else
    echo -e "${RED}❌ Ошибка инициализации БД${NC}"
    exit 1
fi

echo ""

# Создание папки uploads
if [ ! -d "uploads" ]; then
    mkdir uploads
    echo -e "${GREEN}✅ Папка uploads создана${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}🎉 Настройка завершена!${NC}"
echo ""
echo "Следующие шаги:"
echo "1. Запустите бота: npm start"
echo "2. Откройте админ-панель: http://localhost:3000/admin.html"
echo "3. Добавьте категории и товары"
echo ""
echo "Для развертывания на Railway:"
echo "1. Загрузите код на GitHub"
echo "2. Подключите репозиторий к Railway"
echo "3. Обновите WEB_APP_URL в настройках Railway"
echo ""
echo "Подробная инструкция: см. README.md"
echo "========================================"