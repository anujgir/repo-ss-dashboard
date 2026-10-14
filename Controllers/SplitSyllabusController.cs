using System;
using System.Configuration;
using System.Data.SqlClient;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Web.Mvc;
using repo_syllabusmis_dashbaord.Services;

namespace repo_syllabusmis_dashbaord.Controllers
{
    public class SplitSyllabusController : Controller
    {
        public ActionResult Index()
        {
            return View();
        }

        [HttpGet]
        [OutputCache(NoStore = true, Duration = 0, VaryByParam = "*")]
        public async Task<JsonResult> SoeCoverage(int academicYearStart, int month,
            int? batchId, string subjectName, string districtName)
        {
            if (!ModelState.IsValid || academicYearStart < 2000 || academicYearStart > 2100
                || month < 1 || month > 12 || (batchId.HasValue && batchId.Value < 1)
                || (subjectName != null && subjectName.Length > 200)
                || (districtName != null && districtName.Length > 200))
            {
                return CoverageError(400, "InvalidFilter", "Please select a valid year, month, class, subject, and district.");
            }

            var connectionString = Environment.GetEnvironmentVariable("SPLIT_SYLLABUS_SQL_CONNECTION_STRING");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                var configuredConnection = ConfigurationManager.ConnectionStrings["SplitSyllabus"];
                connectionString = configuredConnection == null ? null : configuredConnection.ConnectionString;
            }
            var soeValue = ReadSetting("SPLIT_SYLLABUS_SOE_STATE_SPECIFIC_TYPE", "SplitSyllabus.SoeStateSpecificType");
            var coverageBasis = ReadSetting("SPLIT_SYLLABUS_COVERAGE_BASIS", "SplitSyllabus.CoverageBasis");

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                return CoverageError(503, "ConfigurationRequired", "SOE coverage is unavailable: SQL Server is not configured.");
            }
            if (string.IsNullOrWhiteSpace(soeValue) || soeValue.Length > 128
                || (coverageBasis != "Monthly" && coverageBasis != "AnnualMonthly" && coverageBasis != "Cumulative"))
            {
                return CoverageError(503, "ConfigurationRequired", "SOE coverage requires the actual SOE value and a confirmed Monthly, AnnualMonthly, or Cumulative target basis.");
            }

            try
            {
                var service = new SoeCoverageService();
                var data = await service.FetchAsync(connectionString, soeValue, coverageBasis,
                    academicYearStart, month, batchId, NormalizeFilter(subjectName), NormalizeFilter(districtName));
                return Json(new { success = true, data = data }, JsonRequestBehavior.AllowGet);
            }
            catch (SqlException exception)
            {
                // Do not log connection strings, SQL text, or user/database values.
                Trace.TraceError("SOE coverage SQL operation failed. SQL error number: {0}.", exception.Number);
                if (exception.Number == 51001)
                {
                    return CoverageError(503, "DuplicateTargets", "SOE coverage is unavailable because duplicate target records need correction.");
                }
                return CoverageError(503, "DatabaseUnavailable", "SOE coverage could not be loaded. Check the database connection and deployed procedure.");
            }
            catch (Exception exception) when (exception is ArgumentException || exception is InvalidOperationException)
            {
                Trace.TraceError("SOE coverage configuration or result contract is invalid.");
                return CoverageError(503, "ConfigurationRequired", "SOE coverage configuration or the procedure result needs correction.");
            }
        }

        private JsonResult CoverageError(int status, string code, string message)
        {
            Response.StatusCode = status;
            Response.TrySkipIisCustomErrors = true;
            return Json(new { success = false, code = code, message = message }, JsonRequestBehavior.AllowGet);
        }

        private static string ReadSetting(string environmentName, string configurationName)
        {
            var value = Environment.GetEnvironmentVariable(environmentName);
            var configuredValue = string.IsNullOrWhiteSpace(value) ? ConfigurationManager.AppSettings[configurationName] : value;
            return (configuredValue ?? string.Empty).Trim();
        }

        private static string NormalizeFilter(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}
