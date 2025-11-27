import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AIAnalysisPlan from "./AIAnalysisPlan";
import { Sparkles } from "lucide-react";

interface AIAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAnalyzing: boolean;
  onComplete?: () => void;
}

export default function AIAnalysisDialog({ 
  open, 
  onOpenChange, 
  isAnalyzing,
  onComplete
}: AIAnalysisDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise de Lead com IA
          </DialogTitle>
          <DialogDescription>
            Acompanhe o progresso da análise automatizada do lead
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          <AIAnalysisPlan isAnalyzing={isAnalyzing} onComplete={onComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
