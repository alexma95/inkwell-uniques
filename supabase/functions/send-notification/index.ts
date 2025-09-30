import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  assignmentId: string;
  email: string;
  campaignName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { assignmentId, email, campaignName }: NotificationRequest = await req.json();

    console.log("Processing notification for assignment:", assignmentId);

    // Get assignment details with texts
    const { data: assignmentTexts, error: textsError } = await supabase
      .from("assignment_texts")
      .select(`
        *,
        products(name),
        texts(content, option_number)
      `)
      .eq("assignment_id", assignmentId);

    if (textsError) {
      console.error("Error fetching assignment texts:", textsError);
      throw textsError;
    }

    // Format the email content
    let emailContent = `
      <h2>Assignment Completed</h2>
      <p><strong>User Email:</strong> ${email}</p>
      <p><strong>Campaign:</strong> ${campaignName}</p>
      <h3>Assigned Texts:</h3>
      <ul>
    `;

    for (const item of assignmentTexts || []) {
      emailContent += `
        <li>
          <strong>${item.products?.name} (Option #${item.texts?.option_number}):</strong><br/>
          ${item.texts?.content}<br/>
          <em>Copied: ${item.copied_at ? new Date(item.copied_at).toLocaleString() : 'Not copied'}</em>
        </li>
      `;
    }

    emailContent += `</ul>`;

    // Here you would normally send the email using Resend
    // Since the API key might not be set yet, we'll just log it
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      // TODO: Implement Resend email sending when API key is available
      console.log("Would send email with content:", emailContent);
    } else {
      console.log("RESEND_API_KEY not set, skipping email send");
      console.log("Email content would be:", emailContent);
    }

    // Update notification as sent
    await supabase
      .from("notifications")
      .update({ sent: true })
      .eq("assignment_id", assignmentId);

    return new Response(
      JSON.stringify({ success: true, message: "Notification processed" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);