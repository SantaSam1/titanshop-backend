# bot_improved.py - УЛУЧШЕННАЯ ВЕРСИЯ с гарантированным отображением картинок
import os
import json
import asyncio
import logging
import re
from typing import Dict, Any, List
from datetime import datetime

import pandas as pd
import requests

from aiogram import Bot, Dispatcher, F, types
from aiogram.client.default import DefaultBotProperties
from aiogram.types import Message, CallbackQuery, LabeledPrice, PreCheckoutQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder

# ----------------------------
# LOGGING
# ----------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ----------------------------
# CONFIG
# ----------------------------
TELEGRAM_TOKEN = "8583050907:AAEZK40DxOJP_e944TwxrT5tIeCLul4jyu4"

PROVIDER_TOKEN = os.environ.get("PROVIDER_TOKEN", "PUT_YOUR_PAYMENT_PROVIDER_TOKEN_HERE")
CURRENCY = "EUR"

WC_BASE_URL = os.environ.get("WC_BASE_URL", "")
WC_CONSUMER_KEY = os.environ.get("WC_CONSUMER_KEY", "")
WC_CONSUMER_SECRET = os.environ.get("WC_CONSUMER_SECRET", "")
USE_WC = bool(WC_BASE_URL and WC_CONSUMER_KEY and WC_CONSUMER_SECRET)

CSV_PATH = os.environ.get("CSV_PATH", "products_full.csv")

SYNC_INTERVAL_SEC = int(os.environ.get("SYNC_INTERVAL_SEC", 600))
DELIVERY_COST_EUR = float(os.environ.get("DELIVERY_COST_EUR", 20.0))

CRYPTO_WALLETS = {
    "BTC": os.environ.get("CRYPTO_BTC", "your_btc_address"),
    "ETH": os.environ.get("CRYPTO_ETH", "your_eth_address"),
    "USDT": os.environ.get("CRYPTO_USDT", "your_usdt_address"),
}

# ----------------------------
# GLOBAL STATE
# ----------------------------
bot = Bot(
    token=TELEGRAM_TOKEN,
    default=DefaultBotProperties(parse_mode="Markdown")
)

dp = Dispatcher()

PRODUCTS: Dict[str, Dict[str, Any]] = {}
user_carts: Dict[int, Dict[str, Any]] = {}
user_last_messages: Dict[int, int] = {}
user_search_state: Dict[int, bool] = {}
user_current_category: Dict[int, str] = {}  # Запоминаем текущую категорию пользователя

# ----------------------------
# IMAGE UTILITIES
# ----------------------------
def validate_image_url(url: str) -> bool:
    """Проверяет валидность URL изображения"""
    if not url or not isinstance(url, str):
        return False
    
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url.strip())
        if not parsed.scheme or not parsed.netloc:
            return False
        
        # Проверяем расширение файла
        valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        path_lower = parsed.path.lower()
        
        return any(path_lower.endswith(ext) for ext in valid_extensions)
    except Exception:
        return False

def check_image_accessibility(url: str, timeout: int = 3) -> bool:
    """БЫСТРАЯ проверка доступности изображения"""
    if not validate_image_url(url):
        return False
    
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        return response.status_code == 200
    except Exception:
        return False

# ----------------------------
# CART HELPERS
# ----------------------------
def get_user_cart(user_id: int):
    if user_id not in user_carts:
        user_carts[user_id] = {"items": {}, "address": None}
    return user_carts[user_id]

def add_to_cart(user_id: int, product_id: str, qty: int = 1):
    cart = get_user_cart(user_id)
    cart["items"][product_id] = cart["items"].get(product_id, 0) + qty

def remove_from_cart(user_id: int, product_id: str):
    cart = get_user_cart(user_id)
    cart["items"].pop(product_id, None)

def calculate_cart_total(user_id: int) -> float:
    cart = get_user_cart(user_id)
    total = sum(float(PRODUCTS[p]["price"]) * q for p, q in cart["items"].items() if p in PRODUCTS)
    if total > 0:
        total += DELIVERY_COST_EUR
    return total

def cart_text(user_id: int) -> str:
    cart = get_user_cart(user_id)
    if not cart["items"]:
        return "🛒 Корзина пуста."
    text = "🛒 *Корзина:*\n\n"
    subtotal = 0
    for pid, qty in cart["items"].items():
        if pid in PRODUCTS:
            p = PRODUCTS[pid]
            price = float(p["price"])
            item_total = price * qty
            subtotal += item_total
            text += f"• *{p['name']}*\n  {qty} × €{price:.2f} = €{item_total:.2f}\n\n"
    text += f"📦 Доставка: €{DELIVERY_COST_EUR:.2f}\n"
    text += f"💰 *ИТОГО:* €{subtotal + DELIVERY_COST_EUR:.2f}"
    return text

def product_card_text(p: Dict[str, Any]) -> str:
    """Создает текст карточки товара"""
    desc = p.get("description", "Нет описания")
    if len(desc) > 500:
        desc = desc[:500] + "..."
    
    stock = "✅ В наличии" if p["in_stock"] else "❌ Нет в наличии"
    category = p.get("category", "").replace("препараты", "").strip()
    
    text = f"*{p['name']}*\n\n"
    text += f"📂 {category}\n"
    text += f"{desc}\n\n"
    text += f"💰 Цена: €{p['price']}\n"
    text += f"{stock}"
    
    return text

# ----------------------------
# CSV LOADING - УЛУЧШЕННАЯ ВЕРСИЯ
# ----------------------------
def clean_html(raw_html: str) -> str:
    """Очистка HTML тегов из текста"""
    if not raw_html or raw_html == "nan" or pd.isna(raw_html):
        return ""
    clean = re.sub(r'<.*?>', '', str(raw_html))
    clean = clean.replace("\\r\\n", "\n").replace("\\n", "\n")
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()

def extract_first_image(images_str: str) -> str:
    """Извлекает первое изображение из строки с изображениями"""
    if pd.isna(images_str) or not str(images_str).strip():
        return ""
    
    images_str = str(images_str).strip()
    
    # Разделяем по запятой и берем первое изображение
    images_list = [img.strip() for img in images_str.split(",") if img.strip()]
    
    if images_list:
        first_image = images_list[0]
        # Проверяем, что это валидный URL
        if validate_image_url(first_image):
            return first_image
    
    return ""

def categorize_product(name: str, category: str, description: str) -> str:
    """Улучшенная категоризация товаров"""
    text = f"{name} {category} {description}".lower()
    
    # Инъекционные препараты
    injectable_keywords = [
        'инъекц', 'inject', 'ампул', 'флакон', 'мл', 'ml',
        'тестостерон', 'testosterone', 'энантат', 'enanthate',
        'пропионат', 'propionate', 'ципионат', 'cypionate',
        'тренболон', 'trenbolone', 'болденон', 'boldenone',
        'нандролон', 'nandrolone', 'мастерон', 'masteron',
        'примоболан', 'primobolan'
    ]
    
    # Оральные препараты
    oral_keywords = [
        'ораль', 'oral', 'таблетк', 'tablet', 'капсул', 'capsule',
        'кломид', 'clomid', 'кломифен', 'clomiphene',
        'тамоксифен', 'tamoxifen', 'анастрозол', 'anastrozole',
        'кленбутерол', 'clenbuterol', 'тадалафил', 'tadalafil',
        'силденафил', 'sildenafil', 'варденафил', 'vardenafil'
    ]
    
    if any(keyword in text for keyword in injectable_keywords):
        return "Инъекционные препараты"
    elif any(keyword in text for keyword in oral_keywords):
        return "Оральные препараты"
    elif "инъекц" in category.lower() or "inject" in category.lower():
        return "Инъекционные препараты"
    elif "ораль" in category.lower() or "oral" in category.lower():
        return "Оральные препараты"
    else:
        return category if category else "Другие товары"

def load_products_from_csv(path: str) -> Dict[str, Dict[str, Any]]:
    """Загрузка товаров из CSV с улучшенной обработкой"""
    logger.info("📂 Загрузка CSV...")
    try:
        df = pd.read_csv(path)
    except Exception as e:
        logger.error(f"❌ Ошибка чтения CSV: {e}")
        return {}

    products = {}
    images_loaded = 0
    
    for idx, row in df.iterrows():
        try:
            pid = str(int(row.get("ID", idx)))
            
            # Получаем описание
            raw_desc = row.get("Краткое описание")
            if pd.isna(raw_desc) or not str(raw_desc).strip():
                raw_desc = row.get("Описание", "")
            
            # Обработка изображений
            images_raw = row.get("Изображения", "")
            first_image = extract_first_image(images_raw)
            
            if first_image:
                images_loaded += 1
                logger.debug(f"✅ Товар {pid}: изображение найдено")
            
            # Получаем цену
            price = row.get("Базовая цена")
            if pd.isna(price):
                price = row.get("Regular price", 0)
            price = float(price) if price else 0.0
            
            # Получаем статус наличия
            stock_status = row.get("Наличие", 1)
            in_stock = bool(int(stock_status)) if not pd.isna(stock_status) else True
            
            # Название товара
            name = str(row.get("Имя") or f"Товар {pid}")
            
            # Категория
            original_category = str(row.get("Категории", ""))
            
            # Улучшенная категоризация
            category = categorize_product(name, original_category, clean_html(raw_desc))

            products[pid] = {
                "id": pid,
                "name": name,
                "description": clean_html(raw_desc),
                "price": price,
                "category": category,
                "original_category": original_category,
                "image": first_image,
                "in_stock": in_stock,
                "sku": str(row.get("Артикул", ""))
            }
        except Exception as e:
            logger.error(f"❌ Ошибка обработки строки {idx}: {e}")
            continue
    
    logger.info(f"✅ Загружено товаров: {len(products)}")
    logger.info(f"📷 Товаров с изображениями: {images_loaded}/{len(products)}")
    
    # Статистика по категориям
    categories = {}
    for p in products.values():
        cat = p["category"]
        categories[cat] = categories.get(cat, 0) + 1
    
    logger.info("📊 Товары по категориям:")
    for cat, count in categories.items():
        logger.info(f"  - {cat}: {count}")
    
    return products

async def load_products():
    global PRODUCTS
    if os.path.exists(CSV_PATH):
        PRODUCTS = load_products_from_csv(CSV_PATH)
    else:
        logger.error(f"❌ Файл {CSV_PATH} не найден!")
        PRODUCTS = {}

async def autosync_loop():
    while True:
        await asyncio.sleep(SYNC_INTERVAL_SEC)
        await load_products()

# ----------------------------
# MESSAGE MANAGEMENT
# ----------------------------
async def delete_last_message(user_id: int):
    """Удаляет последнее сообщение пользователя если оно есть"""
    if user_id in user_last_messages:
        try:
            await bot.delete_message(user_id, user_last_messages[user_id])
        except Exception as e:
            logger.debug(f"Не удалось удалить сообщение: {e}")
        finally:
            del user_last_messages[user_id]

def save_message_id(user_id: int, message_id: int):
    """Сохраняет ID сообщения для последующего удаления"""
    user_last_messages[user_id] = message_id

# ----------------------------
# KEYBOARDS
# ----------------------------
def main_menu_kb():
    kb = InlineKeyboardBuilder()
    kb.button(text="💉 Инъекционные", callback_data="cat_inject")
    kb.button(text="💊 Оральные", callback_data="cat_oral")
    kb.button(text="🔎 Поиск", callback_data="search_start")
    kb.button(text="🛒 Корзина", callback_data="show_cart")
    kb.adjust(2)
    return kb.as_markup()

def products_list_kb(lst, page=0, per_page=8, category=""):
    """Клавиатура списка товаров с пагинацией"""
    kb = InlineKeyboardBuilder()
    
    # Пагинация
    start = page * per_page
    end = start + per_page
    page_products = lst[start:end]
    
    for p in page_products:
        name = p["name"][:40]
        price_emoji = "💰" if p["price"] > 0 else "🆓"
        stock_emoji = "✅" if p["in_stock"] else "❌"
        button_text = f"{stock_emoji} {name} {price_emoji}€{p['price']}"
        kb.button(text=button_text, callback_data=f"prod_{p['id']}")
    
    # Кнопки навигации
    nav_buttons = []
    if page > 0:
        nav_buttons.append(("⬅️ Назад", f"page_{page-1}_{category}"))
    if end < len(lst):
        nav_buttons.append(("➡️ Далее", f"page_{page+1}_{category}"))
    
    for text, callback in nav_buttons:
        kb.button(text=text, callback_data=callback)
    
    kb.button(text="🏠 Главное меню", callback_data="back_to_menu")
    kb.adjust(1)
    return kb.as_markup()

def product_card_kb(pid):
    kb = InlineKeyboardBuilder()
    kb.button(text="🛒 Добавить в корзину", callback_data=f"buy_{pid}")
    kb.button(text="⬅ К товарам", callback_data="back_to_category")
    kb.adjust(1)
    return kb.as_markup()

def search_kb():
    """Клавиатура для поиска"""
    kb = InlineKeyboardBuilder()
    kb.button(text="❌ Отменить поиск", callback_data="cancel_search")
    return kb.as_markup()

# ----------------------------
# SEARCH - УЛУЧШЕННАЯ ВЕРСИЯ
# ----------------------------
def search_products(q: str):
    """Улучшенный поиск товаров"""
    q = q.lower().strip()
    if len(q) < 2:
        return []
    
    results = []
    search_words = q.split()
    
    for p in PRODUCTS.values():
        # Поиск в названии, описании, категории и артикуле
        searchable_text = f"{p['name']} {p['description']} {p['category']} {p.get('sku', '')}".lower()
        
        score = 0
        
        # Точное совпадение в названии (максимальный приоритет)
        if q in p['name'].lower():
            score += 100
        
        # Совпадение всех слов запроса
        if all(word in searchable_text for word in search_words):
            score += 50
        
        # Частичное совпадение
        word_matches = sum(1 for word in search_words if word in searchable_text)
        score += word_matches * 10
        
        # Совпадение в категории
        if q in p['category'].lower():
            score += 25
        
        if score > 0:
            p['_search_score'] = score
            results.append(p)
    
    # Сортируем по релевантности, затем по наличию, затем по цене
    results.sort(key=lambda x: (-x.get('_search_score', 0), -x['in_stock'], x['price']))
    return results[:15]  # Ограничиваем 15 результатами

# ----------------------------
# HANDLERS
# ----------------------------
@dp.message(F.text == "/start")
async def cmd_start(m: Message):
    await delete_last_message(m.from_user.id)
    user_search_state[m.from_user.id] = False
    user_current_category[m.from_user.id] = ""
    
    welcome_text = (
        "🏋️ *Добро пожаловать в TitanShop!*\n\n"
        f"📦 В наличии {len(PRODUCTS)} товаров\n"
        "🚀 Выберите категорию или воспользуйтесь поиском"
    )
    
    msg = await m.answer(welcome_text, reply_markup=main_menu_kb())
    save_message_id(m.from_user.id, msg.message_id)

@dp.callback_query(F.data == "back_to_menu")
async def cb_menu(c: CallbackQuery):
    await c.answer()
    user_search_state[c.from_user.id] = False
    user_current_category[c.from_user.id] = ""
    
    welcome_text = (
        "🏋️ *Главное меню*\n\n"
        f"📦 В наличии {len(PRODUCTS)} товаров\n"
        "🚀 Выберите категорию или воспользуйтесь поиском"
    )
    
    try:
        await c.message.edit_text(welcome_text, reply_markup=main_menu_kb())
    except:
        await delete_last_message(c.from_user.id)
        msg = await c.message.answer(welcome_text, reply_markup=main_menu_kb())
        save_message_id(c.from_user.id, msg.message_id)

@dp.callback_query(F.data == "back_to_category")
async def cb_back_to_category(c: CallbackQuery):
    await c.answer()
    user_id = c.from_user.id
    current_cat = user_current_category.get(user_id, "")
    
    if current_cat == "inject":
        await cb_inject(c)
    elif current_cat == "oral":
        await cb_oral(c)
    elif current_cat == "search":
        # Возвращаемся к поиску
        await cb_search_start(c)
    else:
        await cb_menu(c)

@dp.callback_query(F.data == "cat_oral")
async def cb_oral(c: CallbackQuery):
    await c.answer()
    user_search_state[c.from_user.id] = False
    user_current_category[c.from_user.id] = "oral"
    
    lst = [p for p in PRODUCTS.values() if "ораль" in p["category"].lower() or "oral" in p["category"].lower()]
    
    if not lst:
        try:
            await c.message.edit_text("❌ Оральные препараты временно недоступны.", reply_markup=main_menu_kb())
        except:
            await delete_last_message(c.from_user.id)
            msg = await c.message.answer("❌ Оральные препараты временно недоступны.", reply_markup=main_menu_kb())
            save_message_id(c.from_user.id, msg.message_id)
        return
    
    # Сортируем по наличию, затем по цене
    lst.sort(key=lambda x: (-x['in_stock'], x['price']))
    
    text = f"💊 *Оральные препараты* ({len(lst)} товаров)\n\nВыберите товар:"
    
    try:
        await c.message.edit_text(text, reply_markup=products_list_kb(lst, category="oral"))
    except:
        await delete_last_message(c.from_user.id)
        msg = await c.message.answer(text, reply_markup=products_list_kb(lst, category="oral"))
        save_message_id(c.from_user.id, msg.message_id)

@dp.callback_query(F.data == "cat_inject")
async def cb_inject(c: CallbackQuery):
    await c.answer()
    user_search_state[c.from_user.id] = False
    user_current_category[c.from_user.id] = "inject"
    
    lst = [p for p in PRODUCTS.values() if "инъекц" in p["category"].lower() or "inject" in p["category"].lower()]
    
    if not lst:
        try:
            await c.message.edit_text("❌ Инъекционные препараты временно недоступны.", reply_markup=main_menu_kb())
        except:
            await delete_last_message(c.from_user.id)
            msg = await c.message.answer("❌ Инъекционные препараты временно недоступны.", reply_markup=main_menu_kb())
            save_message_id(c.from_user.id, msg.message_id)
        return
    
    # Сортируем по наличию, затем по цене
    lst.sort(key=lambda x: (-x['in_stock'], x['price']))
    
    text = f"💉 *Инъекционные препараты* ({len(lst)} товаров)\n\nВыберите товар:"
    
    try:
        await c.message.edit_text(text, reply_markup=products_list_kb(lst, category="inject"))
    except:
        await delete_last_message(c.from_user.id)
        msg = await c.message.answer(text, reply_markup=products_list_kb(lst, category="inject"))
        save_message_id(c.from_user.id, msg.message_id)

# ----------------------------
# PAGINATION
# ----------------------------
@dp.callback_query(F.data.startswith("page_"))
async def cb_page(c: CallbackQuery):
    await c.answer()
    parts = c.data.split("_")
    page = int(parts[1])
    category = parts[2] if len(parts) > 2 else ""
    
    user_id = c.from_user.id
    
    if category == "oral":
        lst = [p for p in PRODUCTS.values() if "ораль" in p["category"].lower() or "oral" in p["category"].lower()]
        lst.sort(key=lambda x: (-x['in_stock'], x['price']))
        text = f"💊 *Оральные препараты* ({len(lst)} товаров)\n\nВыберите товар:"
    elif category == "inject":
        lst = [p for p in PRODUCTS.values() if "инъекц" in p["category"].lower() or "inject" in p["category"].lower()]
        lst.sort(key=lambda x: (-x['in_stock'], x['price']))
        text = f"💉 *Инъекционные препараты* ({len(lst)} товаров)\n\nВыберите товар:"
    else:
        # Поиск или другая категория
        await cb_menu(c)
        return
    
    try:
        await c.message.edit_text(text, reply_markup=products_list_kb(lst, page=page, category=category))
    except:
        await delete_last_message(user_id)
        msg = await c.message.answer(text, reply_markup=products_list_kb(lst, page=page, category=category))
        save_message_id(user_id, msg.message_id)

# ----------------------------
# ПОИСК
# ----------------------------
@dp.callback_query(F.data == "search_start")
async def cb_search_start(c: CallbackQuery):
    """Начало поиска"""
    await c.answer()
    user_search_state[c.from_user.id] = True
    user_current_category[c.from_user.id] = "search"
    
    text = (
        "🔎 *Поиск товаров*\n\n"
        "Введите название товара или ключевые слова:\n\n"
        "_Примеры: тестостерон, кломид, тренболон, анастрозол_"
    )
    
    try:
        await c.message.edit_text(text, reply_markup=search_kb())
    except:
        await delete_last_message(c.from_user.id)
        msg = await c.message.answer(text, reply_markup=search_kb())
        save_message_id(c.from_user.id, msg.message_id)

@dp.callback_query(F.data == "cancel_search")
async def cb_cancel_search(c: CallbackQuery):
    """Отмена поиска"""
    await c.answer()
    user_search_state[c.from_user.id] = False
    user_current_category[c.from_user.id] = ""
    
    await cb_menu(c)

# ----------------------------
# PRODUCT CARD - ГАРАНТИРОВАННОЕ ОТОБРАЖЕНИЕ ИЗОБРАЖЕНИЙ
# ----------------------------
@dp.callback_query(F.data.startswith("prod_"))
async def cb_product(c: CallbackQuery):
    """Обработчик просмотра карточки товара с ГАРАНТИРОВАННЫМ отображением изображений"""
    await c.answer()
    pid = c.data.split("_")[1]
    p = PRODUCTS.get(pid)
    
    if not p:
        await c.answer("❌ Товар не найден", show_alert=True)
        return
    
    text = product_card_text(p)
    kb = product_card_kb(pid)
    
    # Удаляем предыдущее сообщение
    await delete_last_message(c.from_user.id)
    
    # ГАРАНТИРОВАННОЕ отображение изображений
    image_url = p.get("image", "").strip()
    image_sent = False
    
    if image_url and validate_image_url(image_url):
        try:
            # Попытка отправить фото
            msg = await c.message.answer_photo(
                photo=image_url,
                caption=text,
                reply_markup=kb
            )
            save_message_id(c.from_user.id, msg.message_id)
            image_sent = True
            logger.info(f"✅ Фото отправлено для товара {pid}")
        except Exception as e:
            logger.warning(f"⚠️ Ошибка отправки фото для товара {pid}: {e}")
            image_sent = False
    
    # Если изображение не отправилось, отправляем текст
    if not image_sent:
        if image_url:
            text += f"\n\n🖼 [Посмотреть фото]({image_url})"
        
        msg = await c.message.answer(text, reply_markup=kb)
        save_message_id(c.from_user.id, msg.message_id)
        logger.info(f"📝 Текст отправлен для товара {pid}")

@dp.callback_query(F.data.startswith("buy_"))
async def cb_buy(c: CallbackQuery):
    pid = c.data.split("_")[1]
    
    if pid not in PRODUCTS:
        await c.answer("❌ Товар не найден", show_alert=True)
        return
    
    product = PRODUCTS[pid]
    if not product["in_stock"]:
        await c.answer("❌ Товар временно отсутствует", show_alert=True)
        return
    
    add_to_cart(c.from_user.id, pid)
    await c.answer(f"✅ {product['name']} добавлен в корзину!")
    
    # Показываем обновленную корзину
    await cb_cart(c)

# ----------------------------
# CART
# ----------------------------
@dp.callback_query(F.data == "show_cart")
async def cb_cart(c: CallbackQuery):
    await c.answer()
    await show_cart_internal(c.from_user.id, c.message)

async def show_cart_internal(user_id: int, message):
    """Внутренняя функция показа корзины"""
    user_search_state[user_id] = False
    user_current_category[user_id] = ""
    
    kb = InlineKeyboardBuilder()
    cart = get_user_cart(user_id)
    
    if cart["items"]:
        kb.button(text="✅ Оформить заказ", callback_data="checkout")
        for pid in cart["items"]:
            if pid in PRODUCTS:
                product_name = PRODUCTS[pid]['name'][:25]
                kb.button(text=f"🗑 {product_name}", callback_data=f"remove_{pid}")

    kb.button(text="🏠 Главное меню", callback_data="back_to_menu")
    kb.adjust(1)

    try:
        await message.edit_text(cart_text(user_id), reply_markup=kb.as_markup())
    except:
        await delete_last_message(user_id)
        msg = await message.answer(cart_text(user_id), reply_markup=kb.as_markup())
        save_message_id(user_id, msg.message_id)

@dp.callback_query(F.data.startswith("remove_"))
async def cb_remove(c: CallbackQuery):
    pid = c.data.split("_")[1]
    remove_from_cart(c.from_user.id, pid)
    await c.answer("🗑 Удалено из корзины")
    await show_cart_internal(c.from_user.id, c.message)

@dp.callback_query(F.data == "checkout")
async def cb_checkout(c: CallbackQuery):
    await c.answer()
    uid = c.from_user.id
    cart = get_user_cart(uid)
    
    if not cart["items"]:
        await c.answer("Корзина пуста", show_alert=True)
        return

    cart["_awaiting_address"] = True
    
    text = f"📦 *Оформление заказа*\n\n{cart_text(uid)}\n\n📍 Введите адрес доставки:"
    
    try:
        await c.message.edit_text(text)
    except:
        await delete_last_message(uid)
        msg = await c.message.answer(text)
        save_message_id(uid, msg.message_id)

# ----------------------------
# TEXT HANDLER - УЛУЧШЕННЫЙ
# ----------------------------
@dp.message(F.text)
async def text_handler(m: Message):
    """УЛУЧШЕННЫЙ обработчик текстовых сообщений"""
    uid = m.from_user.id
    cart = get_user_cart(uid)
    text = m.text.strip()

    # Обработка ввода адреса
    if cart.get("_awaiting_address"):
        cart["_awaiting_address"] = False
        cart["address"] = text

        kb = InlineKeyboardBuilder()
        kb.button(text="💳 Оплата картой", callback_data="pay_card")
        kb.button(text="₿ Криптовалюта", callback_data="pay_crypto")
        kb.adjust(1)

        await delete_last_message(uid)
        msg = await m.answer("✅ Адрес сохранён.\n\nВыберите способ оплаты:", reply_markup=kb.as_markup())
        save_message_id(uid, msg.message_id)
        return

    # Обработка поиска
    if user_search_state.get(uid, False):
        user_search_state[uid] = False
        
        if len(text) < 2:
            await delete_last_message(uid)
            msg = await m.answer("❌ Запрос слишком короткий. Минимум 2 символа.", reply_markup=main_menu_kb())
            save_message_id(uid, msg.message_id)
            return
        
        results = search_products(text)
        
        if not results:
            await delete_last_message(uid)
            msg = await m.answer(
                f"❌ По запросу '*{text}*' ничего не найдено.\n\n"
                "Попробуйте другие ключевые слова.",
                reply_markup=main_menu_kb()
            )
            save_message_id(uid, msg.message_id)
            return
        
        await delete_last_message(uid)
        msg = await m.answer(
            f"🔎 Результаты поиска '*{text}*'\n\nНайдено: {len(results)} товаров",
            reply_markup=products_list_kb(results, category="search")
        )
        save_message_id(uid, msg.message_id)
        return

    # Обычное сообщение - показываем меню
    await delete_last_message(uid)
    msg = await m.answer("Используйте меню или команду /start", reply_markup=main_menu_kb())
    save_message_id(uid, msg.message_id)

# ----------------------------
# PAYMENT HANDLERS
# ----------------------------
@dp.callback_query(F.data == "pay_card")
async def pay_card(c: CallbackQuery):
    await c.answer()
    user_id = c.from_user.id
    cart = get_user_cart(user_id)
    total = calculate_cart_total(user_id)

    prices = []
    for pid, qty in cart["items"].items():
        if pid in PRODUCTS:
            p = PRODUCTS[pid]
            prices.append(
                LabeledPrice(label=f"{p['name'][:30]} x{qty}", amount=int(p["price"] * 100) * qty)
            )

    prices.append(LabeledPrice(label="Доставка", amount=int(DELIVERY_COST_EUR * 100)))

    await bot.send_invoice(
        chat_id=user_id,
        title="TitanShop заказ",
        description=f"Заказ на сумму €{total:.2f}",
        payload=json.dumps({"user": user_id}),
        provider_token=PROVIDER_TOKEN,
        currency=CURRENCY,
        prices=prices,
        start_parameter="order-payment",
    )

@dp.pre_checkout_query()
async def precheckout_handler(q: PreCheckoutQuery):
    await q.answer(True)

@dp.message(F.successful_payment)
async def success_payment(m: Message):
    uid = m.from_user.id
    user_carts[uid] = {"items": {}, "address": None}
    await m.answer("🎉 Оплата успешна! Ваш заказ принят.\n\n📦 Ожидайте доставку.")

@dp.callback_query(F.data == "pay_crypto")
async def pay_crypto(c: CallbackQuery):
    await c.answer()
    uid = c.from_user.id
    total = calculate_cart_total(uid)

    text = f"₿ *Оплата криптовалютой*\n\n💰 Сумма: €{total:.2f}\n\n"
    text += "Выберите валюту и отправьте указанную сумму:\n\n"
    
    for coin, wallet in CRYPTO_WALLETS.items():
        rate = {"BTC": 40000, "ETH": 2500, "USDT": 1}[coin]
        amount = total / rate
        text += f"*{coin}:*\n`{amount:.8f}`\n{wallet}\n\n"
    
    text += "⚠️ После оплаты отправьте скриншот транзакции."

    try:
        await c.message.edit_text(text)
    except:
        await delete_last_message(uid)
        msg = await c.message.answer(text)
        save_message_id(uid, msg.message_id)

# ----------------------------
# STARTUP
# ----------------------------
async def on_startup():
    logger.info("🚀 Запуск улучшенного бота TitanShop...")
    await load_products()
    asyncio.create_task(autosync_loop())
    logger.info("✅ Бот готов к работе!")
    logger.info(f"📦 Загружено товаров: {len(PRODUCTS)}")

if __name__ == "__main__":
    dp.startup.register(on_startup)
    dp.run_polling(bot)
