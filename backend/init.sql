-- init.sql – Erstellt die Tabellen und fügt Beispieldaten ein

-- Tabelle für Benutzer
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle für gespeicherte Sideboard-Konfigurationen
CREATE TABLE IF NOT EXISTS configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id INT DEFAULT NULL,
    farbe VARCHAR(50) DEFAULT 'weiss',
    groesse VARCHAR(20) DEFAULT 'mittel',
    deckel_offen BOOLEAN DEFAULT FALSE,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabelle für benannte, gespeicherte Sideboards im Profil
CREATE TABLE IF NOT EXISTS saved_sideboards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    farbe VARCHAR(50) DEFAULT 'weiss',
    groesse VARCHAR(20) DEFAULT 'mittel',
    deckel_offen BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabelle für verfügbares Zubehör
CREATE TABLE IF NOT EXISTS accessories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    preis DECIMAL(10, 2) NOT NULL,
    bild_url VARCHAR(500) DEFAULT '',
    beschreibung VARCHAR(255) DEFAULT ''
);

-- Tabelle für den Warenkorb
CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id INT DEFAULT NULL,
    accessory_id INT NOT NULL,
    menge INT DEFAULT 1,
    hinzugefuegt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cart_session (session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE CASCADE
);

-- Beispiel-Zubehör einfügen
INSERT INTO accessories (name, preis, bild_url, beschreibung) VALUES
('LED-Lichtleiste', 24.99, 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300&h=200&fit=crop', 'Warmweiße LED-Leiste für stimmungsvolle Beleuchtung'),
('Organizer-Einsatz', 14.99, 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=300&h=200&fit=crop', 'Praktische Facheinteilung aus Bambus'),
('Kabeldurchführung', 7.99, 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300&h=200&fit=crop', 'Elegante Kabeldurchführung aus gebürstetem Aluminium'),
('Filz-Einlage', 9.99, 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=300&h=200&fit=crop', 'Schützt empfindliche Oberflächen, anthrazit'),
('Glasplatte (Auflage)', 39.99, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&h=200&fit=crop', 'Gehärtetes Glas als Deckplatte, 6mm'),
('Deko-Vase (klein)', 19.99, 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=300&h=200&fit=crop', 'Minimalistische Keramikvase in Weiß');
