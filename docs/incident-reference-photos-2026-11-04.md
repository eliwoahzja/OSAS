# Historical incident reference photos

Six historical incident records were associated with one illustrative photo each on November 4, 2026. These pictures are **reference illustrations only** and are **not actual photographs of the incidents, students, staff, or St. Agnes Academy**.

Their URLs are stored in `public.incidents.reference_images`, a JSON array containing `url` (image), `source` (the original Wikimedia Commons file page), and `alt` (the explanation). The existing `photo_path` and `photo_paths` fields remain the source of actual incident evidence, are not modified, and continue to use private Supabase Storage signed URLs.

Reference photos are remote Wikimedia Commons images. This avoids importing unrelated public photos into the confidential incident-evidence bucket. Their availability depends on Wikimedia Commons serving its image URLs.

| Historical incident example | Wikimedia Commons reference | License |
| --- | --- | --- |
| Wet staircase | [Wet floor caution sugn](https://commons.wikimedia.org/wiki/File:Wet_floor_caution_sugn.jpg) | CC0 |
| Parking bicycle theft | [Bicycles in a rack](https://commons.wikimedia.org/wiki/File:Bicycles_in_a_rack.jpg) | CC0 |
| Laboratory equipment failure | [ChiTownBioInterior](https://commons.wikimedia.org/wiki/File:ChiTownBioInterior.jpg) | CC0 |
| Clinic allergic reaction | [First Aid Kit for Immediate Emergency Response 01](https://commons.wikimedia.org/wiki/File:First_Aid_Kit_for_Immediate_Emergency_Response_01.jpg) | CC0 |
| Gym slip | [Indoor gymnasium](https://commons.wikimedia.org/wiki/File:Indoor_gymnasium.jpg) | CC0 |
| Gymnasium fainting | [Dana Gym 015-web](https://commons.wikimedia.org/wiki/File:Dana_Gym_015-web.jpg) | CC0 |

Only six explicitly selected historical records with no actual images and no authenticated submitter were updated. Student-created reports were left unchanged. The application labels each reference image as illustrative and links to the original file page. The database rejects nonempty reference images supplied by nonadmin users when they submit reports, and limits the array to two entries.

For an authentic incident evidence demonstration, submit a report with actual images using the existing upload feature. Do not present Wikimedia reference images as proof that an incident happened.
