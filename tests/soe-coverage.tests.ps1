param([string]$ServerInstance = '.\SQLEXPRESS')

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$procedure = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'docs/usp_GetSoeSyllabusCoverage.sql')
$procedure = $procedure.Replace('CREATE OR ALTER PROCEDURE dbo.usp_GetSoeSyllabusCoverage', 'CREATE PROCEDURE #SoeCoverage')
foreach ($tableName in @('tbl_jharkhand_acs', 'School_Profile', 'Category_ClassMapping', 'LMs_DistrictMaster', 'AcademicYearCalendarTracking', 'Tbl_SplitSyllabusTargetPercentage')) {
    $procedure = $procedure.Replace('dbo.' + $tableName, '#' + $tableName)
}

# Fixtures and the tested procedure are connection-local tempdb objects only.
# No syllabus database is created, changed, or required.
$fixtures = @'
SET NOCOUNT ON;
CREATE TABLE #tbl_jharkhand_acs (ACS_id int, [year] int, [month] int, batchId int, subjectId int, subjectName nvarchar(200), StateSpecificType nvarchar(128), IsActive bit, DeletedOn datetime NULL);
CREATE TABLE #School_Profile (SchoolCode nvarchar(20), StateSpecificType nvarchar(128), SchoolCategoryId int, LMS_DistrictId int);
CREATE TABLE #Category_ClassMapping (CategoryId int, ClassId int);
CREATE TABLE #LMs_DistrictMaster (DistrictId int, DistrictName nvarchar(200));
CREATE TABLE #AcademicYearCalendarTracking (AC_ID int, SchoolCode nvarchar(20), IsCompleted bit);
CREATE TABLE #Tbl_SplitSyllabusTargetPercentage (BatchId int, SubjectId int, [Year] int, [Month] int, StateSpecificType nvarchar(128), TargetPercentage decimal(9,4));
INSERT #School_Profile VALUES (N'001',N'SOE',1,1),(N'002',N'SOE',2,2),(N'003',N'OTHER',2,1),(N'004',N'SOE',3,1);
INSERT #Category_ClassMapping VALUES (1,1),(1,1),(2,1),(2,2);
INSERT #LMs_DistrictMaster VALUES (1,N'Ranchi'),(2,N'Bokaro');
INSERT #tbl_jharkhand_acs VALUES
 (1,2026,10,1,1,N'Science',N'SOE',1,NULL),
 (2,2026,10,1,1,N'Science',N'SOE',1,NULL),
 (3,2026,10,2,2,N'Mathematics',N'SOE',1,NULL),
 (4,2026,4,1,1,N'Science',N'SOE',1,NULL),
 (5,2027,1,1,1,N'Science',N'SOE',1,NULL),
 (6,2026,10,1,1,N'Science',N'SOE',0,NULL),
 (7,2026,10,1,1,N'Science',N'OTHER',1,NULL),
 (8,2026,10,1,1,N'Science',N'SOE',1,'20261001'),
 (9,2025,10,1,1,N'Science',N'SOE',1,NULL);
INSERT #AcademicYearCalendarTracking VALUES (1,N'001',1),(1,N'001',1),(2,N'001',0),(3,N'001',1),(2,N'002',1),(3,N'002',1),(4,N'001',1),(5,N'001',1),(6,N'001',1),(7,N'003',1);
INSERT #Tbl_SplitSyllabusTargetPercentage VALUES (1,1,2026,10,N'SOE',80),(2,2,2026,10,N'SOE',20),(1,1,2027,1,N'SOE',50);
CREATE TABLE #Actual (TargetPercentage decimal(9,4) NULL, AchievedPercentage decimal(9,4) NULL, CompletedTopics bigint, EligibleTopics bigint, MissingTargetGroups int, CoverageBasis varchar(16), CalendarYear int, SyllabusMonth tinyint);
GO
'@

$assertions = @'
TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage 2026,10,N'SOE','Monthly';
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE EligibleTopics=5 AND CompletedTopics=3 AND AchievedPercentage=60 AND TargetPercentage=68)
 THROW 52000, 'Monthly weighting, eligibility, or completion deduplication failed.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage 2026,10,N'SOE','Cumulative';
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE EligibleTopics=9 AND CompletedTopics=4 AND ABS(AchievedPercentage-44.4444)<0.001 AND ABS(TargetPercentage-73.3333)<0.001)
 THROW 52000, 'Cumulative annual denominator or future-topic exclusion failed.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage 2026,10,N'SOE','AnnualMonthly';
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE EligibleTopics=9 AND CompletedTopics=3 AND ABS(AchievedPercentage-33.3333)<0.001)
 THROW 52000, 'Monthly contribution to the annual syllabus failed.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage 2026,1,N'SOE','Monthly';
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE CalendarYear=2027 AND EligibleTopics=2 AND CompletedTopics=1 AND AchievedPercentage=50 AND TargetPercentage=50)
 THROW 52000, 'January academic-year rollover failed.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage 2026,10,N'SOE','Monthly',NULL,N'Science',N'Ranchi';
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE EligibleTopics=2 AND CompletedTopics=1 AND AchievedPercentage=50 AND TargetPercentage=80)
 THROW 52000, 'Subject/district filter or pending-request exclusion failed.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage 2026,10,N'SOE','Monthly',99;
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE EligibleTopics=0 AND CompletedTopics=0 AND TargetPercentage IS NULL AND AchievedPercentage IS NULL)
 THROW 52000, 'Empty-scope N/A handling failed.', 1;

DELETE #Tbl_SplitSyllabusTargetPercentage WHERE BatchId=2;
TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage 2026,10,N'SOE','Monthly';
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE TargetPercentage IS NULL AND MissingTargetGroups=1 AND AchievedPercentage=60)
 THROW 52000, 'Missing target must not produce a partial weighted percentage.', 1;

UPDATE #Tbl_SplitSyllabusTargetPercentage SET TargetPercentage=150 WHERE [Year]=2026;
TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage 2026,10,N'SOE','Monthly';
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE TargetPercentage IS NULL AND MissingTargetGroups=2)
 THROW 52000, 'Invalid target validation failed.', 1;

INSERT #Tbl_SplitSyllabusTargetPercentage VALUES (1,1,2026,10,N'SOE',80);
BEGIN TRY
 EXEC #SoeCoverage 2026,10,N'SOE','Monthly';
 THROW 52000, 'Duplicate targets were accepted.', 1;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>51001 THROW;
END CATCH;
BEGIN TRY
 EXEC #SoeCoverage 2026,13,N'SOE','Monthly';
 THROW 52000, 'Invalid month was accepted.', 1;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>51000 THROW;
END CATCH;
PRINT 'PASS: monthly/cumulative coverage, weighting, topic deduplication, school-class eligibility, inactive/deleted exclusions, January rollover, filters, empty scopes, missing/invalid/duplicate targets, and input validation.';
'@

($fixtures + "`r`n" + $procedure + "`r`n" + $assertions) | sqlcmd -S $ServerInstance -E -d tempdb -l 5 -b
if ($LASTEXITCODE -ne 0) { throw 'SOE stored procedure fixture tests failed.' }
