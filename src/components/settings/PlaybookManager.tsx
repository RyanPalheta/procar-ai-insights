import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Pencil, Plus } from "lucide-react";
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
  const [editingPlaybook, setEditingPlaybook] = useState<any>(null);
  const [editContent, setEditContent] = useState("");
  const [savingPlaybook, setSavingPlaybook] = useState(false);
  const [replaceFiles, setReplaceFiles] = useState<{ [playbookId: string]: File }>({});
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [deletingPlaybook, setDeletingPlaybook] = useState<string | null>(null);

  // New playbook import state
  const [newProductType, setNewProductType] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [importingNew, setImportingNew] = useState(false);

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

  const extractFileText = async (file: File): Promise<string> => {
    if (file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    return file.text();
  };

  const openEditDialog = (playbook: any) => {
    setEditingPlaybook(playbook);
    setEditContent(playbook.content || "");
  };

  const handleSaveContent = async () => {
    if (!editingPlaybook) return;
    setSavingPlaybook(true);
    try {
      const { error } = await supabase
        .from('playbooks')
        .update({ content: editContent })
        .eq('id', editingPlaybook.id);
      if (error) throw error;
      toast({ title: "Sucesso!", description: "Playbook atualizado" });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      setEditingPlaybook(null);
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao salvar playbook", variant: "destructive" });
    } finally {
      setSavingPlaybook(false);
    }
  };

  const handleReplaceFile = async (playbook: any) => {
    const file = replaceFiles[playbook.id];
    if (!file) return;
    setReplacingId(playbook.id);
    try {
      const text = await extractFileText(file);
      if (!text?.trim()) throw new Error('Arquivo vazio');
      const { error } = await supabase
        .from('playbooks')
        .update({
          title: file.name.replace('.docx', '').replace('.txt', ''),
          content: text
        })
        .eq('id', playbook.id);
      if (error) throw error;
      toast({ title: "Sucesso!", description: `Playbook ${playbook.product_type} substituído` });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      setReplaceFiles(prev => { const n = { ...prev }; delete n[playbook.id]; return n; });
    } catch (error) {
      toast({ title: "Erro", description: `Erro ao substituir: ${error instanceof Error ? error.message : 'Erro'}`, variant: "destructive" });
    } finally {
      setReplacingId(null);
    }
  };

  const handleDeletePlaybook = async (id: string, productType: string) => {
    setDeletingPlaybook(id);
    try {
      const { error } = await supabase.from('playbooks').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Sucesso!", description: `Playbook ${productType} removido` });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao remover playbook", variant: "destructive" });
    } finally {
      setDeletingPlaybook(null);
    }
  };

  const handleImportNew = async () => {
    if (!newProductType || !newFile) return;
    setImportingNew(true);
    try {
      const text = await extractFileText(newFile);
      if (!text?.trim()) throw new Error('Arquivo vazio');
      const { error } = await supabase.from('playbooks').insert({
        product_type: newProductType,
        title: newFile.name.replace('.docx', '').replace('.txt', ''),
        content: text
      });
      if (error) throw error;
      toast({ title: "Sucesso!", description: `Playbook ${newProductType} importado` });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      setNewProductType("");
      setNewFile(null);
    } catch (error) {
      toast({ title: "Erro", description: `Erro ao importar: ${error instanceof Error ? error.message : 'Erro'}`, variant: "destructive" });
    } finally {
      setImportingNew(false);
    }
  };

  const existingTypes = playbooks?.map(p => p.product_type) || [];
  const availableTypes = PRODUCT_TYPES.filter(t => !existingTypes.includes(t));

  return (
    <div className="space-y-6">
      {/* Edit Dialog */}
      <Dialog open={!!editingPlaybook} onOpenChange={(open) => !open && setEditingPlaybook(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="secondary">{editingPlaybook?.product_type}</Badge>
              {editingPlaybook?.title}
            </DialogTitle>
            <DialogDescription>
              Edite o conteúdo do playbook diretamente
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="flex-1 min-h-[50vh] font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlaybook(null)}>Cancelar</Button>
            <Button onClick={handleSaveContent} disabled={savingPlaybook}>
              {savingPlaybook ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Playbooks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Playbooks Cadastrados</CardTitle>
          <CardDescription>Gerencie, edite e substitua playbooks</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : playbooks && playbooks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Substituir Arquivo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playbooks.map((playbook) => (
                  <TableRow key={playbook.id}>
                    <TableCell><Badge variant="secondary">{playbook.product_type}</Badge></TableCell>
                    <TableCell className="font-medium">{playbook.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(playbook.created_at || '').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".docx,.txt"
                          className="h-8 text-xs max-w-[180px]"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setReplaceFiles(prev => ({ ...prev, [playbook.id]: f }));
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!replaceFiles[playbook.id] || replacingId === playbook.id}
                          onClick={() => handleReplaceFile(playbook)}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {replacingId === playbook.id ? '...' : 'Enviar'}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(playbook)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={deletingPlaybook === playbook.id}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover o playbook <strong>{playbook.product_type}</strong>?
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
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum playbook cadastrado ainda</p>
          )}
        </CardContent>
      </Card>

      {/* Import New Playbook */}
      {availableTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importar Novo Playbook</CardTitle>
            <CardDescription>Adicione um playbook para um tipo de produto sem playbook cadastrado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1.5">
                <Label>Tipo de Produto</Label>
                <Select value={newProductType} onValueChange={setNewProductType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Arquivo (.docx ou .txt)</Label>
                <Input
                  type="file"
                  accept=".docx,.txt"
                  className="h-10"
                  onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button onClick={handleImportNew} disabled={!newProductType || !newFile || importingNew}>
                <Plus className="h-4 w-4 mr-1" />
                {importingNew ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
