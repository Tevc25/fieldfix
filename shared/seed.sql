-- FieldFix seed data
-- 20 sample reports across Maribor (real street coordinates)
-- Statuses distributed across all four states for demo purposes

-- ============================================================
-- Helper: clear existing seed data (idempotent re-seed)
-- ============================================================
DELETE FROM status_history;
DELETE FROM reports;

-- ============================================================
-- Reports
-- ============================================================
INSERT INTO reports (id, client_id, title, category, description, lat, lng, address, status, created_at, updated_at) VALUES
-- 1. Udarna jama — Slovenica ulica (center)
(
  'a1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'Globoka udarna jama na Slovenici',
  'pothole',
  'Na Slovenici ulici, tik pred prehodom za pešce, je globoka udarna jama (ca. 20 cm). Nevarno za kolesarje in motocikliste.',
  46.5583, 15.6459,
  'Slovenica ulica, 2000 Maribor',
  'resolved',
  '2026-04-01T08:30:00Z',
  '2026-04-15T10:00:00Z'
),
-- 2. Pokvarjena ulična svetilka — Partizanska cesta
(
  'a1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000002',
  'Nedelujoča svetilka pri Partizanski 18',
  'broken_streetlight',
  'Ulična svetilka pred hišo Partizanska 18 ne deluje že 3 tedne. Ponoči je ta odsek popolnoma temen, kar je nevarno za pešce.',
  46.5567, 15.6482,
  'Partizanska cesta 18, 2000 Maribor',
  'in_review',
  '2026-04-05T19:00:00Z',
  '2026-04-06T09:00:00Z'
),
-- 3. Grafiti — podhod pri Titovi cesti
(
  'a1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000003',
  'Obsceni grafiti v podhodnem prehodu',
  'graffiti',
  'V podhodnem prehodu pod Titovo cesto so obsceni grafiti, ki so vidni otrokom na poti v šolo. Prosim za čim hitrejšo odstranitev.',
  46.5601, 15.6401,
  'Titova cesta (podhod), 2000 Maribor',
  'submitted',
  '2026-04-10T11:15:00Z',
  '2026-04-10T11:15:00Z'
),
-- 4. Ilegalno odlaganje — Pobreška cesta
(
  'a1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-000000000004',
  'Divje odlaganje smeti pri Pobreški cesti',
  'illegal_dumping',
  'Ob Pobreški cesti, pri zavoju za gramoznico, je narasla divja deponija. Vreče s smeti, stara pohištva in gradbeni odpadki.',
  46.5521, 15.6672,
  'Pobreška cesta, 2000 Maribor',
  'in_review',
  '2026-04-08T14:00:00Z',
  '2026-04-09T08:30:00Z'
),
-- 5. Poškodovana prometna signalizacija — Koroška cesta
(
  'a1000000-0000-0000-0000-000000000005',
  'c1000000-0000-0000-0000-000000000005',
  'Pokrivalo stop znaka – pokrit s plakatom',
  'damaged_sign',
  'Stop znak na križišču Koroška/Prešernova je povsem pokrit z reklamnim plakatom. Vozniki morda ne vidijo znaka.',
  46.5648, 15.6388,
  'Koroška cesta / Prešernova ulica, 2000 Maribor',
  'submitted',
  '2026-04-12T07:45:00Z',
  '2026-04-12T07:45:00Z'
),
-- 6. Udarna jama — Lackova cesta (Pobrežje)
(
  'a1000000-0000-0000-0000-000000000006',
  'c1000000-0000-0000-0000-000000000006',
  'Udarna jama pred vhodom v Hofer',
  'pothole',
  'Neposredno pred uvozom na parkirišče Hofer na Lackovi cesti je velika udarna jama. Stranke so jo že poškodovale pnevmatike.',
  46.5511, 15.6588,
  'Lackova cesta 55, 2000 Maribor',
  'resolved',
  '2026-03-20T10:00:00Z',
  '2026-04-01T12:00:00Z'
),
-- 7. Pokvarjena svetilka — Ulica heroja Šarha (Magdalena)
(
  'a1000000-0000-0000-0000-000000000007',
  'c1000000-0000-0000-0000-000000000007',
  'Temna ulica pri Magdaleni – 4 svetilke pokvarjene',
  'broken_streetlight',
  'Na ulici heroja Šarha ne delujejo vsaj 4 zaporedne svetilke. Ulica je ponoči povsem neosvetljena na dolžini ca. 150 m.',
  46.5701, 15.6521,
  'Ulica heroja Šarha, 2000 Maribor',
  'submitted',
  '2026-04-14T21:30:00Z',
  '2026-04-14T21:30:00Z'
),
-- 8. Grafiti — stena pri ŽP Maribor
(
  'a1000000-0000-0000-0000-000000000008',
  'c1000000-0000-0000-0000-000000000008',
  'Grafiti na fasadi ob železniški postaji',
  'graffiti',
  'Na steni ob vstopu na železniško postajo Maribor so veliki grafiti, ki kvarijo vizualno podobo mesta in motijo turiste.',
  46.5591, 15.6557,
  'Partizanska cesta 50 (ŽP Maribor), 2000 Maribor',
  'rejected',
  '2026-03-15T09:00:00Z',
  '2026-03-18T11:00:00Z'
),
-- 9. Ilegalno odlaganje — Pekrska cesta
(
  'a1000000-0000-0000-0000-000000000009',
  'c1000000-0000-0000-0000-000000000009',
  'Odloženi gradbeni material pri Pekrski',
  'illegal_dumping',
  'Nekdo je pri stranskem vstopu v park ob Pekrski cesti odložil večjo količino gradbenega materiala (opeka, beton).',
  46.5762, 15.6389,
  'Pekrska cesta, 2000 Maribor',
  'submitted',
  '2026-04-13T16:20:00Z',
  '2026-04-13T16:20:00Z'
),
-- 10. Poškodovana signalizacija — Tyrševa ulica
(
  'a1000000-0000-0000-0000-000000000010',
  'c1000000-0000-0000-0000-000000000010',
  'Podrto prometno ogledalo pri Tyrševi',
  'damaged_sign',
  'Prometno ogledalo na križišču pri Tyrševi ulici je podrtom in leži ob cesti. Brez ogledala je pregled v križišče slabo viden.',
  46.5559, 15.6442,
  'Tyrševa ulica, 2000 Maribor',
  'in_review',
  '2026-04-11T13:00:00Z',
  '2026-04-12T08:00:00Z'
),
-- 11. Udarna jama — Cesta proletarskih brigad (Tabor)
(
  'a1000000-0000-0000-0000-000000000011',
  'c1000000-0000-0000-0000-000000000011',
  'Serija udarnih jam na Cesti proletarskih brigad',
  'pothole',
  'Na odseku med hišnima štev. 4 in 12 je vsaj 6 udarnih jam različnih globin. Cesta je bila slabo zakrpana po zimski sezoni.',
  46.5625, 15.6501,
  'Cesta proletarskih brigad, 2000 Maribor',
  'submitted',
  '2026-04-15T08:00:00Z',
  '2026-04-15T08:00:00Z'
),
-- 12. Pokvarjena svetilka — Gosposvetska cesta
(
  'a1000000-0000-0000-0000-000000000012',
  'c1000000-0000-0000-0000-000000000012',
  'Svetilka pri Gosposvetski brez luči 2 meseca',
  'broken_streetlight',
  'Svetilka pred gimnazijo pri Gosposvetski cesti ne deluje že od februarja. Šolarji ponoči hodijo po temi.',
  46.5579, 15.6421,
  'Gosposvetska cesta 2, 2000 Maribor',
  'resolved',
  '2026-02-10T17:00:00Z',
  '2026-04-05T09:00:00Z'
),
-- 13. Grafiti — podvoz Tezno
(
  'a1000000-0000-0000-0000-000000000013',
  'c1000000-0000-0000-0000-000000000013',
  'Grafiti v podvozu pri Teznu',
  'graffiti',
  'V podvozu pri industrijskem predelu Tezno so vandali naslikali žaljive napise. Vsak dan jih vidijo vozači in kolesarji.',
  46.5448, 15.6612,
  'Podvoz Tezno, 2000 Maribor',
  'in_review',
  '2026-04-09T12:00:00Z',
  '2026-04-10T07:00:00Z'
),
-- 14. Ilegalno odlaganje — Bresterniška ulica
(
  'a1000000-0000-0000-0000-000000000014',
  'c1000000-0000-0000-0000-000000000014',
  'Zapuščena hladilna tehnika pri Bresterniški',
  'illegal_dumping',
  'Ob Bresterniški ulici so odloženi hladilnik, zamrzovalnik in mikrovalovna pečica. Elektronski odpadki vsebujejo nevarne snovi.',
  46.5492, 15.6532,
  'Bresterniška ulica, 2000 Maribor',
  'submitted',
  '2026-04-16T09:30:00Z',
  '2026-04-16T09:30:00Z'
),
-- 15. Poškodovana signalizacija — Ulica Vita Kraigherja
(
  'a1000000-0000-0000-0000-000000000015',
  'c1000000-0000-0000-0000-000000000015',
  'Poškodovan semafor – utripa le rumena',
  'damaged_sign',
  'Semafor na križišču pri ulici Vita Kraigherja utripa samo rumena luč (rdeča in zelena ne delujeta). Vozniki ne vedo, kdo ima prednost.',
  46.5618, 15.6462,
  'Ulica Vita Kraigherja, 2000 Maribor',
  'in_review',
  '2026-04-14T07:15:00Z',
  '2026-04-14T09:00:00Z'
),
-- 16. Udarna jama — Ulica talcev (Rotovž)
(
  'a1000000-0000-0000-0000-000000000016',
  'c1000000-0000-0000-0000-000000000016',
  'Udarna jama pred hotelom Orel',
  'pothole',
  'Pred hotelom Orel na Ulici talcev je velika udarna jama, ki je prav pri vstopu za hotelske goste in turiste. Slaba vizitka mesta.',
  46.5601, 15.6461,
  'Ulica talcev 5, 2000 Maribor',
  'resolved',
  '2026-03-28T10:00:00Z',
  '2026-04-10T14:00:00Z'
),
-- 17. Pokvarjena svetilka — Kamniška ulica (Pobrežje)
(
  'a1000000-0000-0000-0000-000000000017',
  'c1000000-0000-0000-0000-000000000017',
  'Temni odsek Kamniška ulica – varnostno tveganje',
  'broken_streetlight',
  'Na Kamniški ulici v Pobrežju ne delujejo 3 svetilke na dolžini 80 m. Stanovalci se bojijo hoditi zvečer, saj gre za slabo vidno območje.',
  46.5539, 15.6699,
  'Kamniška ulica, 2000 Maribor',
  'submitted',
  '2026-04-16T20:00:00Z',
  '2026-04-16T20:00:00Z'
),
-- 18. Grafiti — stena pri OŠ Tone Čufar
(
  'a1000000-0000-0000-0000-000000000018',
  'c1000000-0000-0000-0000-000000000018',
  'Vandalizem na šolski ograji – OŠ Tone Čufar',
  'graffiti',
  'Ograja OŠ Tone Čufar je bila vandalizirana z grafiti. Ker gre za šolsko okolico, je prioritetno čiščenje nujno.',
  46.5482, 15.6481,
  'OŠ Tone Čufar, 2000 Maribor',
  'submitted',
  '2026-04-15T15:00:00Z',
  '2026-04-15T15:00:00Z'
),
-- 19. Ilegalno odlaganje — ob reki Dravi (Lent)
(
  'a1000000-0000-0000-0000-000000000019',
  'c1000000-0000-0000-0000-000000000019',
  'Smeti ob bregu Drave pri Lentu',
  'illegal_dumping',
  'Turistično območje Lent ob Dravi je onesnaženo z vrečami smeti, ki so jih pustili obiskovalci. Območje je nedavno dobilo naziv kulturna dediščina.',
  46.5581, 15.6378,
  'Lent ob Dravi, 2000 Maribor',
  'resolved',
  '2026-04-01T09:00:00Z',
  '2026-04-03T11:00:00Z'
),
-- 20. Poškodovana signalizacija — Jurčičeva ulica
(
  'a1000000-0000-0000-0000-000000000020',
  'c1000000-0000-0000-0000-000000000020',
  'Prevrnjen in poškodovan prometni znak P2',
  'damaged_sign',
  'Prednostna cesta znak (P2) na Jurčičevi ulici je prevrnjen in poškodovan. Brez znaka vozniki ne vedo, kdo ima prednost na tem enosmernem odseku.',
  46.5569, 15.6507,
  'Jurčičeva ulica, 2000 Maribor',
  'submitted',
  '2026-04-16T11:45:00Z',
  '2026-04-16T11:45:00Z'
);

-- ============================================================
-- Status history (initial 'submitted' entry + transitions)
-- ============================================================

-- Report 1: submitted → in_review → resolved
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0001-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'submitted',  NULL, '2026-04-01T08:30:00Z'),
('h1000000-0001-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'in_review',  'Komunala MBX bo posredovala ekipo.', '2026-04-03T09:00:00Z'),
('h1000000-0001-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'resolved',   'Jama je bila zapolnjena z asfaltom.', '2026-04-15T10:00:00Z');

-- Report 2: submitted → in_review
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0002-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'submitted',  NULL, '2026-04-05T19:00:00Z'),
('h1000000-0002-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'in_review',  'Elektro MBX pregleda žarnico.', '2026-04-06T09:00:00Z');

-- Report 3: submitted only
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0003-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'submitted',  NULL, '2026-04-10T11:15:00Z');

-- Report 4: submitted → in_review
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0004-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 'submitted',  NULL, '2026-04-08T14:00:00Z'),
('h1000000-0004-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', 'in_review',  'Komunala MBX organizira odvoz.', '2026-04-09T08:30:00Z');

-- Report 5: submitted only
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0005-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005', 'submitted',  NULL, '2026-04-12T07:45:00Z');

-- Report 6: submitted → in_review → resolved
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0006-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', 'submitted',  NULL, '2026-03-20T10:00:00Z'),
('h1000000-0006-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', 'in_review',  'Planirana asfaltacija.', '2026-03-22T09:00:00Z'),
('h1000000-0006-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000006', 'resolved',   'Izvedena asfaltacija parkirišča.', '2026-04-01T12:00:00Z');

-- Report 7: submitted only
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0007-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000007', 'submitted',  NULL, '2026-04-14T21:30:00Z');

-- Report 8: submitted → in_review → rejected
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0008-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000008', 'submitted',  NULL, '2026-03-15T09:00:00Z'),
('h1000000-0008-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000008', 'in_review',  'Preverili bomo pristojnost.', '2026-03-16T10:00:00Z'),
('h1000000-0008-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000008', 'rejected',   'Stena je last SŽ — posredovano Slovenskim železnicam.', '2026-03-18T11:00:00Z');

-- Reports 9–11, 13–15, 17–20: submitted only
INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES
('h1000000-0009-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000009', 'submitted', NULL, '2026-04-13T16:20:00Z'),
('h1000000-0010-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000010', 'submitted', NULL, '2026-04-11T13:00:00Z'),
('h1000000-0010-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000010', 'in_review', 'Prometna služba posreduje.', '2026-04-12T08:00:00Z'),
('h1000000-0011-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000011', 'submitted', NULL, '2026-04-15T08:00:00Z'),
('h1000000-0012-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000012', 'submitted', NULL, '2026-02-10T17:00:00Z'),
('h1000000-0012-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000012', 'in_review', 'Napoteno vzdrževanje.', '2026-03-01T09:00:00Z'),
('h1000000-0012-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000012', 'resolved',  'Žarnica zamenjana.', '2026-04-05T09:00:00Z'),
('h1000000-0013-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000013', 'submitted', NULL, '2026-04-09T12:00:00Z'),
('h1000000-0013-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000013', 'in_review', 'Razpisano čiščenje.', '2026-04-10T07:00:00Z'),
('h1000000-0014-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000014', 'submitted', NULL, '2026-04-16T09:30:00Z'),
('h1000000-0015-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000015', 'submitted', NULL, '2026-04-14T07:15:00Z'),
('h1000000-0015-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000015', 'in_review', 'Elektro servis napoten.', '2026-04-14T09:00:00Z'),
('h1000000-0016-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000016', 'submitted', NULL, '2026-03-28T10:00:00Z'),
('h1000000-0016-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000016', 'in_review', 'Sanacija v teku.', '2026-03-30T09:00:00Z'),
('h1000000-0016-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000016', 'resolved',  'Jama zakrpana pred hotelom.', '2026-04-10T14:00:00Z'),
('h1000000-0017-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000017', 'submitted', NULL, '2026-04-16T20:00:00Z'),
('h1000000-0018-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000018', 'submitted', NULL, '2026-04-15T15:00:00Z'),
('h1000000-0019-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000019', 'submitted', NULL, '2026-04-01T09:00:00Z'),
('h1000000-0019-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000019', 'in_review', 'Komunala organizira čiščenje.', '2026-04-02T08:00:00Z'),
('h1000000-0019-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000019', 'resolved',  'Breg Drave očiščen.', '2026-04-03T11:00:00Z'),
('h1000000-0020-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000020', 'submitted', NULL, '2026-04-16T11:45:00Z');
