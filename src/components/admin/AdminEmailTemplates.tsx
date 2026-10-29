import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Save, Info, Eye, Code, Edit3, Sparkles } from "lucide-react";

type EmailTemplate = {
  id: string;
  event_type: string;
  subject: string;
  body_html: string;
  variables_help_text: string | null;
};

// Helper: Convert HTML to readable plain text for editing
function htmlToPlainText(html: string): string {
  if (!html) return "";
  let text = html;
  // Replace <br> and </p>, </h1>.. with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "• ");
  text = text.replace(/<\/div>/gi, "\n");
  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  // Clean up excess newlines
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

// Helper: Wrap edited plain text into professional responsive email HTML
function plainTextToHtml(plainText: string, originalHtml: string): string {
  if (!plainText.trim()) return originalHtml;

  // Split into paragraphs by double newlines
  const paragraphs = plainText.split(/\n{2,}/);
  const formattedContent = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";

      // List item handling
      if (trimmed.startsWith("• ") || trimmed.includes("\n• ")) {
        const items = trimmed
          .split("\n")
          .map((line) => line.replace(/^•\s*/, "").trim())
          .filter(Boolean)
          .map((item) => `<li style="margin-bottom: 8px;">${item}</li>`)
          .join("");
        return `<ul style="margin: 16px 0; padding-left: 20px; color: #334155; font-size: 15px; line-height: 1.6;">${items}</ul>`;
      }

      // First paragraph headline check
      if (trimmed.length < 60 && !trimmed.includes(".") && paragraphs.indexOf(p) === 0) {
        return `<h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">${trimmed}</h1>`;
      }

      return `<p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">${trimmed.replace(
        /\n/g,
        "<br/>"
      )}</p>`;
    })
    .join("");

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
  <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
    <span style="font-size: 18px; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px;">BTHRIFTS</span>
  </div>
  ${formattedContent}
  <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
    <p style="margin: 0;">Sent via BTHRIFTS Official Resend Channel • Support: <a href="mailto:support@thriftyfy.africa" style="color: #4f46e5; text-decoration: none;">support@thriftyfy.africa</a></p>
  </div>
</div>`.trim();
}

export function AdminEmailTemplates() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [plainText, setPlainText] = useState("");
  const [editMode, setEditMode] = useState<"plain" | "html">("plain");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_templates")
        .select("*")
        .order("event_type");
      if (error) throw error;
      return data as unknown as EmailTemplate[];
    },
  });

  const selectedTemplate = templates?.find((t) => t.event_type === selectedEvent);

  useEffect(() => {
    if (templates && templates.length > 0 && !selectedEvent) {
      setSelectedEvent(templates[0].event_type);
    }
  }, [templates, selectedEvent]);

  useEffect(() => {
    if (selectedTemplate) {
      setSubject(selectedTemplate.subject);
      setBodyHtml(selectedTemplate.body_html);
      setPlainText(htmlToPlainText(selectedTemplate.body_html));
    }
  }, [selectedTemplate]);

  // When plain text changes, automatically update the HTML
  const handlePlainTextChange = (val: string) => {
    setPlainText(val);
    setBodyHtml(plainTextToHtml(val, selectedTemplate?.body_html || ""));
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) return;
      const htmlToSave = editMode === "plain" ? plainTextToHtml(plainText, bodyHtml) : bodyHtml;

      const { error } = await (supabase as any)
        .from("email_templates")
        .update({
          subject: subject.trim(),
          body_html: htmlToSave,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTemplate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template saved successfully!");
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar List */}
        <div className="w-full lg:w-1/3 space-y-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email Templates ({templates?.length || 0})
            </h3>
          </div>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {templates?.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedEvent(t.event_type)}
                className={`w-full text-left px-4 py-3 rounded-2xl transition-all border text-sm flex items-center justify-between ${
                  selectedEvent === t.event_type
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-medium"
                }`}
              >
                <span className="truncate">{t.event_type}</span>
                <span className="text-[10px] text-slate-400 font-mono">active</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor & Preview Workspace */}
        <div className="w-full lg:w-2/3">
          {selectedTemplate ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span>Template:</span>
                    <span className="text-indigo-600">{selectedTemplate.event_type}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Edit in plain text; HTML is automatically generated and styled.</p>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveTab("edit")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        activeTab === "edit"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("preview")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        activeTab === "preview"
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Live Preview</span>
                    </button>
                  </div>

                  <button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{updateMutation.isPending ? "Saving..." : "Save Template"}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Variables helper banner */}
              {selectedTemplate.variables_help_text && (
                <div className="mb-6 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-xs text-indigo-900">
                  <Info className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-indigo-950 mb-0.5">Supported Dynamic Placeholders:</strong>
                    <code className="text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded font-mono">
                      {selectedTemplate.variables_help_text}
                    </code>
                  </div>
                </div>
              )}

              {/* Subject Input */}
              <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900 text-sm transition-all"
                />
              </div>

              {/* TAB 1: EDIT (Plain Text or HTML Code) */}
              {activeTab === "edit" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <span>Email Content</span>
                      {editMode === "plain" && (
                        <span className="text-[10px] font-normal normal-case text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                          Plain Text Mode (HTML automatically generated)
                        </span>
                      )}
                    </label>

                    <button
                      type="button"
                      onClick={() => setEditMode(editMode === "plain" ? "html" : "plain")}
                      className="text-xs font-semibold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 transition-colors"
                    >
                      {editMode === "plain" ? (
                        <>
                          <Code className="w-3.5 h-3.5" /> Switch to Raw HTML
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Switch to Plain Text Editor
                        </>
                      )}
                    </button>
                  </div>

                  {editMode === "plain" ? (
                    <div>
                      <textarea
                        value={plainText}
                        onChange={(e) => handlePlainTextChange(e.target.value)}
                        rows={14}
                        placeholder="Type your email copy here in plain text. Use double returns for paragraphs and '• ' for bullet items."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-sm text-slate-800 leading-relaxed transition-all resize-y"
                      />
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Tip: You can use any of the dynamic placeholders like <code>{"{{user_name}}"}</code> or <code>{"{{tracking_code}}"}</code> in your copy.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={bodyHtml}
                        onChange={(e) => setBodyHtml(e.target.value)}
                        rows={14}
                        className="w-full p-4 bg-slate-900 text-slate-100 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs leading-relaxed transition-all resize-y"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LIVE HTML PREVIEW */}
              {activeTab === "preview" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Live Customer Preview (Simulated View)
                    </span>
                    <span className="text-xs text-slate-400">Rendered exactly as buyers & merchants see it</span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/60 overflow-hidden shadow-inner">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
                      <div className="pb-4 mb-4 border-b border-slate-100">
                        <p className="text-xs text-slate-400 font-medium">Subject Preview:</p>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">{subject}</h3>
                      </div>
                      <div
                        className="prose prose-slate max-w-none text-sm"
                        dangerouslySetInnerHTML={{
                          __html: bodyHtml || "<p class='text-slate-400 italic'>No content to preview.</p>",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
              <p className="text-slate-500 font-medium">Select a template from the sidebar to edit or preview.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
