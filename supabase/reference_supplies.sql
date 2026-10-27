-- Reference inventory requested by the stakeholder, including In Stock items.
-- Run once on the existing OSAS project after the inventory migrations.
-- Safe to re-run: insert missing items only, fill blank descriptions/categories,
-- and preserve existing quantities, locations, dates, IDs and restock history.
-- Status is calculated by the app from quantity and expiry, never hardcoded.
-- The CPR mask quantity is indistinct in the image; 5 pcs is the sample value.
WITH reference_stock (item, description, category, quantity, unit, location, expiry, reorder_threshold) AS (
  VALUES
  ('Adhesive bandages', 'Box of 100 pcs', 'Wound Care', 12, 'boxes', 'Clinic Cabinet A', '2027-06-10', 5),
  ('Instant cold packs', 'Pack of 2', 'Emergency', 2, 'pcs', 'Emergency Bag', '2026-10-13', 4),
  ('Sterile gauze pads (4x4)', 'Pack of 5', 'Wound Care', 5, 'packs', 'Clinic Cabinet A', '2027-03-02', 5),
  ('Antiseptic solution', '500ml bottle', 'Cleaning', 8, 'bottles', 'Clinic Cabinet B', '2027-08-15', 3),
  ('Medical gloves', 'Box of 100', 'PPE', 4, 'boxes', 'Clinic Cabinet A', '2026-05-12', 5),
  ('Thermometer', 'Digital', 'Equipment', 6, 'pcs', 'Clinic Cabinet B', '2027-12-10', 2),
  ('Bandage rolls', '4 inch', 'Wound Care', 3, 'rolls', 'Emergency Bag', '2026-11-05', 4),
  ('CPR mask', 'With filter', 'Emergency', 5, 'pcs', 'First Aid Station', '2028-01-20', 2),
  ('Instant ice packs', 'Pack of 2', 'Emergency', 1, 'pack', 'Emergency Bag', '2026-09-08', 3),
  ('Alcohol wipes', 'Pack of 50', 'Cleaning', 7, 'packs', 'Clinic Cabinet A', '2027-03-18', 5)
), enriched AS (
  UPDATE public.supplies AS s
  SET description = COALESCE(NULLIF(btrim(s.description), ''), r.description),
      category = COALESCE(NULLIF(btrim(s.category), ''), r.category)
  FROM reference_stock AS r
  WHERE lower(btrim(s.item)) = lower(r.item)
    AND (NULLIF(btrim(s.description), '') IS NULL OR NULLIF(btrim(s.category), '') IS NULL)
  RETURNING s.id
)
INSERT INTO public.supplies (item, description, category, quantity, unit, location, expiry, reorder_threshold)
SELECT r.item, r.description, r.category, r.quantity, r.unit, r.location, r.expiry::date, r.reorder_threshold
FROM reference_stock AS r
WHERE NOT EXISTS (
  SELECT 1 FROM public.supplies AS s WHERE lower(btrim(s.item)) = lower(r.item)
);
