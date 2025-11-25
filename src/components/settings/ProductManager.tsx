import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

const PRODUCT_TYPES = [
  "WINDOW TINT",
  "DASHCAMS",
  "SPEAKER",
  "SUBWOOFER",
  "LIGHTS",
  "CARPLAY",
  "LABOR"
];

export function ProductManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filterType, setFilterType] = useState<string>("all");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  
  const [newProductName, setNewProductName] = useState("");
  const [newProductType, setNewProductType] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [productsPreview, setProductsPreview] = useState<any[]>([]);
  const [uploadingProducts, setUploadingProducts] = useState(false);
  
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', filterType],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .order('product_type')
        .order('product_name');
      
      if (filterType !== "all") {
        query = query.eq('product_type', filterType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          const products = jsonData.map((row: any) => {
            const productName = row['PRODUTO'] || row['produto'] || row['Product'] || row['PRODUCT'] || 
                               row['Nome'] || row['nome'] || row['Name'] || row['name'];
            const productType = row['TIPO'] || row['tipo'] || row['Type'] || row['TYPE'] ||
                               row['Tipo'] || row['Category'] || row['category'];
            
            return {
              product_name: productName,
              product_type: productType
            };
          }).filter(p => p.product_name && p.product_type);

          const uniqueProducts = products.reduce((acc: any[], product) => {
            const exists = acc.find(p => p.product_name === product.product_name);
            if (!exists) {
              acc.push(product);
            }
            return acc;
          }, []);

          if (uniqueProducts.length === 0) {
            toast({
              title: "Erro",
              description: "Nenhum produto encontrado. Verifique se as colunas têm nomes como 'PRODUTO' e 'TIPO'",
              variant: "destructive"
            });
            setExcelFile(null);
            return;
          }

          setProductsPreview(uniqueProducts);
          
          toast({
            title: "Arquivo lido!",
            description: `${uniqueProducts.length} produtos encontrados`
          });
        } catch (parseError) {
          console.error('Error parsing Excel:', parseError);
          toast({
            title: "Erro ao ler arquivo",
            description: parseError instanceof Error ? parseError.message : "Erro desconhecido",
            variant: "destructive"
          });
          setExcelFile(null);
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error handling file:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao processar arquivo",
        variant: "destructive"
      });
      setExcelFile(null);
    }
  };

  const handleUploadExcel = async () => {
    if (productsPreview.length === 0) return;

    setUploadingProducts(true);
    try {
      const { error } = await supabase
        .from('products')
        .insert(productsPreview);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `${productsPreview.length} produtos importados`
      });

      queryClient.invalidateQueries({ queryKey: ['products'] });
      setExcelFile(null);
      setProductsPreview([]);
    } catch (error) {
      console.error('Error uploading products:', error);
      toast({
        title: "Erro",
        description: `Erro ao importar produtos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setUploadingProducts(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProductName || !newProductType) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .insert({
          product_name: newProductName,
          product_type: newProductType
        });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Produto adicionado"
      });

      queryClient.invalidateQueries({ queryKey: ['products'] });
      setNewProductName("");
      setNewProductType("");
      setAddDialogOpen(false);
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar produto",
        variant: "destructive"
      });
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !editName || !editType) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          product_name: editName,
          product_type: editType
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Produto atualizado"
      });

      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditingProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar produto",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setDeletingProduct(id);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Produto removido"
      });

      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover produto",
        variant: "destructive"
      });
    } finally {
      setDeletingProduct(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Produtos Cadastrados</CardTitle>
              <CardDescription>
                {products?.length || 0} produtos no sistema
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {PRODUCT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Produto</DialogTitle>
                    <DialogDescription>
                      Adicione um novo produto manualmente
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-product-name">Nome do Produto</Label>
                      <Input
                        id="new-product-name"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="Ex: Película G5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-product-type">Tipo</Label>
                      <Select value={newProductType} onValueChange={setNewProductType}>
                        <SelectTrigger id="new-product-type">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddProduct}>Adicionar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : products && products.length > 0 ? (
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{product.product_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingProduct(product);
                                  setEditName(product.product_name);
                                  setEditType(product.product_type);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Produto</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-product-name">Nome do Produto</Label>
                                  <Input
                                    id="edit-product-name"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-product-type">Tipo</Label>
                                  <Select value={editType} onValueChange={setEditType}>
                                    <SelectTrigger id="edit-product-type">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PRODUCT_TYPES.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setEditingProduct(null)}>
                                  Cancelar
                                </Button>
                                <Button onClick={handleUpdateProduct}>Salvar</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingProduct === product.id}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover <strong>{product.product_name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteProduct(product.id)}
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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum produto encontrado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Excel Import */}
      <Card>
        <CardHeader>
          <CardTitle>Importar Produtos em Massa</CardTitle>
          <CardDescription>
            Faça upload de uma planilha Excel (.xlsx) com as colunas PRODUTO e TIPO
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="products-file">Planilha de Produtos (.xlsx)</Label>
            <Input
              id="products-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelFileChange}
            />
          </div>

          {productsPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {productsPreview.length} produtos encontrados
                </p>
                <Button
                  onClick={handleUploadExcel}
                  disabled={uploadingProducts}
                  size="sm"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingProducts ? 'Importando...' : 'Importar'}
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsPreview.slice(0, 10).map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{product.product_type}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {productsPreview.length > 10 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    ... e mais {productsPreview.length - 10} produtos
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
