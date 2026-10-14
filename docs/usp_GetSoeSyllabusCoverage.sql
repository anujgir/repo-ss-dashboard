/*
SOE monthly coverage from the reporting tables, as requested by the owner.
Achieved = arithmetic mean of each active summary row's monthly percentage.
Target = arithmetic mean of configured SOE TargetPercentage rows.
These are separate aggregates; joining targets to schools would duplicate them.
Deploy in the actual syllabus database (SQL Server 2016 SP1 or later).
*/
CREATE OR ALTER PROCEDURE dbo.usp_GetSoeSyllabusCoverage
    @Year int,
    @Month int,
    @StateSpecificType varchar(50) = 'SOE',
    @BatchId int = NULL,
    @SubjectName nvarchar(200) = NULL,
    @DistrictName nvarchar(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (
            SELECT CONVERT(decimal(18,4), AVG(CONVERT(decimal(18,4), t.TargetPercentage)))
            FROM dbo.Tbl_SplitSyllabusTargetPercentage AS t
            WHERE t.StateSpecificType = @StateSpecificType
                AND t.[Year] = @Year
                AND t.[Month] = @Month
                AND (@BatchId IS NULL OR t.BatchId = @BatchId)
                AND (@SubjectName IS NULL OR t.SubjectName = @SubjectName)
        ) AS TargetPercentage,
        (
            SELECT CONVERT(decimal(18,4), AVG(
                CONVERT(decimal(28,6), s.CompletedTopics) * 100
                / NULLIF(CONVERT(decimal(28,6), s.MonthTopics), 0)))
            FROM dbo.SplitSyllabusCompletedDetails AS s
            WHERE s.StateSpecificType = @StateSpecificType
                AND s.IsActive = 1
                AND s.[Year] = @Year
                AND s.[Month] = @Month
                AND s.MonthTopics > 0
                AND (@BatchId IS NULL OR s.BatchId = @BatchId)
                AND (@SubjectName IS NULL OR s.SubjectName = @SubjectName)
                AND (@DistrictName IS NULL OR s.DistrictName = @DistrictName)
        ) AS AchievedPercentage;
END;
GO

-- October 2026, all SOE classes/subjects:
-- EXEC dbo.usp_GetSoeSyllabusCoverage @Year = 2026, @Month = 10;
-- January in academic year 2026-27 uses @Year = 2027, @Month = 1.
-- Target rows have no district column, so the configured target is statewide
-- for the selected class/subject/month; district filters affect achieved only.
