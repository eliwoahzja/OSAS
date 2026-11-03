ALTER TABLE public.announcements ADD COLUMN image_path text
  CHECK (image_path IS NULL OR image_path ~ '^assets/announcements/[a-z0-9-]+\.jpg$');

-- Import the three school posters supplied by the site owner. Keep their event
-- dates in the message; the existing trigger records when they were published.
-- No account is impersonated: imports use the generic OSAS Administrator byline.
INSERT INTO public.announcements(title, body, image_path)
SELECT 'Long Spookend — Class Schedule',
  E'October 30: No classes (all levels).\nNovember 1: All Saints’ Day.\nNovember 2: All Souls’ Day.\nNovember 3: Resumption of classes.\n\nHave a safe, restful, and spooktacular long weekend!',
  'assets/announcements/long-spookend.jpg'
WHERE NOT EXISTS (SELECT 1 FROM public.announcements WHERE image_path = 'assets/announcements/long-spookend.jpg');

INSERT INTO public.announcements(title, body, image_path)
SELECT 'Happy Teachers’ Day!',
  'Thank you for your warmth, guidance, and endless patience.',
  'assets/announcements/teachers-day.jpg'
WHERE NOT EXISTS (SELECT 1 FROM public.announcements WHERE image_path = 'assets/announcements/teachers-day.jpg');

INSERT INTO public.announcements(title, body, image_path)
SELECT 'SAAC Dance Troupe Auditions',
  E'Calling out new members!\n\nAudition: September 28, 2026, at 2:00 PM.\nVenue: St. Agnes Academy Quadrangle Court.\n\nAudition na!',
  'assets/announcements/dance-troupe-auditions.jpg'
WHERE NOT EXISTS (SELECT 1 FROM public.announcements WHERE image_path = 'assets/announcements/dance-troupe-auditions.jpg');
