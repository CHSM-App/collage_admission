-- Create admins table and seed one super-admin account
-- Password: Admin@123
-- Hash below = bcrypt("Admin@123", 10)

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admins'
)
BEGIN
  CREATE TABLE admins (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(100)  NOT NULL,
    email         NVARCHAR(150)  NOT NULL UNIQUE,
    password_hash NVARCHAR(255)  NOT NULL,
    created_at    DATETIME       DEFAULT GETDATE()
  );
END

-- Insert super-admin (skip if already exists)
IF NOT EXISTS (SELECT 1 FROM admins WHERE email = 'admin@vengurlatech.com')
BEGIN
  INSERT INTO admins (name, email, password_hash)
  VALUES (
    'Super Admin',
    'admin@vengurlatech.com',
    '$2a$10$Iu4D3b3U8bFmFNjq3J2fYOv6yYB0J8dT8rO0XJkKjT1TfUvP6mOSO'
    -- bcrypt hash of: Admin@123
  );
END
