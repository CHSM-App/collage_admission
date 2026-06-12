  -- ============================================================
  -- create_audit_triggers.sql
  -- Run this as sa / db_owner in SSMS on the target database.
  -- Creates AFTER INSERT / UPDATE / DELETE triggers on all
  -- audited tables. Each trigger copies the changed row into
  -- the matching $Arc table.
  --
  -- Safe to re-run — drops existing trigger before recreating.
  -- ============================================================

  USE college_db;
  GO

  -- ============================================================
  -- admission_periods
  -- ============================================================
  IF OBJECT_ID('dbo.trg_admission_periods_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_admission_periods_arc_ins;
GO
  CREATE TRIGGER trg_admission_periods_arc_ins ON admission_periods AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [admission_periods$Arc] (id,college_id,course_id,year_of_study,academic_year,start_date,end_date,total_seats,filled_seats,is_active,is_disabled,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.course_id,i.year_of_study,i.academic_year,i.start_date,i.end_date,i.total_seats,i.filled_seats,i.is_active,i.is_disabled,i.created_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_admission_periods_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_admission_periods_arc_upd;
GO
  CREATE TRIGGER trg_admission_periods_arc_upd ON admission_periods AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [admission_periods$Arc] (id,college_id,course_id,year_of_study,academic_year,start_date,end_date,total_seats,filled_seats,is_active,is_disabled,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.course_id,i.year_of_study,i.academic_year,i.start_date,i.end_date,i.total_seats,i.filled_seats,i.is_active,i.is_disabled,i.created_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_admission_periods_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_admission_periods_arc_del;
GO
  CREATE TRIGGER trg_admission_periods_arc_del ON admission_periods AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [admission_periods$Arc] (id,college_id,course_id,year_of_study,academic_year,start_date,end_date,total_seats,filled_seats,is_active,is_disabled,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.college_id,d.course_id,d.year_of_study,d.academic_year,d.start_date,d.end_date,d.total_seats,d.filled_seats,d.is_active,d.is_disabled,d.created_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- admins
  -- ============================================================
  IF OBJECT_ID('dbo.trg_admins_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_admins_arc_ins;
GO
  CREATE TRIGGER trg_admins_arc_ins ON admins AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [admins$Arc] (id,name,email,password_hash,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.name,i.email,i.password_hash,i.created_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_admins_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_admins_arc_upd;
GO
  CREATE TRIGGER trg_admins_arc_upd ON admins AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [admins$Arc] (id,name,email,password_hash,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.name,i.email,i.password_hash,i.created_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_admins_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_admins_arc_del;
GO
  CREATE TRIGGER trg_admins_arc_del ON admins AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [admins$Arc] (id,name,email,password_hash,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.name,d.email,d.password_hash,d.created_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- colleges
  -- ============================================================
  IF OBJECT_ID('dbo.trg_colleges_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_colleges_arc_ins;
GO
  CREATE TRIGGER trg_colleges_arc_ins ON colleges AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [colleges$Arc] (id,name,address,city,phone,email,admin_email,admin_password_hash,college_code,application_fee,bank_account_name,bank_account_number,bank_ifsc,bank_upi_id,is_enabled,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.name,i.address,i.city,i.phone,i.email,i.admin_email,i.admin_password_hash,i.college_code,i.application_fee,i.bank_account_name,i.bank_account_number,i.bank_ifsc,i.bank_upi_id,i.is_enabled,i.created_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_colleges_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_colleges_arc_upd;
GO
  CREATE TRIGGER trg_colleges_arc_upd ON colleges AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [colleges$Arc] (id,name,address,city,phone,email,admin_email,admin_password_hash,college_code,application_fee,bank_account_name,bank_account_number,bank_ifsc,bank_upi_id,is_enabled,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.name,i.address,i.city,i.phone,i.email,i.admin_email,i.admin_password_hash,i.college_code,i.application_fee,i.bank_account_name,i.bank_account_number,i.bank_ifsc,i.bank_upi_id,i.is_enabled,i.created_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_colleges_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_colleges_arc_del;
GO
  CREATE TRIGGER trg_colleges_arc_del ON colleges AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [colleges$Arc] (id,name,address,city,phone,email,admin_email,admin_password_hash,college_code,application_fee,bank_account_name,bank_account_number,bank_ifsc,bank_upi_id,is_enabled,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.name,d.address,d.city,d.phone,d.email,d.admin_email,d.admin_password_hash,d.college_code,d.application_fee,d.bank_account_name,d.bank_account_number,d.bank_ifsc,d.bank_upi_id,d.is_enabled,d.created_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- college_roles
  -- ============================================================
  IF OBJECT_ID('dbo.trg_college_roles_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_roles_arc_ins;
GO
  CREATE TRIGGER trg_college_roles_arc_ins ON college_roles AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_roles$Arc] (id,college_id,role_name,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.role_name,i.created_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_college_roles_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_roles_arc_upd;
GO
  CREATE TRIGGER trg_college_roles_arc_upd ON college_roles AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_roles$Arc] (id,college_id,role_name,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.role_name,i.created_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_college_roles_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_roles_arc_del;
GO
  CREATE TRIGGER trg_college_roles_arc_del ON college_roles AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_roles$Arc] (id,college_id,role_name,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.college_id,d.role_name,d.created_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- college_role_permissions
  -- ============================================================
  IF OBJECT_ID('dbo.trg_college_role_permissions_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_role_permissions_arc_ins;
GO
  CREATE TRIGGER trg_college_role_permissions_arc_ins ON college_role_permissions AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_role_permissions$Arc] (id,role_id,permission,can_write,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.role_id,i.permission,i.can_write,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_college_role_permissions_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_role_permissions_arc_upd;
GO
  CREATE TRIGGER trg_college_role_permissions_arc_upd ON college_role_permissions AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_role_permissions$Arc] (id,role_id,permission,can_write,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.role_id,i.permission,i.can_write,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_college_role_permissions_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_role_permissions_arc_del;
GO
  CREATE TRIGGER trg_college_role_permissions_arc_del ON college_role_permissions AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_role_permissions$Arc] (id,role_id,permission,can_write,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.role_id,d.permission,d.can_write,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- college_users
  -- ============================================================
  IF OBJECT_ID('dbo.trg_college_users_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_users_arc_ins;
GO
  CREATE TRIGGER trg_college_users_arc_ins ON college_users AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_users$Arc] (id,college_id,role_id,full_name,email,password_hash,is_active,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.role_id,i.full_name,i.email,i.password_hash,i.is_active,i.created_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_college_users_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_users_arc_upd;
GO
  CREATE TRIGGER trg_college_users_arc_upd ON college_users AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_users$Arc] (id,college_id,role_id,full_name,email,password_hash,is_active,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.role_id,i.full_name,i.email,i.password_hash,i.is_active,i.created_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_college_users_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_users_arc_del;
GO
  CREATE TRIGGER trg_college_users_arc_del ON college_users AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_users$Arc] (id,college_id,role_id,full_name,email,password_hash,is_active,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.college_id,d.role_id,d.full_name,d.email,d.password_hash,d.is_active,d.created_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- students
  -- ============================================================
  IF OBJECT_ID('dbo.trg_students_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_students_arc_ins;
GO
  CREATE TRIGGER trg_students_arc_ins ON students AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [students$Arc] (id,full_name,email,password_hash,phone,dob,gender,address,city,aadhaar_number,category,prn,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.full_name,i.email,i.password_hash,i.phone,i.dob,i.gender,i.address,i.city,i.aadhaar_number,i.category,i.prn,i.created_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_students_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_students_arc_upd;
GO
  CREATE TRIGGER trg_students_arc_upd ON students AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [students$Arc] (id,full_name,email,password_hash,phone,dob,gender,address,city,aadhaar_number,category,prn,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.full_name,i.email,i.password_hash,i.phone,i.dob,i.gender,i.address,i.city,i.aadhaar_number,i.category,i.prn,i.created_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_students_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_students_arc_del;
GO
  CREATE TRIGGER trg_students_arc_del ON students AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [students$Arc] (id,full_name,email,password_hash,phone,dob,gender,address,city,aadhaar_number,category,prn,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.full_name,d.email,d.password_hash,d.phone,d.dob,d.gender,d.address,d.city,d.aadhaar_number,d.category,d.prn,d.created_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- applications
  -- ============================================================
  IF OBJECT_ID('dbo.trg_applications_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_applications_arc_ins;
GO
  CREATE TRIGGER trg_applications_arc_ins ON applications AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [applications$Arc] (id,registration_number,student_id,college_id,course_id,year_of_study,academic_year,admission_period_id,status,correction_note,rejection_reason,cancellation_reason,fee_total_amount,fee_pay_now_amount,roll_number,application_fee_paid,college_fee_paid,current_step,app_surname,app_first_name,app_middle_name,app_mother_name,app_sex,app_mobile,app_email,app_address,app_taluka,app_district,app_state,app_category,app_special_status,fees_category,fees_category_override,fees_category_override_remark,app_division,app_degree_course_code,app_birth_date,app_birth_place,app_birth_taluka,app_birth_district,app_birth_state,app_nationality,app_marital_status,app_religion,app_caste,app_mother_tongue,app_height_cm,app_weight_kg,app_blood_group,app_father_full_name,app_son_daughter_no,app_father_occupation,app_annual_income,app_aadhaar,app_prn,app_abc_id,app_university_app_no,app_bank_account,app_bank_ifsc,app_bank_name,app_bank_branch,declaration_accepted_at,submitted_at,approved_at,confirmed_at,enrolled_at,status_updated_at,created_at,updated_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.registration_number,i.student_id,i.college_id,i.course_id,i.year_of_study,i.academic_year,i.admission_period_id,i.status,i.correction_note,i.rejection_reason,i.cancellation_reason,i.fee_total_amount,i.fee_pay_now_amount,i.roll_number,i.application_fee_paid,i.college_fee_paid,i.current_step,i.app_surname,i.app_first_name,i.app_middle_name,i.app_mother_name,i.app_sex,i.app_mobile,i.app_email,i.app_address,i.app_taluka,i.app_district,i.app_state,i.app_category,i.app_special_status,i.fees_category,i.fees_category_override,i.fees_category_override_remark,i.app_division,i.app_degree_course_code,i.app_birth_date,i.app_birth_place,i.app_birth_taluka,i.app_birth_district,i.app_birth_state,i.app_nationality,i.app_marital_status,i.app_religion,i.app_caste,i.app_mother_tongue,i.app_height_cm,i.app_weight_kg,i.app_blood_group,i.app_father_full_name,i.app_son_daughter_no,i.app_father_occupation,i.app_annual_income,i.app_aadhaar,i.app_prn,i.app_abc_id,i.app_university_app_no,i.app_bank_account,i.app_bank_ifsc,i.app_bank_name,i.app_bank_branch,i.declaration_accepted_at,i.submitted_at,i.approved_at,i.confirmed_at,i.enrolled_at,i.status_updated_at,i.created_at,i.updated_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_applications_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_applications_arc_upd;
GO
  CREATE TRIGGER trg_applications_arc_upd ON applications AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [applications$Arc] (id,registration_number,student_id,college_id,course_id,year_of_study,academic_year,admission_period_id,status,correction_note,rejection_reason,cancellation_reason,fee_total_amount,fee_pay_now_amount,roll_number,application_fee_paid,college_fee_paid,current_step,app_surname,app_first_name,app_middle_name,app_mother_name,app_sex,app_mobile,app_email,app_address,app_taluka,app_district,app_state,app_category,app_special_status,fees_category,fees_category_override,fees_category_override_remark,app_division,app_degree_course_code,app_birth_date,app_birth_place,app_birth_taluka,app_birth_district,app_birth_state,app_nationality,app_marital_status,app_religion,app_caste,app_mother_tongue,app_height_cm,app_weight_kg,app_blood_group,app_father_full_name,app_son_daughter_no,app_father_occupation,app_annual_income,app_aadhaar,app_prn,app_abc_id,app_university_app_no,app_bank_account,app_bank_ifsc,app_bank_name,app_bank_branch,declaration_accepted_at,submitted_at,approved_at,confirmed_at,enrolled_at,status_updated_at,created_at,updated_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.registration_number,i.student_id,i.college_id,i.course_id,i.year_of_study,i.academic_year,i.admission_period_id,i.status,i.correction_note,i.rejection_reason,i.cancellation_reason,i.fee_total_amount,i.fee_pay_now_amount,i.roll_number,i.application_fee_paid,i.college_fee_paid,i.current_step,i.app_surname,i.app_first_name,i.app_middle_name,i.app_mother_name,i.app_sex,i.app_mobile,i.app_email,i.app_address,i.app_taluka,i.app_district,i.app_state,i.app_category,i.app_special_status,i.fees_category,i.fees_category_override,i.fees_category_override_remark,i.app_division,i.app_degree_course_code,i.app_birth_date,i.app_birth_place,i.app_birth_taluka,i.app_birth_district,i.app_birth_state,i.app_nationality,i.app_marital_status,i.app_religion,i.app_caste,i.app_mother_tongue,i.app_height_cm,i.app_weight_kg,i.app_blood_group,i.app_father_full_name,i.app_son_daughter_no,i.app_father_occupation,i.app_annual_income,i.app_aadhaar,i.app_prn,i.app_abc_id,i.app_university_app_no,i.app_bank_account,i.app_bank_ifsc,i.app_bank_name,i.app_bank_branch,i.declaration_accepted_at,i.submitted_at,i.approved_at,i.confirmed_at,i.enrolled_at,i.status_updated_at,i.created_at,i.updated_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_applications_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_applications_arc_del;
GO
  CREATE TRIGGER trg_applications_arc_del ON applications AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [applications$Arc] (id,registration_number,student_id,college_id,course_id,year_of_study,academic_year,admission_period_id,status,correction_note,rejection_reason,cancellation_reason,fee_total_amount,fee_pay_now_amount,roll_number,application_fee_paid,college_fee_paid,current_step,app_surname,app_first_name,app_middle_name,app_mother_name,app_sex,app_mobile,app_email,app_address,app_taluka,app_district,app_state,app_category,app_special_status,fees_category,fees_category_override,fees_category_override_remark,app_division,app_degree_course_code,app_birth_date,app_birth_place,app_birth_taluka,app_birth_district,app_birth_state,app_nationality,app_marital_status,app_religion,app_caste,app_mother_tongue,app_height_cm,app_weight_kg,app_blood_group,app_father_full_name,app_son_daughter_no,app_father_occupation,app_annual_income,app_aadhaar,app_prn,app_abc_id,app_university_app_no,app_bank_account,app_bank_ifsc,app_bank_name,app_bank_branch,declaration_accepted_at,submitted_at,approved_at,confirmed_at,enrolled_at,status_updated_at,created_at,updated_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.registration_number,d.student_id,d.college_id,d.course_id,d.year_of_study,d.academic_year,d.admission_period_id,d.status,d.correction_note,d.rejection_reason,d.cancellation_reason,d.fee_total_amount,d.fee_pay_now_amount,d.roll_number,d.application_fee_paid,d.college_fee_paid,d.current_step,d.app_surname,d.app_first_name,d.app_middle_name,d.app_mother_name,d.app_sex,d.app_mobile,d.app_email,d.app_address,d.app_taluka,d.app_district,d.app_state,d.app_category,d.app_special_status,d.fees_category,d.fees_category_override,d.fees_category_override_remark,d.app_division,d.app_degree_course_code,d.app_birth_date,d.app_birth_place,d.app_birth_taluka,d.app_birth_district,d.app_birth_state,d.app_nationality,d.app_marital_status,d.app_religion,d.app_caste,d.app_mother_tongue,d.app_height_cm,d.app_weight_kg,d.app_blood_group,d.app_father_full_name,d.app_son_daughter_no,d.app_father_occupation,d.app_annual_income,d.app_aadhaar,d.app_prn,d.app_abc_id,d.app_university_app_no,d.app_bank_account,d.app_bank_ifsc,d.app_bank_name,d.app_bank_branch,d.declaration_accepted_at,d.submitted_at,d.approved_at,d.confirmed_at,d.enrolled_at,d.status_updated_at,d.created_at,d.updated_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- payments
  -- ============================================================
  IF OBJECT_ID('dbo.trg_payments_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_payments_arc_ins;
GO
  CREATE TRIGGER trg_payments_arc_ins ON payments AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [payments$Arc] (id,application_id,payment_type,amount,razorpay_order_id,razorpay_payment_id,status,paid_by,paid_by_user_id,attempted_at,completed_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.application_id,i.payment_type,i.amount,i.razorpay_order_id,i.razorpay_payment_id,i.status,i.paid_by,i.paid_by_user_id,i.attempted_at,i.completed_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_payments_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_payments_arc_upd;
GO
  CREATE TRIGGER trg_payments_arc_upd ON payments AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [payments$Arc] (id,application_id,payment_type,amount,razorpay_order_id,razorpay_payment_id,status,paid_by,paid_by_user_id,attempted_at,completed_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.application_id,i.payment_type,i.amount,i.razorpay_order_id,i.razorpay_payment_id,i.status,i.paid_by,i.paid_by_user_id,i.attempted_at,i.completed_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_payments_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_payments_arc_del;
GO
  CREATE TRIGGER trg_payments_arc_del ON payments AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [payments$Arc] (id,application_id,payment_type,amount,razorpay_order_id,razorpay_payment_id,status,paid_by,paid_by_user_id,attempted_at,completed_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.application_id,d.payment_type,d.amount,d.razorpay_order_id,d.razorpay_payment_id,d.status,d.paid_by,d.paid_by_user_id,d.attempted_at,d.completed_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- fees_master
  -- ============================================================
  IF OBJECT_ID('dbo.trg_fees_master_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_fees_master_arc_ins;
GO
  CREATE TRIGGER trg_fees_master_arc_ins ON fees_master AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [fees_master$Arc] (fees_code,college_id,fees_type,is_other_misc,fees_head,short_name,sequence_auto_fees,credit_to_bank_ledger,is_refundable,fees_cat1_amount,fees_cat2_amount,fees_cat3_amount,fees_cat4_amount,cat4_description,is_active,modified_on,academic_year,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.fees_code,i.college_id,i.fees_type,i.is_other_misc,i.fees_head,i.short_name,i.sequence_auto_fees,i.credit_to_bank_ledger,i.is_refundable,i.fees_cat1_amount,i.fees_cat2_amount,i.fees_cat3_amount,i.fees_cat4_amount,i.cat4_description,i.is_active,i.modified_on,i.academic_year,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_fees_master_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_fees_master_arc_upd;
GO
  CREATE TRIGGER trg_fees_master_arc_upd ON fees_master AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [fees_master$Arc] (fees_code,college_id,fees_type,is_other_misc,fees_head,short_name,sequence_auto_fees,credit_to_bank_ledger,is_refundable,fees_cat1_amount,fees_cat2_amount,fees_cat3_amount,fees_cat4_amount,cat4_description,is_active,modified_on,academic_year,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.fees_code,i.college_id,i.fees_type,i.is_other_misc,i.fees_head,i.short_name,i.sequence_auto_fees,i.credit_to_bank_ledger,i.is_refundable,i.fees_cat1_amount,i.fees_cat2_amount,i.fees_cat3_amount,i.fees_cat4_amount,i.cat4_description,i.is_active,i.modified_on,i.academic_year,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_fees_master_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_fees_master_arc_del;
GO
  CREATE TRIGGER trg_fees_master_arc_del ON fees_master AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [fees_master$Arc] (fees_code,college_id,fees_type,is_other_misc,fees_head,short_name,sequence_auto_fees,credit_to_bank_ledger,is_refundable,fees_cat1_amount,fees_cat2_amount,fees_cat3_amount,fees_cat4_amount,cat4_description,is_active,modified_on,academic_year,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.fees_code,d.college_id,d.fees_type,d.is_other_misc,d.fees_head,d.short_name,d.sequence_auto_fees,d.credit_to_bank_ledger,d.is_refundable,d.fees_cat1_amount,d.fees_cat2_amount,d.fees_cat3_amount,d.fees_cat4_amount,d.cat4_description,d.is_active,d.modified_on,d.academic_year,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- classwise_fees
  -- ============================================================
  IF OBJECT_ID('dbo.trg_classwise_fees_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_classwise_fees_arc_ins;
GO
  CREATE TRIGGER trg_classwise_fees_arc_ins ON classwise_fees AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [classwise_fees$Arc] (id,college_id,faculty_master_id,year_level,fees_code,academic_year,cat1_amount,cat2_amount,cat3_amount,cat4_amount,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.year_level,i.fees_code,i.academic_year,i.cat1_amount,i.cat2_amount,i.cat3_amount,i.cat4_amount,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_classwise_fees_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_classwise_fees_arc_upd;
GO
  CREATE TRIGGER trg_classwise_fees_arc_upd ON classwise_fees AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [classwise_fees$Arc] (id,college_id,faculty_master_id,year_level,fees_code,academic_year,cat1_amount,cat2_amount,cat3_amount,cat4_amount,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.year_level,i.fees_code,i.academic_year,i.cat1_amount,i.cat2_amount,i.cat3_amount,i.cat4_amount,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_classwise_fees_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_classwise_fees_arc_del;
GO
  CREATE TRIGGER trg_classwise_fees_arc_del ON classwise_fees AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [classwise_fees$Arc] (id,college_id,faculty_master_id,year_level,fees_code,academic_year,cat1_amount,cat2_amount,cat3_amount,cat4_amount,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.college_id,d.faculty_master_id,d.year_level,d.fees_code,d.academic_year,d.cat1_amount,d.cat2_amount,d.cat3_amount,d.cat4_amount,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- faculty_master
  -- ============================================================
  IF OBJECT_ID('dbo.trg_faculty_master_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_faculty_master_arc_ins;
GO
  CREATE TRIGGER trg_faculty_master_arc_ins ON faculty_master AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [faculty_master$Arc] (code_no,college_id,degree_course_code,degree_course_name,duration_years,unique_code_sem1,unique_code_sem2,unique_code_sem3,unique_code_sem4,unique_code_sem5,unique_code_sem6,unique_code_sem7,unique_code_sem8,unique_code_sem9,unique_code_sem10,exam_seat_code_year1,exam_seat_code_year2,exam_seat_code_year3,exam_seat_code_year4,exam_seat_code_year5,is_active,created_by,modified_by,modified_on,created_at,action_type,action_by,machine_mac_address,comments)
    SELECT i.code_no,i.college_id,i.degree_course_code,i.degree_course_name,i.duration_years,i.unique_code_sem1,i.unique_code_sem2,i.unique_code_sem3,i.unique_code_sem4,i.unique_code_sem5,i.unique_code_sem6,i.unique_code_sem7,i.unique_code_sem8,i.unique_code_sem9,i.unique_code_sem10,i.exam_seat_code_year1,i.exam_seat_code_year2,i.exam_seat_code_year3,i.exam_seat_code_year4,i.exam_seat_code_year5,i.is_active,i.created_by,i.modified_by,i.modified_on,i.created_at,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_faculty_master_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_faculty_master_arc_upd;
GO
  CREATE TRIGGER trg_faculty_master_arc_upd ON faculty_master AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [faculty_master$Arc] (code_no,college_id,degree_course_code,degree_course_name,duration_years,unique_code_sem1,unique_code_sem2,unique_code_sem3,unique_code_sem4,unique_code_sem5,unique_code_sem6,unique_code_sem7,unique_code_sem8,unique_code_sem9,unique_code_sem10,exam_seat_code_year1,exam_seat_code_year2,exam_seat_code_year3,exam_seat_code_year4,exam_seat_code_year5,is_active,created_by,modified_by,modified_on,created_at,action_type,action_by,machine_mac_address,comments)
    SELECT i.code_no,i.college_id,i.degree_course_code,i.degree_course_name,i.duration_years,i.unique_code_sem1,i.unique_code_sem2,i.unique_code_sem3,i.unique_code_sem4,i.unique_code_sem5,i.unique_code_sem6,i.unique_code_sem7,i.unique_code_sem8,i.unique_code_sem9,i.unique_code_sem10,i.exam_seat_code_year1,i.exam_seat_code_year2,i.exam_seat_code_year3,i.exam_seat_code_year4,i.exam_seat_code_year5,i.is_active,i.created_by,i.modified_by,i.modified_on,i.created_at,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.modified_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_faculty_master_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_faculty_master_arc_del;
GO
  CREATE TRIGGER trg_faculty_master_arc_del ON faculty_master AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [faculty_master$Arc] (code_no,college_id,degree_course_code,degree_course_name,duration_years,unique_code_sem1,unique_code_sem2,unique_code_sem3,unique_code_sem4,unique_code_sem5,unique_code_sem6,unique_code_sem7,unique_code_sem8,unique_code_sem9,unique_code_sem10,exam_seat_code_year1,exam_seat_code_year2,exam_seat_code_year3,exam_seat_code_year4,exam_seat_code_year5,is_active,created_by,modified_by,modified_on,created_at,action_type,action_by,machine_mac_address,comments)
    SELECT d.code_no,d.college_id,d.degree_course_code,d.degree_course_name,d.duration_years,d.unique_code_sem1,d.unique_code_sem2,d.unique_code_sem3,d.unique_code_sem4,d.unique_code_sem5,d.unique_code_sem6,d.unique_code_sem7,d.unique_code_sem8,d.unique_code_sem9,d.unique_code_sem10,d.exam_seat_code_year1,d.exam_seat_code_year2,d.exam_seat_code_year3,d.exam_seat_code_year4,d.exam_seat_code_year5,d.is_active,d.created_by,d.modified_by,d.modified_on,d.created_at,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.modified_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- application_documents
  -- ============================================================
  IF OBJECT_ID('dbo.trg_application_documents_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_application_documents_arc_ins;
GO
  CREATE TRIGGER trg_application_documents_arc_ins ON application_documents AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [application_documents$Arc] (id,application_id,student_document_id,document_type_id,is_verified,verified_at,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.application_id,i.student_document_id,i.document_type_id,i.is_verified,i.verified_at,i.created_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_application_documents_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_application_documents_arc_upd;
GO
  CREATE TRIGGER trg_application_documents_arc_upd ON application_documents AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [application_documents$Arc] (id,application_id,student_document_id,document_type_id,is_verified,verified_at,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.application_id,i.student_document_id,i.document_type_id,i.is_verified,i.verified_at,i.created_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_application_documents_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_application_documents_arc_del;
GO
  CREATE TRIGGER trg_application_documents_arc_del ON application_documents AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [application_documents$Arc] (id,application_id,student_document_id,document_type_id,is_verified,verified_at,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.application_id,d.student_document_id,d.document_type_id,d.is_verified,d.verified_at,d.created_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- certificate_bonafide
  -- ============================================================
  IF OBJECT_ID('dbo.trg_certificate_bonafide_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_bonafide_arc_ins;
GO
  CREATE TRIGGER trg_certificate_bonafide_arc_ins ON certificate_bonafide AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_bonafide$Arc] (bonafide_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,academic_year,birth_date,roll_no,caste,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT i.bonafide_id,i.college_id,i.certificate_no,i.certificate_date,i.reg_no,i.student_name,i.gender,i.is_ex_student,i.class_name,i.academic_year,i.birth_date,i.roll_no,i.caste,i.created_by,i.created_date,i.updated_by,i.updated_date,i.is_deleted,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(CAST(i.created_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_certificate_bonafide_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_bonafide_arc_upd;
GO
  CREATE TRIGGER trg_certificate_bonafide_arc_upd ON certificate_bonafide AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_bonafide$Arc] (bonafide_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,academic_year,birth_date,roll_no,caste,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT i.bonafide_id,i.college_id,i.certificate_no,i.certificate_date,i.reg_no,i.student_name,i.gender,i.is_ex_student,i.class_name,i.academic_year,i.birth_date,i.roll_no,i.caste,i.created_by,i.created_date,i.updated_by,i.updated_date,i.is_deleted,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(CAST(i.updated_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_certificate_bonafide_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_bonafide_arc_del;
GO
  CREATE TRIGGER trg_certificate_bonafide_arc_del ON certificate_bonafide AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_bonafide$Arc] (bonafide_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,academic_year,birth_date,roll_no,caste,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT d.bonafide_id,d.college_id,d.certificate_no,d.certificate_date,d.reg_no,d.student_name,d.gender,d.is_ex_student,d.class_name,d.academic_year,d.birth_date,d.roll_no,d.caste,d.created_by,d.created_date,d.updated_by,d.updated_date,d.is_deleted,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(CAST(d.updated_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- certificate_character
  -- ============================================================
  IF OBJECT_ID('dbo.trg_certificate_character_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_character_arc_ins;
GO
  CREATE TRIGGER trg_certificate_character_arc_ins ON certificate_character AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_character$Arc] (character_certificate_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,academic_year,known_from_years,birth_date,roll_no,caste,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT i.character_certificate_id,i.college_id,i.certificate_no,i.certificate_date,i.reg_no,i.student_name,i.gender,i.is_ex_student,i.class_name,i.academic_year,i.known_from_years,i.birth_date,i.roll_no,i.caste,i.created_by,i.created_date,i.updated_by,i.updated_date,i.is_deleted,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(CAST(i.created_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_certificate_character_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_character_arc_upd;
GO
  CREATE TRIGGER trg_certificate_character_arc_upd ON certificate_character AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_character$Arc] (character_certificate_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,academic_year,known_from_years,birth_date,roll_no,caste,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT i.character_certificate_id,i.college_id,i.certificate_no,i.certificate_date,i.reg_no,i.student_name,i.gender,i.is_ex_student,i.class_name,i.academic_year,i.known_from_years,i.birth_date,i.roll_no,i.caste,i.created_by,i.created_date,i.updated_by,i.updated_date,i.is_deleted,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(CAST(i.updated_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_certificate_character_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_character_arc_del;
GO
  CREATE TRIGGER trg_certificate_character_arc_del ON certificate_character AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_character$Arc] (character_certificate_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,academic_year,known_from_years,birth_date,roll_no,caste,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT d.character_certificate_id,d.college_id,d.certificate_no,d.certificate_date,d.reg_no,d.student_name,d.gender,d.is_ex_student,d.class_name,d.academic_year,d.known_from_years,d.birth_date,d.roll_no,d.caste,d.created_by,d.created_date,d.updated_by,d.updated_date,d.is_deleted,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(CAST(d.updated_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- certificate_noc
  -- ============================================================
  IF OBJECT_ID('dbo.trg_certificate_noc_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_noc_arc_ins;
GO
  CREATE TRIGGER trg_certificate_noc_arc_ins ON certificate_noc AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_noc$Arc] (noc_certificate_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,from_date,to_date,prn_no,final_confirmation_no,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT i.noc_certificate_id,i.college_id,i.certificate_no,i.certificate_date,i.reg_no,i.student_name,i.gender,i.is_ex_student,i.class_name,i.from_date,i.to_date,i.prn_no,i.final_confirmation_no,i.created_by,i.created_date,i.updated_by,i.updated_date,i.is_deleted,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(CAST(i.created_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_certificate_noc_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_noc_arc_upd;
GO
  CREATE TRIGGER trg_certificate_noc_arc_upd ON certificate_noc AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_noc$Arc] (noc_certificate_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,from_date,to_date,prn_no,final_confirmation_no,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT i.noc_certificate_id,i.college_id,i.certificate_no,i.certificate_date,i.reg_no,i.student_name,i.gender,i.is_ex_student,i.class_name,i.from_date,i.to_date,i.prn_no,i.final_confirmation_no,i.created_by,i.created_date,i.updated_by,i.updated_date,i.is_deleted,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(CAST(i.updated_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_certificate_noc_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_certificate_noc_arc_del;
GO
  CREATE TRIGGER trg_certificate_noc_arc_del ON certificate_noc AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [certificate_noc$Arc] (noc_certificate_id,college_id,certificate_no,certificate_date,reg_no,student_name,gender,is_ex_student,class_name,from_date,to_date,prn_no,final_confirmation_no,created_by,created_date,updated_by,updated_date,is_deleted,action_type,action_by,machine_mac_address,comments)
    SELECT d.noc_certificate_id,d.college_id,d.certificate_no,d.certificate_date,d.reg_no,d.student_name,d.gender,d.is_ex_student,d.class_name,d.from_date,d.to_date,d.prn_no,d.final_confirmation_no,d.created_by,d.created_date,d.updated_by,d.updated_date,d.is_deleted,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(CAST(d.updated_by AS NVARCHAR(150)),SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- bank_master
  -- ============================================================
  IF OBJECT_ID('dbo.trg_bank_master_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_bank_master_arc_ins;
GO
  CREATE TRIGGER trg_bank_master_arc_ins ON bank_master AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [bank_master$Arc] (ledger_code,college_id,bank_account_number,bank_name,branch,ifsc_code,account_type,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.ledger_code,i.college_id,i.bank_account_number,i.bank_name,i.branch,i.ifsc_code,i.account_type,i.is_active,i.modified_on,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_bank_master_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_bank_master_arc_upd;
GO
  CREATE TRIGGER trg_bank_master_arc_upd ON bank_master AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [bank_master$Arc] (ledger_code,college_id,bank_account_number,bank_name,branch,ifsc_code,account_type,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.ledger_code,i.college_id,i.bank_account_number,i.bank_name,i.branch,i.ifsc_code,i.account_type,i.is_active,i.modified_on,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_bank_master_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_bank_master_arc_del;
GO
  CREATE TRIGGER trg_bank_master_arc_del ON bank_master AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [bank_master$Arc] (ledger_code,college_id,bank_account_number,bank_name,branch,ifsc_code,account_type,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.ledger_code,d.college_id,d.bank_account_number,d.bank_name,d.branch,d.ifsc_code,d.account_type,d.is_active,d.modified_on,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- course_master
  -- ============================================================
  IF OBJECT_ID('dbo.trg_course_master_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_course_master_arc_ins;
GO
  CREATE TRIGGER trg_course_master_arc_ins ON course_master AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [course_master$Arc] (id,college_id,faculty_master_id,semester,course_code,course_title,credits,max_internal,min_internal,max_sem_end,min_sem_end,max_total,min_total,subject_type,display_order,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.semester,i.course_code,i.course_title,i.credits,i.max_internal,i.min_internal,i.max_sem_end,i.min_sem_end,i.max_total,i.min_total,i.subject_type,i.display_order,i.is_active,i.modified_on,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_course_master_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_course_master_arc_upd;
GO
  CREATE TRIGGER trg_course_master_arc_upd ON course_master AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [course_master$Arc] (id,college_id,faculty_master_id,semester,course_code,course_title,credits,max_internal,min_internal,max_sem_end,min_sem_end,max_total,min_total,subject_type,display_order,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.semester,i.course_code,i.course_title,i.credits,i.max_internal,i.min_internal,i.max_sem_end,i.min_sem_end,i.max_total,i.min_total,i.subject_type,i.display_order,i.is_active,i.modified_on,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_course_master_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_course_master_arc_del;
GO
  CREATE TRIGGER trg_course_master_arc_del ON course_master AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [course_master$Arc] (id,college_id,faculty_master_id,semester,course_code,course_title,credits,max_internal,min_internal,max_sem_end,min_sem_end,max_total,min_total,subject_type,display_order,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.college_id,d.faculty_master_id,d.semester,d.course_code,d.course_title,d.credits,d.max_internal,d.min_internal,d.max_sem_end,d.min_sem_end,d.max_total,d.min_total,d.subject_type,d.display_order,d.is_active,d.modified_on,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- division_master
  -- ============================================================
  IF OBJECT_ID('dbo.trg_division_master_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_division_master_arc_ins;
GO
  CREATE TRIGGER trg_division_master_arc_ins ON division_master AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [division_master$Arc] (id,college_id,faculty_master_id,year_level,class_year_code,division_letter,funding_type,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.year_level,i.class_year_code,i.division_letter,i.funding_type,i.is_active,i.modified_on,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_division_master_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_division_master_arc_upd;
GO
  CREATE TRIGGER trg_division_master_arc_upd ON division_master AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [division_master$Arc] (id,college_id,faculty_master_id,year_level,class_year_code,division_letter,funding_type,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.year_level,i.class_year_code,i.division_letter,i.funding_type,i.is_active,i.modified_on,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_division_master_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_division_master_arc_del;
GO
  CREATE TRIGGER trg_division_master_arc_del ON division_master AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [division_master$Arc] (id,college_id,faculty_master_id,year_level,class_year_code,division_letter,funding_type,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.college_id,d.faculty_master_id,d.year_level,d.class_year_code,d.division_letter,d.funding_type,d.is_active,d.modified_on,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- group_master
  -- ============================================================
  IF OBJECT_ID('dbo.trg_group_master_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_group_master_arc_ins;
GO
  CREATE TRIGGER trg_group_master_arc_ins ON group_master AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [group_master$Arc] (id,college_id,faculty_master_id,semester,group_code,group_description,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.semester,i.group_code,i.group_description,i.is_active,i.modified_on,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_group_master_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_group_master_arc_upd;
GO
  CREATE TRIGGER trg_group_master_arc_upd ON group_master AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [group_master$Arc] (id,college_id,faculty_master_id,semester,group_code,group_description,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.semester,i.group_code,i.group_description,i.is_active,i.modified_on,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_group_master_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_group_master_arc_del;
GO
  CREATE TRIGGER trg_group_master_arc_del ON group_master AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [group_master$Arc] (id,college_id,faculty_master_id,semester,group_code,group_description,is_active,modified_on,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.college_id,d.faculty_master_id,d.semester,d.group_code,d.group_description,d.is_active,d.modified_on,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- document_types
  -- ============================================================
  IF OBJECT_ID('dbo.trg_document_types_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_document_types_arc_ins;
GO
  CREATE TRIGGER trg_document_types_arc_ins ON document_types AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [document_types$Arc] (id,name,description,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.name,i.description,i.created_at,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_document_types_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_document_types_arc_upd;
GO
  CREATE TRIGGER trg_document_types_arc_upd ON document_types AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [document_types$Arc] (id,name,description,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.name,i.description,i.created_at,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_document_types_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_document_types_arc_del;
GO
  CREATE TRIGGER trg_document_types_arc_del ON document_types AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [document_types$Arc] (id,name,description,created_at,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.name,d.description,d.created_at,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  -- ============================================================
  -- college_required_documents
  -- ============================================================
  IF OBJECT_ID('dbo.trg_college_required_documents_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_required_documents_arc_ins;
GO
  CREATE TRIGGER trg_college_required_documents_arc_ins ON college_required_documents AFTER INSERT AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_required_documents$Arc] (id,college_id,faculty_master_id,year_of_study,document_type_id,is_mandatory,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.year_of_study,i.document_type_id,i.is_mandatory,i.created_by,i.updated_by,
    'INSERT',CONVERT(NVARCHAR(150),COALESCE(i.created_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_college_required_documents_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_required_documents_arc_upd;
GO
  CREATE TRIGGER trg_college_required_documents_arc_upd ON college_required_documents AFTER UPDATE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_required_documents$Arc] (id,college_id,faculty_master_id,year_of_study,document_type_id,is_mandatory,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT i.id,i.college_id,i.faculty_master_id,i.year_of_study,i.document_type_id,i.is_mandatory,i.created_by,i.updated_by,
    'UPDATE',CONVERT(NVARCHAR(150),COALESCE(i.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY BEGIN CATCH END CATCH END
  GO
  IF OBJECT_ID('dbo.trg_college_required_documents_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_college_required_documents_arc_del;
GO
  CREATE TRIGGER trg_college_required_documents_arc_del ON college_required_documents AFTER DELETE AS
  BEGIN SET NOCOUNT ON; BEGIN TRY
    INSERT INTO [college_required_documents$Arc] (id,college_id,faculty_master_id,year_of_study,document_type_id,is_mandatory,created_by,updated_by,action_type,action_by,machine_mac_address,comments)
    SELECT d.id,d.college_id,d.faculty_master_id,d.year_of_study,d.document_type_id,d.is_mandatory,d.created_by,d.updated_by,
    'DELETE',CONVERT(NVARCHAR(150),COALESCE(d.updated_by,SESSION_CONTEXT(N'app_user_id'))),CONVERT(NVARCHAR(50),SESSION_CONTEXT(N'app_machine_mac')),CONVERT(NVARCHAR(500),SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY BEGIN CATCH END CATCH END
  GO

  PRINT 'All 66 audit triggers created successfully.';
