-- Initialize DB schema and seed initial admin user
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'NETWORK_ENGINEER',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    provider VARCHAR(50),
    provider_id VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    last_login TIMESTAMP WITHOUT TIME ZONE,
    last_login_at TIMESTAMP WITHOUT TIME ZONE
);

-- Seed initial admin user if not exists
-- Username: admin@netconfigdiff.com
-- Password: Password123!
INSERT INTO users (id, email, hashed_password, full_name, role, is_active, is_verified, created_at)
VALUES (
    'a2b92b67-e9a0-4a81-9b16-cd3efd21aa30',
    'admin@netconfigdiff.com',
    '$2b$12$R.Sj9u7tAEx3bB/x0aW/eeS4/0Zc3L2C3r7U2F8OQdCe3/L6Q4h0S',
    'Administrator',
    'ADMIN',
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;
