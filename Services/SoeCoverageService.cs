using System;
using System.Data;
using System.Data.SqlClient;
using System.Threading.Tasks;
using repo_syllabusmis_dashbaord.Models;

namespace repo_syllabusmis_dashbaord.Services
{
    public class SoeCoverageService
    {
        public async Task<SoeCoverageResult> FetchAsync(string connectionString, string soeValue,
            string coverageBasis, int academicYearStart, int month, int? batchId,
            string subjectName, string districtName)
        {
            using (var connection = new SqlConnection(connectionString))
            using (var command = new SqlCommand("dbo.usp_GetSoeSyllabusCoverage", connection))
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandTimeout = 30;
                command.Parameters.Add("@AcademicYearStart", SqlDbType.Int).Value = academicYearStart;
                command.Parameters.Add("@Month", SqlDbType.TinyInt).Value = month;
                command.Parameters.Add("@SoeStateSpecificType", SqlDbType.NVarChar, 128).Value = soeValue;
                command.Parameters.Add("@CoverageBasis", SqlDbType.VarChar, 16).Value = coverageBasis;
                command.Parameters.Add("@BatchId", SqlDbType.Int).Value = (object)batchId ?? DBNull.Value;
                command.Parameters.Add("@SubjectName", SqlDbType.NVarChar, 200).Value = (object)subjectName ?? DBNull.Value;
                command.Parameters.Add("@DistrictName", SqlDbType.NVarChar, 200).Value = (object)districtName ?? DBNull.Value;

                await connection.OpenAsync();
                using (var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow))
                {
                    if (!await reader.ReadAsync())
                    {
                        throw new InvalidOperationException("Coverage procedure returned no result.");
                    }

                    return new SoeCoverageResult
                    {
                        TargetPercentage = ReadNullableDecimal(reader, "TargetPercentage"),
                        AchievedPercentage = ReadNullableDecimal(reader, "AchievedPercentage"),
                        CompletedTopics = Convert.ToInt64(reader["CompletedTopics"]),
                        EligibleTopics = Convert.ToInt64(reader["EligibleTopics"]),
                        MissingTargetGroups = Convert.ToInt32(reader["MissingTargetGroups"]),
                        CoverageBasis = Convert.ToString(reader["CoverageBasis"]),
                        CalendarYear = Convert.ToInt32(reader["CalendarYear"]),
                        SyllabusMonth = Convert.ToInt32(reader["SyllabusMonth"])
                    };
                }
            }
        }

        private static decimal? ReadNullableDecimal(SqlDataReader reader, string column)
        {
            return reader[column] == DBNull.Value ? (decimal?)null : Convert.ToDecimal(reader[column]);
        }
    }
}
