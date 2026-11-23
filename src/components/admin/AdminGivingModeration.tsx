import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gift, CheckCircle, ExternalLink, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { fetchFindGiftEnabled } from "@/lib/giving";

export function AdminGivingModeration() {
  const queryClient = useQueryClient();

  const { data: findGiftEnabled = false, isLoading: toggleLoading } = useQuery({
    queryKey: ["giving_find_gift_enabled"],
    queryFn: fetchFindGiftEnabled,
  });

  const handleToggleFindGift = async () => {
    const nextVal = !findGiftEnabled ? "true" : "false";
    try {
      const { error } = await (supabase as any)
        .from("platform_settings")
        .upsert(
          {
            key: "giving_find_gift_enabled",
            value: nextVal,
            description: "Controls whether the public Find a Gift browsing experience is open to users",
          },
          { onConflict: "key" }
        );
      if (error) throw error;
      toast.success(
        nextVal === "true"
          ? "Find a Gift is now OPEN to the public! 🎁"
          : "Find a Gift is now HIDDEN (Gift collection mode)."
      );
      queryClient.invalidateQueries({ queryKey: ["giving_find_gift_enabled"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update setting");
    }
  };
  const { data: reports = [], refetch, isLoading } = useQuery({
    queryKey: ["admin_gift_reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gift_reports")
        .select(`
          *,
          reporter:profiles!gift_reports_reporter_id_fkey(username, full_name),
          gift:gift_listings(id, title, status, giver_id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpdateReportStatus = async (
    reportId: string,
    status: "reviewed" | "action_taken" | "dismissed",
    giftId?: string,
    withdrawGift?: boolean
  ) => {
    try {
      if (withdrawGift && giftId) {
        await (supabase as any)
          .from("gift_listings")
          .update({ status: "withdrawn" })
          .eq("id", giftId);
      }

      const { error } = await (supabase as any)
        .from("gift_reports")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", reportId);

      if (error) throw error;
      toast.success(`Report marked as ${status.replace("_", " ")}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to update report");
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading gift reports...</div>;

  return (
    <div className="space-y-6">
      {/* ADMIN VISIBILITY CONTROL FOR FIND A GIFT */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            {findGiftEnabled ? (
              <Eye className="h-5 w-5 text-emerald-600" />
            ) : (
              <EyeOff className="h-5 w-5 text-amber-600" />
            )}
            Public "Find a Gift" Access
          </h3>
          <p className="text-xs text-slate-500 max-w-xl">
            Keep "Find a Gift" hidden while collecting gifts from givers, then open it to the public when you are ready for applicants to browse and pitch.
          </p>
        </div>

        <button
          type="button"
          disabled={toggleLoading}
          onClick={handleToggleFindGift}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-colors shrink-0 ${
            findGiftEnabled
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-amber-500 hover:bg-amber-600 text-slate-950"
          }`}
        >
          {findGiftEnabled ? "Open to Public (Click to Hide)" : "Hidden (Click to Open to Public)"}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Gift className="h-5 w-5 text-emerald-600" />
          Christmas Giving Moderation Reports
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Review community reports regarding Christmas gift listings or inappropriate applications.
        </p>
      </div>

      {reports.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {reports.map((r: any) => (
            <li key={r.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 text-xs rounded-md font-semibold tracking-wide uppercase ${
                        r.status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : r.status === "action_taken"
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-500">
                      Reported by @{r.reporter?.username || "user"} • {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-slate-900 mb-1">
                      Reason: <span className="font-normal text-red-600 capitalize">{r.reason.replace(/_/g, " ")}</span>
                    </p>
                    {r.details && <p className="text-slate-600 italic">"{r.details}"</p>}
                  </div>

                  {r.gift && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>Target Gift:</span>
                      <strong className="text-slate-900">{r.gift.title}</strong>
                      <span className="text-slate-400">({r.gift.status})</span>
                      <Link
                        to="/giving/$id"
                        params={{ id: r.gift.id }}
                        target="_blank"
                        className="text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" /> View
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 w-full md:w-52 shrink-0 justify-start">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleUpdateReportStatus(r.id, "action_taken", r.gift?.id, true)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-medium text-xs transition-colors"
                      >
                        Withdraw Gift & Close Report
                      </button>
                      <button
                        onClick={() => handleUpdateReportStatus(r.id, "reviewed", r.gift?.id, false)}
                        className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg font-medium text-xs transition-colors"
                      >
                        Mark as Reviewed
                      </button>
                      <button
                        onClick={() => handleUpdateReportStatus(r.id, "dismissed", r.gift?.id, false)}
                        className="w-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg text-xs transition-colors"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Zero Giving Reports</h3>
          <p className="text-slate-500 mt-1">No community reports have been submitted for Christmas Giving.</p>
        </div>
      )}
      </div>
    </div>
  );
}
