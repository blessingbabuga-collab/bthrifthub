import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Save, Info } from "lucide-react";

type EmailTemplate = {
  id: string;
  event_type: string;
  subject: string;
  body_html: string;
  variables_help_text: string | null;
};

export function AdminEmailTemplates() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_templates").select("*").order("event_type");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const selectedTemplate = templates?.find((t) => t.event_type === selectedEvent);

  useEffect(() => {
    if (selectedTemplate) {
      setSubject(selectedTemplate.subject);
      setBodyHtml(selectedTemplate.body_html);
    }
  }, [selectedTemplate]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) return;
      const { error } = await supabase
        .from("email_templates")
        .update({ subject, body_html: bodyHtml, updated_at: new Date().toISOString() })
        .eq("id", selectedTemplate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template saved successfully");
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save template");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-slate-500 animate-pulse">Loading templates...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar List */}
        <div className="w-full md:w-1/3 space-y-2">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Mail className="h-4 w-4" /> Template Events
          </h3>
          {templates?.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedEvent(t.event_type)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors border ${
                selectedEvent === t.event_type
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-medium"
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-100 hover:bg-slate-50"
              }`}
            >
              {t.event_type}
            </button>
          ))}
          {(!templates || templates.length === 0) && (
            <div className="text-sm text-slate-500 italic p-4 bg-white border rounded-xl border-dashed">
              No templates found. Please run the migration.
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="w-full md:w-2/3">
          {selectedTemplate ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Editing: <span className="text-indigo-600">{selectedTemplate.event_type}</span>
                </h2>
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Saving..." : "Save Template"}
                </button>
              </div>

              {selectedTemplate.variables_help_text && (
                <div className="mb-6 bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
                  <Info className="h-5 w-5 shrink-0 text-blue-500" />
                  <div>
                    <strong className="block mb-1">Dynamic Variables</strong>
                    {selectedTemplate.variables_help_text}
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">HTML Body</label>
                  <textarea
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm text-slate-700"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <p className="text-slate-500 font-medium">Select a template from the sidebar to edit.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
