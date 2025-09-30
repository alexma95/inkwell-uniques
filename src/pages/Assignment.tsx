import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Copy, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AssignmentText {
  id: string;
  product_id: string;
  text_id: string;
  copied_at: string | null;
  product: {
    name: string;
    position: number;
  };
  text: {
    content: string;
    option_number: number;
  };
}

const Assignment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<any>(null);
  const [assignmentTexts, setAssignmentTexts] = useState<AssignmentText[]>([]);
  const [copiedTexts, setCopiedTexts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    fetchAssignmentData();
  }, [id]);

  const fetchAssignmentData = async () => {
    if (!id) return;

    try {
      // Fetch assignment details
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("user_assignments")
        .select("*, campaigns(name)")
        .eq("id", id)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);

      // Fetch assignment texts with product and text details
      const { data: textsData, error: textsError } = await supabase
        .from("assignment_texts")
        .select(`
          *,
          products(name, position),
          texts(content, option_number)
        `)
        .eq("assignment_id", id)
        .order("products(position)");

      if (textsError) throw textsError;
      
      // Transform the data to match our interface
      const transformedTexts = textsData.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        text_id: item.text_id,
        copied_at: item.copied_at,
        product: item.products,
        text: item.texts
      }));
      
      setAssignmentTexts(transformedTexts);
      
      // Track which texts have been copied
      const copied = new Set(
        transformedTexts
          .filter((t: AssignmentText) => t.copied_at)
          .map((t: AssignmentText) => t.id)
      );
      setCopiedTexts(copied);
    } catch (error: any) {
      console.error("Error fetching assignment:", error);
      toast({
        title: "Error",
        description: "Failed to load assignment",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: AssignmentText) => {
    try {
      await navigator.clipboard.writeText(text.text.content);
      
      // Update copied status in database
      await supabase
        .from("assignment_texts")
        .update({ copied_at: new Date().toISOString() })
        .eq("id", text.id);

      setCopiedTexts(prev => new Set(prev).add(text.id));
      
      toast({
        title: "Copied!",
        description: `Text for ${text.product.name} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy text",
        variant: "destructive",
      });
    }
  };

  const handleComplete = async () => {
    if (!assignment) return;

    setIsCompleting(true);
    try {
      // Update assignment status
      await supabase
        .from("user_assignments")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", assignment.id);

      // Create notification
      await supabase
        .from("notifications")
        .insert({
          assignment_id: assignment.id,
          type: "assignment_completed",
          message: `Assignment completed by ${assignment.email}`,
        });

      // Trigger email notification via edge function
      await supabase.functions.invoke("send-notification", {
        body: {
          assignmentId: assignment.id,
          email: assignment.email,
          campaignName: assignment.campaigns?.name,
        },
      });

      toast({
        title: "Success!",
        description: "Assignment marked as complete",
      });

      // Navigate to success page
      navigate("/success");
    } catch (error: any) {
      console.error("Error completing assignment:", error);
      toast({
        title: "Error",
        description: "Failed to complete assignment",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your assignments...</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Assignment Not Found</h2>
          <p className="text-muted-foreground mb-4">This assignment doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/")}>Go Back</Button>
        </div>
      </div>
    );
  }

  const allTextsCopied = assignmentTexts.length > 0 && 
    assignmentTexts.every(text => copiedTexts.has(text.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Text Assignments</h1>
          <p className="text-muted-foreground">
            Campaign: {assignment.campaigns?.name} • Email: {assignment.email}
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {assignmentTexts.map((text, index) => (
            <Card 
              key={text.id} 
              className={`p-6 transition-all ${
                copiedTexts.has(text.id) ? 'bg-primary/5 border-primary/20' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    Product {index + 1}: {text.product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Text Option #{text.text.option_number}
                  </p>
                </div>
                {copiedTexts.has(text.id) && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="whitespace-pre-wrap text-sm">{text.text.content}</p>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(text)}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copiedTexts.has(text.id) ? 'Copy Again' : 'Copy Text'}
              </Button>
            </Card>
          ))}
        </div>

        {allTextsCopied && (
          <Card className="p-6 bg-primary/10 border-primary/20">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">All Texts Copied!</h2>
              <p className="text-muted-foreground mb-6">
                You've successfully copied all your assigned texts. Click below to complete the assignment.
              </p>
              <Button 
                size="lg"
                onClick={handleComplete}
                disabled={isCompleting}
                className="min-w-[200px]"
              >
                {isCompleting ? (
                  "Completing..."
                ) : (
                  <>
                    Mark as Complete
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Assignment;