-- init.sql – Fruit Drink Company Datenbank

-- 1. Benutzer
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Konfigurationen (Fruit Drink)
CREATE TABLE IF NOT EXISTS configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id INT DEFAULT NULL,
    name VARCHAR(255) DEFAULT 'Mein Fruit Drink',
    frucht1 VARCHAR(50) DEFAULT 'apfel',
    frucht2 VARCHAR(50) DEFAULT 'orange',
    frucht3 VARCHAR(50) DEFAULT 'keine',
    groesse VARCHAR(20) DEFAULT 'mittel',
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session (session_id)
);

-- 3. Community Drinks (von anderen Nutzern)
CREATE TABLE IF NOT EXISTS community_drinks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    frucht1 VARCHAR(50) NOT NULL,
    frucht2 VARCHAR(50) DEFAULT 'keine',
    frucht3 VARCHAR(50) DEFAULT 'keine',
    groesse VARCHAR(20) DEFAULT 'mittel',
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Shop Artikel (Küchenartikel)
CREATE TABLE IF NOT EXISTS accessories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    beschreibung TEXT,
    preis DECIMAL(10, 2) NOT NULL,
    bild_url VARCHAR(500) DEFAULT '',
    category VARCHAR(100) DEFAULT 'Allgemein',
    stock INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. Warenkorb
CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    accessory_id INT NOT NULL,
    menge INT DEFAULT 1,
    hinzugefuegt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cart_session (session_id),
    FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE CASCADE
);

-- 6. Bestellungen
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    vorname VARCHAR(100) NOT NULL,
    nachname VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    adresse TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shop Artikel Beispieldaten
INSERT INTO accessories (name, preis, bild_url, beschreibung, category) VALUES
('Smoothie Glas 500ml', 8.99, 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=200&fit=crop', 'Hochwertiges Trinkglas', 'Gläser'),
('Mixer Pro 1000W', 49.99, 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=300&h=200&fit=crop', 'Leistungsstarker Standmixer', 'Geräte'),
('Strohhalm Set (10er)', 3.99, 'https://images.unsplash.com/photo-1559181567-c3190ca9d222?w=300&h=200&fit=crop', 'Wiederverwendbare Strohhalme', 'Zubehör'),
('Schneidebrett Bambus', 12.99, 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=300&h=200&fit=crop', 'Nachhaltiges Bambusbrett', 'Küche'),
('Saftpresse Manuell', 15.99, 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop', 'Für Zitronen und Orangen', 'Geräte'),
('Trinkflasche 750ml', 18.99, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&h=200&fit=crop', 'Edelstahl, isoliert', 'Gläser'),
('Sieb Feinmaschig', 6.99, 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop', 'Für fruchtiges Filtern', 'Küche');

-- Community Drinks Beispieldaten
INSERT INTO community_drinks (username, name, frucht1, frucht2, frucht3, groesse) VALUES
('Max', 'Tropical Sunrise', 'mango', 'ananas', 'orange', 'gross'),
('Lisa', 'Berry Blast', 'erdbeere', 'himbeere', 'keine', 'mittel'),
('Tom', 'Green Power', 'apfel', 'kiwi', 'keine', 'klein'),
('Sara', 'Citrus Mix', 'orange', 'zitrone', 'mango', 'gross'),
('Felix', 'Classic Apple', 'apfel', 'keine', 'keine', 'mittel');