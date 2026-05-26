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