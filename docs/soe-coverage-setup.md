# SOE Monthly Coverage

The dashboard calls GET /SplitSyllabus/SoeCoverage. The controller directly creates a SqlConnection from ConfigurationManager.ConnectionStrings["cs"].ConnectionString, a stored-procedure SqlCommand with typed parameters, and a SqlDataAdapter that fills a DataTable. It returns only TargetPercentage and AchievedPercentage in the dashboard JSON data object. The former service, DTO, environment-variable settings, and calculation-basis selection have been removed at the owner's request.

## Connection and Deployment

Replace the dummy connection string named cs in Web.config with your actual SQL Server connection. The committed value uses YOUR_SQL_SERVER and YOUR_DATABASE; it is not a live connection. Keep real credentials out of Git.

Run [usp_GetSoeSyllabusCoverage.sql](usp_GetSoeSyllabusCoverage.sql) in the correct syllabus database. It defines dbo.usp_GetSoeSyllabusCoverage using CREATE OR ALTER. Verify actual schema names and parameter types before deployment. No real database deployment was performed.

## Requested Calculation

- AchievedPercentage = the arithmetic average of CompletedTopics * 100.0 / MonthTopics for active SOE rows in SplitSyllabusCompletedDetails for the selected calendar year/month.
- Rows with MonthTopics = 0 or NULL are excluded. A row with zero completed topics and a positive monthly topic count contributes 0%.
- TargetPercentage = the arithmetic average of matching SOE TargetPercentage values in Tbl_SplitSyllabusTargetPercentage.
- The two averages are calculated independently. Target records are not multiplied by joining them to school reporting rows.
- No topic weighting, raw-topic/tracking joins, annual denominator, or cumulative calculation is used for this SOE card.
- The summary table is assumed to contain the correct month-wise school/class/subject reporting rows. Its refresh and row grain determine the result.

The procedure accepts Year, Month, StateSpecificType (SOE), and optional BatchId, SubjectName, and DistrictName. Class and subject filters apply to both tables. District applies only to achieved data, because the target table has no district column. January through March in academic year 2026-27 use calendar year 2027.

## Dashboard and Tests

The SOE card displays the two returned averages, a gap, and a percentage bar. It supports null values as N/A, and does not show the removed topic-count text. Other metrics remain illustrative. A placeholder database connection can cause a server error; the browser clears the card and shows an unavailable response.

Run ./tests/soe-coverage.tests.ps1 against local SQL Server to verify the actual procedure using temporary fixtures. Tests distinguish arithmetic averaging from a weighted ratio and check independent targets, scope filters, null/zero denominators, zero completions, empty results, and January year selection.
