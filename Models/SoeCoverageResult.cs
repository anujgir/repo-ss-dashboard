namespace repo_syllabusmis_dashbaord.Models
{
    public class SoeCoverageResult
    {
        public decimal? TargetPercentage { get; set; }
        public decimal? AchievedPercentage { get; set; }
        public long CompletedTopics { get; set; }
        public long EligibleTopics { get; set; }
        public int MissingTargetGroups { get; set; }
        public string CoverageBasis { get; set; }
        public int CalendarYear { get; set; }
        public int SyllabusMonth { get; set; }
    }
}
