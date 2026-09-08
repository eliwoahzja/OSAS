ALTER TABLE risks ADD COLUMN IF NOT EXISTS threat SMALLINT CHECK (threat BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS vulnerability SMALLINT CHECK (vulnerability BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS exploit_likelihood SMALLINT CHECK (exploit_likelihood BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS exploit_impact SMALLINT CHECK (exploit_impact BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS asset_value SMALLINT CHECK (asset_value BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS security_controls SMALLINT CHECK (security_controls BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS risk_score INT;

ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_risk_level_check;
ALTER TABLE risks ADD CONSTRAINT risks_risk_level_check CHECK (risk_level IN ('Low', 'Medium', 'Moderate', 'High', 'Critical'));
