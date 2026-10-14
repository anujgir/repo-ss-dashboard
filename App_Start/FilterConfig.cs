using System.Web;
using System.Web.Mvc;

namespace repo_syllabusmis_dashbaord
{
    public class FilterConfig
    {
        public static void RegisterGlobalFilters(GlobalFilterCollection filters)
        {
            filters.Add(new HandleErrorAttribute());
        }
    }
}
