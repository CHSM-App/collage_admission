-- Seed Elphinstone College (college_id = 2) with the university's Prgmaster.
--
-- Source: the Prgmaster screen — Faculty / Prgcode / Prgnm. The Faculty number
-- is what the coursemaster.xls and groupmaster.xls imports resolve on, so it
-- goes into faculty_master.university_faculty_no (migration 046).
--
-- Two things the source screen does not carry:
--   * duration_years — every row here is a 3-year bachelor's degree.
--   * the semester / exam-seat codes — left NULL. Program Master requires them
--     before a program can be re-saved from its form, so fill them in there.
--
-- Prgcode for faculty 13 sits behind the row-selection highlight on the screen;
-- college_result migration 033 records it as BSC(HS), matching its name.
--
-- Idempotent: matches on (college_id, degree_course_code) — the same key
-- uq_faculty_college_code and the prgmaster importer use — so re-running
-- corrects rows in place instead of duplicating them. Programs already on this
-- college but absent here are left untouched.

DECLARE @college_id INT = 2;   -- Elphinstone College (ELPS). NB: id 1 is BSKKV, Dapoli —
                               -- seed_elphinstone_100.js's "id=1" comment is stale.

IF NOT EXISTS (SELECT 1 FROM colleges WHERE id = @college_id)
BEGIN
    RAISERROR('No college with id %d — check the colleges table before running this.', 16, 1, @college_id);
    RETURN;
END

DECLARE @prg TABLE (
    faculty_no  INT,
    prg_code    NVARCHAR(20),
    prg_name    NVARCHAR(200),
    duration    INT
);

INSERT INTO @prg (faculty_no, prg_code, prg_name, duration) VALUES
    ( 1, 'BA',         'Bachelor of Arts',                             3),
    ( 2, 'BCOM',       'Bachelor of Commerce',                         3),
    ( 3, 'BSC',        'Bachelor of Science',                          3),
    ( 4, 'BSC(IT)',    'Bachelor of Science (Information Technology)',  3),
    ( 5, 'BSC(CS)',    'Bachelor of Computer Science',                 3),
    ( 6, 'BCOM(MS)',   'Bachelor of Commerce (Management Studies)',     3),
    ( 7, 'BBI',        'Bachelor of Commerce (Banking & Insurance)',    3),
    ( 8, 'BAF',        'Bachelor of Commerce (Accounting & Finance)',   3),
    ( 9, 'BSC(BIO)',   'Bachelor of Science (Biotech)',                3),
    (10, 'BMM',        'Bachelor of Mass Media',                      3),
    (11, 'BFM',        'Bachelor of Commerce (Finance Market)',        3),
    (12, 'BSC(MICRO)', 'Bachelor of Science (Microbiology)',           3),
    (13, 'BSC(HS)',    'Bachelor of Science (Hospitality Studies)',     3);

-- uq_faculty_university_no is filtered on (college_id, university_faculty_no),
-- so a number already held by a program NOT in this list would break the write.
-- Say which one instead of surfacing a raw duplicate-key error.
DECLARE @clash NVARCHAR(1000) = (
    SELECT STUFF((
        SELECT ', ' + fm.degree_course_code + ' (faculty ' + CAST(fm.university_faculty_no AS NVARCHAR(10)) + ')'
        FROM faculty_master fm
        WHERE fm.college_id = @college_id
          AND fm.university_faculty_no IN (SELECT faculty_no FROM @prg)
          AND fm.degree_course_code NOT IN (SELECT prg_code FROM @prg)
        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(1000)'), 1, 2, '')
);

IF @clash IS NOT NULL AND LEN(@clash) > 0
BEGIN
    RAISERROR('These programs already hold a faculty number this file assigns elsewhere: %s. Clear their Univ. Faculty No first.', 16, 1, @clash);
    RETURN;
END

MERGE faculty_master AS t
USING (SELECT faculty_no, prg_code, prg_name, duration FROM @prg) AS s
   ON t.college_id = @college_id AND t.degree_course_code = s.prg_code
WHEN MATCHED THEN UPDATE SET
       t.degree_course_name    = s.prg_name,
       t.duration_years        = s.duration,
       t.university_faculty_no = s.faculty_no,
       t.is_active             = 1,
       t.modified_by           = 'seed_elphinstone_programs',
       t.modified_on           = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (college_id, degree_course_code, degree_course_name, duration_years,
            university_faculty_no, is_active, created_by)
    VALUES (@college_id, s.prg_code, s.prg_name, s.duration,
            s.faculty_no, 1, 'seed_elphinstone_programs');

SELECT code_no, degree_course_code, degree_course_name, duration_years,
       university_faculty_no, is_active
FROM faculty_master
WHERE college_id = @college_id
ORDER BY university_faculty_no, degree_course_code;
GO
