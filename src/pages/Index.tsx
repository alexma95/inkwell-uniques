import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      // Get active campaign (for now, just the first one)
      const { data: campaigns, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("status", "active")
        .limit(1);

      if (campaignError || !campaigns?.length) {
        throw new Error("No active campaign found");
      }

      const campaign = campaigns[0];

      // Check if user already has an assignment
      const { data: existingAssignment } = await supabase
        .from("user_assignments")
        .select("*")
        .eq("email", email)
        .eq("campaign_id", campaign.id)
        .maybeSingle();

      if (existingAssignment) {
        // User already has assignment, redirect to their texts
        navigate(`/assignment/${existingAssignment.id}`);
        return;
      }

      // Create new assignment
      const { data: newAssignment, error: assignmentError } = await supabase
        .from("user_assignments")
        .insert({
          email,
          campaign_id: campaign.id,
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      // Get all products for this campaign
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("position");

      if (productsError) throw productsError;

      // Assign random texts for each product
      for (const product of products) {
        // Get available texts for this product
        const { data: availableTexts, error: textsError } = await supabase
          .from("texts")
          .select("*")
          .eq("product_id", product.id)
          .eq("is_assigned", false);

        if (textsError) throw textsError;

        if (availableTexts && availableTexts.length > 0) {
          // Pick a random text
          const randomText = availableTexts[Math.floor(Math.random() * availableTexts.length)];

          // Mark text as assigned
          await supabase
            .from("texts")
            .update({ is_assigned: true })
            .eq("id", randomText.id);

          // Create assignment_text record
          await supabase
            .from("assignment_texts")
            .insert({
              assignment_id: newAssignment.id,
              product_id: product.id,
              text_id: randomText.id,
            });
        }
      }

      // Navigate to assignment page
      navigate(`/assignment/${newAssignment.id}`);
    } catch (error: any) {
      console.error("Error creating assignment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="container max-w-2xl mx-auto px-4 py-16 relative">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Campaign Text Assignment</span>
          </div>
          
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Get Your Unique Texts
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Enter your email to receive personalized text assignments for this campaign
          </p>
        </div>

        <Card className="p-8 backdrop-blur-sm bg-card/50 border-primary/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 text-base"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                "Creating assignment..."
              ) : (
                <>
                  Get My Texts
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Each email receives unique text assignments that are immediately reserved for you
        </p>
      </div>
    </div>
  );
};

export default Index;
