-- 1. TABLE CONTRACT_REQUESTS (Demandes de contrat)
CREATE TABLE contract_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL REFERENCES users(id),
    
    -- Trajet (comme dans rides)
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10,8),
    pickup_lng DECIMAL(11,8),
    dropoff_address TEXT NOT NULL,
    dropoff_lat DECIMAL(10,8),
    dropoff_lng DECIMAL(11,8),
    
    -- Horaires
    start_time TIME NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Type CDD/CDI
    contract_type VARCHAR(10) DEFAULT 'cdd', -- 'cdd', 'cdi'
    
    -- Montant par course
    amount_per_ride DECIMAL(10,2) NOT NULL,
    
    -- Audio
    voice_note_url TEXT,
    
    -- Statut
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, active, completed
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_contract_requests_passenger (passenger_id),
    INDEX idx_contract_requests_status (status)
);

-- 2. TABLE CONTRACTS (Contrats actifs)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES contract_requests(id),
    passenger_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID NOT NULL REFERENCES users(id),
    
    amount_per_ride DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 10.00, -- Commission (ex: 10%)
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    status VARCHAR(20) DEFAULT 'active', -- active, paused, completed, cancelled
    
    accepted_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_contracts_driver (driver_id),
    INDEX idx_contracts_passenger (passenger_id)
);

-- 3. TABLE CONTRACT_RIDES (Courses générées par le contrat)
CREATE TABLE contract_rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    ride_id UUID REFERENCES rides(id), -- Lien vers la course existante
    
    ride_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, completed, missed, cancelled
    
    amount DECIMAL(10,2),
    commission_amount DECIMAL(10,2),
    driver_earning DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_contract_rides_contract (contract_id),
    INDEX idx_contract_rides_date (ride_date)
);

-- 4. TABLE COMMISSION_WITHDRAWALS (Retraits de commission mensuels)
CREATE TABLE commission_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    amount DECIMAL(10,2) NOT NULL,
    month DATE NOT NULL, -- Premier jour du mois
    status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed
    transaction_id UUID REFERENCES transactions(id), -- Lien vers transaction wallet
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_commission_withdrawals_driver (driver_id),
    INDEX idx_commission_withdrawals_month (month)
);









































-- Insertion des catégories de transport à Kinshasa (réalité du terrain)
INSERT INTO categories (id, name, slug, type, icon, description, base_fare, per_km_rate, per_minute_rate, min_fare, wait_free_minutes, wait_paid_per_minute, pause_per_minute, display_order, is_active, created_at, updated_at) VALUES

-- Transport collectif (Mercedes 207, minibus)
(gen_random_uuid(), 'Transport Collectif', 'public-transport', 'ride', '🚐', 'Transport en commun - Mercedes 207, Taxi-bus. Trajet partagé.', 200, 300, 30, 1000, 3, 60, 50, 1, true, NOW(), NOW()),

-- Navette / Van (Mercedes Sprinter)
(gen_random_uuid(), 'Navette Sprinter', 'sprinter-shuttle', 'ride', '🚌', 'Navette confortable - Mercedes Sprinter. Idéal pour les groupes.', 500, 600, 60, 2000, 5, 120, 100, 2, true, NOW(), NOW()),

-- Taxi-Moto (omniprésent à Kinshasa)
(gen_random_uuid(), 'Moto-Taxi', 'moto-taxi', 'ride', '🏍️', 'Rapide et agile pour éviter les embouteillages', 250, 400, 40, 1000, 3, 80, 60, 3, true, NOW(), NOW()),

-- Berline / VTC (classe affaires)
(gen_random_uuid(), 'Berline Confort', 'berline', 'ride', '🚘', 'Voyagez en confort dans une berline climatisée', 800, 900, 80, 3000, 5, 150, 120, 4, true, NOW(), NOW()),

-- Grand volume / Camionnette (déménagement, marchandises)
(gen_random_uuid(), 'Transport Marchandises', 'cargo-transport', 'heavy', '🚛', 'Transport de marchandises - Camionnette, utilitaire', 5000, 40000, 0, 20000, 10, 500, 400, 20, true, NOW(), NOW());