/*
SOE coverage, SQL Server 2016 SP1 or later. Deploy in the syllabus database.
Verify dbo schema, identifier types, calendar year/month encoding, and
Category_ClassMapping.ClassId = tbl_jharkhand_acs.batchId before deployment.
@SoeStateSpecificType must be the actual cohort value, not an assumed label.
@CoverageBasis must match TargetPercentage: Monthly, AnnualMonthly, or Cumulative.
Source of completion: master topics + school eligibility + approved tracking.
Reporting-summary refresh lag cannot affect this query. No base-table writes.
*/
CREATE OR ALTER PROCEDURE dbo.usp_GetSoeSyllabusCoverage
    @AcademicYearStart int,
    @Month tinyint,
    @SoeStateSpecificType nvarchar(128),
    @CoverageBasis varchar(16),
    @BatchId int = NULL,
    @SubjectName nvarchar(200) = NULL,
    @DistrictName nvarchar(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @AcademicYearStart IS NULL OR @AcademicYearStart NOT BETWEEN 2000 AND 2100
        THROW 51000, 'Invalid academic year.', 1;
    IF @Month IS NULL OR @Month NOT BETWEEN 1 AND 12
        THROW 51000, 'Invalid syllabus month.', 1;
    IF NULLIF(LTRIM(RTRIM(@SoeStateSpecificType)), N'') IS NULL
        THROW 51000, 'The SOE cohort value is required.', 1;
    IF @CoverageBasis IS NULL OR @CoverageBasis NOT IN ('Monthly', 'AnnualMonthly', 'Cumulative')
        THROW 51000, 'CoverageBasis must be Monthly, AnnualMonthly, or Cumulative.', 1;
    IF @BatchId IS NOT NULL AND @BatchId < 1
        THROW 51000, 'Invalid class/batch identifier.', 1;

    DECLARE @ReportYear int = @AcademicYearStart + CASE WHEN @Month < 4 THEN 1 ELSE 0 END;

    -- DISTINCT and EXISTS prevent duplicate category mappings or school rows
    -- from multiplying eligible school-topic pairs. SchoolCode must uniquely
    -- identify a school with consistent category, cohort, and geography.
    SELECT DISTINCT
        s.SchoolCode,
        a.ACS_id,
        a.batchId AS BatchId,
        a.subjectId AS SubjectId,
        a.[year] AS TopicYear,
        a.[month] AS TopicMonth
    INTO #EligibleTopics
    FROM dbo.tbl_jharkhand_acs AS a
    INNER JOIN dbo.School_Profile AS s
        ON s.StateSpecificType = @SoeStateSpecificType
    WHERE a.StateSpecificType = @SoeStateSpecificType
        AND a.IsActive = 1
        AND a.DeletedOn IS NULL
        AND s.SchoolCode IS NOT NULL
        AND ((a.[year] = @AcademicYearStart AND a.[month] BETWEEN 4 AND 12)
            OR (a.[year] = @AcademicYearStart + 1 AND a.[month] BETWEEN 1 AND 3))
        AND (@CoverageBasis <> 'Monthly' OR (a.[year] = @ReportYear AND a.[month] = @Month))
        AND (@BatchId IS NULL OR a.batchId = @BatchId)
        AND (@SubjectName IS NULL OR a.subjectName = @SubjectName)
        AND (@DistrictName IS NULL OR EXISTS
            (SELECT 1 FROM dbo.LMs_DistrictMaster AS d
             WHERE d.DistrictId = s.LMS_DistrictId AND d.DistrictName = @DistrictName))
        AND EXISTS
            (SELECT 1 FROM dbo.Category_ClassMapping AS c
             WHERE c.CategoryId = s.SchoolCategoryId AND c.ClassId = a.batchId);

    -- A topic is completed once for a school, even with repeated approvals
    -- or requests by multiple teachers. IsCompleted is the owner's rule.
    SELECT DISTINCT e.SchoolCode, e.ACS_id
    INTO #CompletedTopics
    FROM #EligibleTopics AS e
    INNER JOIN dbo.AcademicYearCalendarTracking AS t
        ON t.SchoolCode = e.SchoolCode AND t.AC_ID = e.ACS_id
    WHERE t.IsCompleted = 1;

    SELECT e.BatchId, e.SubjectId,
        COUNT_BIG(*) AS EligibleTopics,
        SUM(CONVERT(bigint, CASE WHEN c.ACS_id IS NOT NULL
            AND ((@CoverageBasis = 'Cumulative' AND (e.TopicYear < @ReportYear OR (e.TopicYear = @ReportYear AND e.TopicMonth <= @Month)))
                OR (@CoverageBasis <> 'Cumulative' AND e.TopicYear = @ReportYear AND e.TopicMonth = @Month))
            THEN 1 ELSE 0 END)) AS CompletedTopics
    INTO #CoverageGroups
    FROM #EligibleTopics AS e
    LEFT JOIN #CompletedTopics AS c ON c.SchoolCode = e.SchoolCode AND c.ACS_id = e.ACS_id
    GROUP BY e.BatchId, e.SubjectId;

    -- A configured target must be unique at its full key. Never hide fan-out
    -- by averaging duplicate target rows or choosing an arbitrary value.
    IF EXISTS
    (
        SELECT t.BatchId, t.SubjectId
        FROM dbo.Tbl_SplitSyllabusTargetPercentage AS t
        WHERE t.[Year] = @ReportYear AND t.[Month] = @Month
            AND t.StateSpecificType = @SoeStateSpecificType
            AND EXISTS (SELECT 1 FROM #CoverageGroups AS g
                        WHERE g.BatchId = t.BatchId AND g.SubjectId = t.SubjectId)
        GROUP BY t.BatchId, t.SubjectId
        HAVING COUNT_BIG(*) > 1
    )
        THROW 51001, 'Duplicate SOE targets exist for the selected scope.', 1;

    ;WITH WeightedGroups AS
    (
        SELECT g.EligibleTopics, g.CompletedTopics,
            CASE WHEN TRY_CONVERT(decimal(9,4), t.TargetPercentage) BETWEEN 0 AND 100
                THEN TRY_CONVERT(decimal(9,4), t.TargetPercentage) END AS ValidTarget
        FROM #CoverageGroups AS g
        LEFT JOIN dbo.Tbl_SplitSyllabusTargetPercentage AS t
            ON t.BatchId = g.BatchId AND t.SubjectId = g.SubjectId
            AND t.[Year] = @ReportYear AND t.[Month] = @Month
            AND t.StateSpecificType = @SoeStateSpecificType
    ), Totals AS
    (
        SELECT COALESCE(SUM(EligibleTopics), CONVERT(bigint, 0)) AS EligibleTopics,
            COALESCE(SUM(CompletedTopics), CONVERT(bigint, 0)) AS CompletedTopics,
            COALESCE(SUM(CASE WHEN ValidTarget IS NULL THEN 1 ELSE 0 END), 0) AS MissingTargetGroups,
            SUM(CONVERT(decimal(28,4), EligibleTopics) * COALESCE(ValidTarget, 0)) AS WeightedTarget
        FROM WeightedGroups
    )
    SELECT
        CASE WHEN MissingTargetGroups = 0
            THEN CONVERT(decimal(9,4), WeightedTarget / NULLIF(EligibleTopics, 0)) END AS TargetPercentage,
        CONVERT(decimal(9,4), CONVERT(decimal(28,4), CompletedTopics) * 100 / NULLIF(EligibleTopics, 0)) AS AchievedPercentage,
        CompletedTopics,
        EligibleTopics,
        MissingTargetGroups,
        @CoverageBasis AS CoverageBasis,
        @ReportYear AS CalendarYear,
        @Month AS SyllabusMonth
    FROM Totals;
END;
GO

-- Example, replace the cohort value and select the VERIFIED target basis:
-- EXEC dbo.usp_GetSoeSyllabusCoverage
--     @AcademicYearStart = 2026, @Month = 10,
--     @SoeStateSpecificType = N'<actual SOE value>', @CoverageBasis = 'Monthly';
