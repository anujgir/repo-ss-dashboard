param([string]$ServerInstance = '.\SQLEXPRESS')

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$procedure = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'docs/usp_GetSoeSyllabusCoverage.sql')
$procedure = $procedure.Replace('CREATE OR ALTER PROCEDURE dbo.usp_GetSoeSyllabusCoverage', 'CREATE PROCEDURE #SoeCoverage')
foreach ($tableName in @('SplitSyllabusCompletedDetails', 'Tbl_SplitSyllabusTargetPercentage')) {
    $procedure = $procedure.Replace('dbo.' + $tableName, '#' + $tableName)
}

# The actual procedure runs against connection-local temporary fixtures only.
$fixtures = @"
SET NOCOUNT ON;
CREATE TABLE #SplitSyllabusCompletedDetails (StateSpecificType varchar(50), [Year] int, [Month] int, BatchId int, SubjectName nvarchar(200), DistrictName nvarchar(200), IsActive bit, CompletedTopics int NULL, MonthTopics int NULL);
CREATE TABLE #Tbl_SplitSyllabusTargetPercentage (StateSpecificType varchar(50), [Year] int, [Month] int, BatchId int, SubjectName nvarchar(200), TargetPercentage decimal(18,4));
INSERT #SplitSyllabusCompletedDetails VALUES
 ('SOE',2026,10,1,N'Science',N'Ranchi',1,1,2),
 ('SOE',2026,10,1,N'Science',N'Bokaro',1,9,10),
 ('SOE',2026,10,2,N'Mathematics',N'Ranchi',1,2,4),
 ('SOE',2026,10,1,N'Science',N'Ranchi',1,1,0),
 ('SOE',2026,10,1,N'Science',N'Ranchi',1,1,NULL),
 ('SOE',2026,10,1,N'Science',N'Ranchi',0,100,100),
 ('OTHER',2026,10,1,N'Science',N'Ranchi',1,100,100),
 ('SOE',2026,9,1,N'Science',N'Ranchi',1,100,100),
 ('SOE',2027,1,1,N'Science',N'Ranchi',1,1,4);
INSERT #Tbl_SplitSyllabusTargetPercentage VALUES
 ('SOE',2026,10,1,N'Science',80),
 ('SOE',2026,10,2,N'Mathematics',20),
 ('OTHER',2026,10,1,N'Science',100),
 ('SOE',2027,1,1,N'Science',40);
CREATE TABLE #Actual (TargetPercentage decimal(18,4) NULL, AchievedPercentage decimal(18,4) NULL);
GO
"@

$assertions = @"
INSERT #Actual EXEC #SoeCoverage @Year=2026,@Month=10;
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE TargetPercentage=50 AND ABS(AchievedPercentage-63.3333)<0.001)
 THROW 52000, 'SOE arithmetic averages or monthly/active filtering failed.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage @Year=2026,@Month=10,@BatchId=1;
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE TargetPercentage=80 AND AchievedPercentage=70)
 THROW 52000, 'Achieved must average 50 and 90, not use the weighted ratio.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage @Year=2026,@Month=10,@SubjectName=N'Science',@DistrictName=N'Ranchi';
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE TargetPercentage=80 AND AchievedPercentage=50)
 THROW 52000, 'Subject/district filtering or statewide target selection failed.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage @Year=2027,@Month=1;
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE TargetPercentage=40 AND AchievedPercentage=25)
 THROW 52000, 'January calendar-year selection failed.', 1;

TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage @Year=2026,@Month=10,@BatchId=99;
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE TargetPercentage IS NULL AND AchievedPercentage IS NULL)
 THROW 52000, 'Empty scopes must return two null percentages.', 1;

INSERT #SplitSyllabusCompletedDetails VALUES ('SOE',2026,10,1,N'Science',N'Ranchi',1,0,2);
TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage @Year=2026,@Month=10,@BatchId=1;
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE ABS(AchievedPercentage-46.6667)<0.001)
 THROW 52000, 'A zero-completion row with topics must contribute zero to AVG.', 1;

INSERT #Tbl_SplitSyllabusTargetPercentage VALUES ('SOE',2026,10,1,N'Science',100);
TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage @Year=2026,@Month=10;
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE ABS(TargetPercentage-66.6667)<0.001)
 THROW 52000, 'Target rows must be averaged independently without school join fan-out.', 1;

DELETE #Tbl_SplitSyllabusTargetPercentage WHERE StateSpecificType='SOE' AND [Year]=2026;
TRUNCATE TABLE #Actual;
INSERT #Actual EXEC #SoeCoverage @Year=2026,@Month=10;
IF NOT EXISTS(SELECT 1 FROM #Actual WHERE TargetPercentage IS NULL AND AchievedPercentage IS NOT NULL)
 THROW 52000, 'Missing target must not remove achieved data.', 1;
PRINT 'PASS: exactly two results, arithmetic averages, independent targets, active/month/cohort filters, zero denominators, zero completions, optional filters, January year, and empty scopes.';
"@

($fixtures + [Environment]::NewLine + $procedure + [Environment]::NewLine + $assertions) | sqlcmd -S $ServerInstance -E -d tempdb -l 5 -b
if ($LASTEXITCODE -ne 0) { throw 'SOE stored procedure fixture tests failed.' }
