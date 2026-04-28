-- Migration pour supprimer le champ password_hash de la table users
-- Exécuter cette commande dans votre base de données PostgreSQL/MySQL

-- Supprimer le champ password_hash de la table users
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- Confirmer que le champ a été supprimé
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public';
