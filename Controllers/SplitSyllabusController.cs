using System;
using System.Configuration;
using System.Data;
using System.Data.SqlClient;
using System.Web.Mvc;

namespace repo_syllabusmis_dashbaord.Controllers
{
    public class SplitSyllabusController : Controller
    {
        public ActionResult Index()
        {
            return View();
        }

        [HttpGet]
        public JsonResult SoeCoverage(int academicYearStart, int month,
            int? batchId, string subjectName, string districtName)
        {
            DataTable schoolcodedt = new DataTable();

            using (SqlConnection conn = new SqlConnection(ConfigurationManager.ConnectionStrings["cs"].ConnectionString))
            using (SqlCommand cmd = new SqlCommand("dbo.usp_GetSoeSyllabusCoverage", conn))
            {
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.Parameters.Add("@Year", SqlDbType.Int).Value = academicYearStart + (month <= 3 ? 1 : 0);
                cmd.Parameters.Add("@Month", SqlDbType.Int).Value = month;
                cmd.Parameters.Add("@StateSpecificType", SqlDbType.VarChar, 50).Value = "SOE";
                cmd.Parameters.Add("@BatchId", SqlDbType.Int).Value = (object)batchId ?? DBNull.Value;
                cmd.Parameters.Add("@SubjectName", SqlDbType.NVarChar, 200).Value = (object)subjectName ?? DBNull.Value;
                cmd.Parameters.Add("@DistrictName", SqlDbType.NVarChar, 200).Value = (object)districtName ?? DBNull.Value;

                using (SqlDataAdapter da = new SqlDataAdapter())
                {
                    da.SelectCommand = cmd;
                    da.Fill(schoolcodedt);
                }
            }

            DataRow coverage = schoolcodedt.Rows[0];
            return Json(new
            {
                success = true,
                data = new
                {
                    TargetPercentage = coverage["TargetPercentage"] == DBNull.Value
                        ? (decimal?)null : Convert.ToDecimal(coverage["TargetPercentage"]),
                    AchievedPercentage = coverage["AchievedPercentage"] == DBNull.Value
                        ? (decimal?)null : Convert.ToDecimal(coverage["AchievedPercentage"])
                }
            }, JsonRequestBehavior.AllowGet);
        }
    }
}
