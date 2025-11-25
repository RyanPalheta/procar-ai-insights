import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import mammoth from "mammoth";

const PRODUCT_TYPES = [
  "WINDOW TINT",
  "DASHCAMS",
  "SPEAKER",
  "SUBWOOFER",
  "LIGHTS",
  "CARPLAY",
  "LABOR"
];

export function PlaybookManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [playbookFiles, setPlaybookFiles] = useState<{ [key: string]: File }>({});
  const [uploadingPlaybook, setUploadingPlaybook] = useState<string | null>(null);
  const [deletingPlaybook, setDeletingPlaybook] = useState<string | null>(null);
  const [viewingPlaybook, setViewingPlaybook] = useState<any>(null);

  const { data: playbooks, isLoading } = useQuery({
    queryKey: ['playbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .order('product_type');
      
      if (error) throw error;
      return data;
    }
  });

  const handlePlaybookFileChange = (productType: string, file: File | null) => {
    if (!file) return;
    
    setPlaybookFiles(prev => ({
      ...prev,
      [productType]: file
    }));
  };

  const handleUploadPlaybook = async (productType: string) => {
    const file = playbookFiles[productType];
    if (!file) return;

    setUploadingPlaybook(productType);
    try {
      let text: string;
      
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }
      
      if (!text || text.trim().length === 0) {
        throw new Error('O arquivo está vazio ou não pôde ser lido');
      }

      // Check if playbook exists
      const existing = playbooks?.find(p => p.product_type === productType);

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('playbooks')
          .update({
            title: file.name.replace('.docx', '').replace('.txt', ''),
            content: text
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('playbooks')
          .insert({
            product_type: productType,
            title: file.name.replace('.docx', '').replace('.txt', ''),
            content: text
          });

        if (error) throw error;
      }

      toast({
        title: "Sucesso!",
        description: `Playbook ${productType} importado com sucesso`
      });

      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      setPlaybookFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[productType];
        return newFiles;
      });
    } catch (error) {
      console.error('Error uploading playbook:', error);
      toast({
        title: "Erro",
        description: `Erro ao importar playbook: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setUploadingPlaybook(null);
    }
  };

  const handleDeletePlaybook = async (id: string, productType: string) => {
    setDeletingPlaybook(id);
    try {
      const { error } = await supabase
        .from('playbooks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Playbook ${productType} removido`
      });

      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
    } catch (error) {
      console.error('Error deleting playbook:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover playbook",
        variant: "destructive"
      });
    } finally {
      setDeletingPlaybook(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Playbook Viewing Dialog */}
      <Dialog open={!!viewingPlaybook} onOpenChange={(open) => !open && setViewingPlaybook(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="secondary">{viewingPlaybook?.product_type}</Badge>
              {viewingPlaybook?.title}
            </DialogTitle>
            <DialogDescription>
              Criado em {viewingPlaybook?.created_at ? new Date(viewingPlaybook.created_at).toLocaleDateString('pt-BR') : '-'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
            <div className="whitespace-pre-wrap text-sm">
              {viewingPlaybook?.content || 'Nenhum conteúdo disponível'}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Existing Playbooks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Playbooks Cadastrados</CardTitle>
          <CardDescription>
            Lista de playbooks atualmente no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : playbooks && playbooks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Produto</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playbooks.map((playbook) => (
                  <TableRow 
                    key={playbook.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setViewingPlaybook(playbook)}
                  >
                    <TableCell>
                      <Badge variant="secondary">{playbook.product_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{playbook.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(playbook.created_at || '').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingPlaybook(playbook)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingPlaybook === playbook.id}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover o playbook <strong>{playbook.product_type}</strong>? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePlaybook(playbook.id, playbook.product_type)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum playbook cadastrado ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upload New Playbooks */}
      <Card>
        <CardHeader>
          <CardTitle>Importar Playbooks</CardTitle>
          <CardDescription>
            Faça upload dos playbooks (um para cada tipo de produto). Arquivos .docx ou .txt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {PRODUCT_TYPES.map(type => {
              const existing = playbooks?.find(p => p.product_type === type);
              return (
                <Card key={type}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{type}</CardTitle>
                      {existing && (
                        <Badge variant="default">Cadastrado</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Label htmlFor={`playbook-${type}`}>
                      {existing ? 'Substituir playbook' : 'Novo playbook'}
                    </Label>
                    <Input
                      id={`playbook-${type}`}
                      type="file"
                      accept=".docx,.txt"
                      onChange={(e) => handlePlaybookFileChange(type, e.target.files?.[0] || null)}
                    />
                    <Button
                      onClick={() => handleUploadPlaybook(type)}
                      disabled={!playbookFiles[type] || uploadingPlaybook === type}
                      className="w-full"
                      size="sm"
                    >
                      <Upload className="mr-2 h-3 w-3" />
                      {uploadingPlaybook === type ? 'Importando...' : existing ? 'Substituir' : 'Importar'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
