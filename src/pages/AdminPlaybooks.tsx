import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle, Clock } from "lucide-react";
import * as XLSX from "xlsx";
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

export default function AdminPlaybooks() {
  const { toast } = useToast();
  const [productsFile, setProductsFile] = useState<File | null>(null);
  const [productsPreview, setProductsPreview] = useState<any[]>([]);
  const [uploadingProducts, setUploadingProducts] = useState(false);
  
  const [playbookFiles, setPlaybookFiles] = useState<{ [key: string]: File }>({});
  const [playbookStatus, setPlaybookStatus] = useState<{ [key: string]: 'pending' | 'uploaded' }>({});
  const [uploadingPlaybook, setUploadingPlaybook] = useState<string | null>(null);

  const handleProductsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProductsFile(file);

    try {
      // Parse Excel file
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          console.log('Excel data parsed:', jsonData.slice(0, 3)); // Log primeiras linhas

          // Transform to products format - try different column name variations
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

          // Remove duplicates by product_name (keep first occurrence)
          const uniqueProducts = products.reduce((acc: any[], product) => {
            const exists = acc.find(p => p.product_name === product.product_name);
            if (!exists) {
              acc.push(product);
            }
            return acc;
          }, []);

          const duplicatesCount = products.length - uniqueProducts.length;

          console.log('Transformed products:', products.length, 'Unique:', uniqueProducts.length);

          if (uniqueProducts.length === 0) {
            toast({
              title: "Erro",
              description: "Nenhum produto encontrado. Verifique se as colunas têm nomes como 'PRODUTO' e 'TIPO'",
              variant: "destructive"
            });
            setProductsFile(null);
            return;
          }

          setProductsPreview(uniqueProducts);
          
          const message = duplicatesCount > 0 
            ? `${uniqueProducts.length} produtos únicos encontrados (${duplicatesCount} duplicados removidos)`
            : `${uniqueProducts.length} produtos encontrados`;
            
          toast({
            title: "Arquivo lido!",
            description: message
          });
        } catch (parseError) {
          console.error('Error parsing Excel:', parseError);
          toast({
            title: "Erro ao ler arquivo",
            description: parseError instanceof Error ? parseError.message : "Erro desconhecido",
            variant: "destructive"
          });
          setProductsFile(null);
        }
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        toast({
          title: "Erro ao ler arquivo",
          description: "Não foi possível ler o arquivo",
          variant: "destructive"
        });
        setProductsFile(null);
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error handling file:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao processar arquivo",
        variant: "destructive"
      });
      setProductsFile(null);
    }
  };

  const handleUploadProducts = async () => {
    if (productsPreview.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum produto encontrado no arquivo",
        variant: "destructive"
      });
      return;
    }

    setUploadingProducts(true);
    try {
      console.log('Uploading products:', productsPreview.length);
      
      // Double-check for duplicates before sending
      const uniqueProducts = productsPreview.reduce((acc: any[], product) => {
        const exists = acc.find(p => p.product_name === product.product_name);
        if (!exists) {
          acc.push(product);
        }
        return acc;
      }, []);

      console.log('Sending unique products:', uniqueProducts.length);
      
      const { data, error } = await supabase.functions.invoke('seed-data/products', {
        body: { products: uniqueProducts }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log('Upload response:', data);

      toast({
        title: "Sucesso!",
        description: `${productsPreview.length} produtos importados com sucesso`
      });

      setProductsFile(null);
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
      
      // Extract text based on file type
      if (file.name.endsWith('.docx')) {
        // Use mammoth to extract text from .docx files
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
        
        if (result.messages && result.messages.length > 0) {
          console.log('Mammoth warnings:', result.messages);
        }
      } else {
        // For .txt files, read as plain text
        text = await file.text();
      }
      
      if (!text || text.trim().length === 0) {
        throw new Error('O arquivo está vazio ou não pôde ser lido');
      }

      const { data, error } = await supabase.functions.invoke('seed-data/playbook', {
        body: {
          product_type: productType,
          title: file.name.replace('.docx', '').replace('.txt', ''),
          content: text,
          steps: null
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Playbook ${productType} importado com sucesso`
      });

      setPlaybookStatus(prev => ({
        ...prev,
        [productType]: 'uploaded'
      }));
    } catch (error) {
      console.error('Error uploading playbook:', error);
      toast({
        title: "Erro",
        description: `Erro ao importar playbook ${productType}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setUploadingPlaybook(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gerenciamento de Playbooks</h1>
        <p className="text-muted-foreground">Importe produtos e playbooks de vendas para análise de IA</p>
      </div>

      {/* Seção 1: Upload de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>1. Importar Produtos</CardTitle>
          <CardDescription>
            Faça upload da planilha PROCAR_PRODUCTS.xlsx contendo os produtos e seus tipos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="products-file">Planilha de Produtos (.xlsx)</Label>
            <Input
              id="products-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleProductsFileChange}
            />
          </div>

          {productsPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {productsPreview.length} produtos encontrados
                </p>
                <Button
                  onClick={handleUploadProducts}
                  disabled={uploadingProducts}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingProducts ? 'Importando...' : 'Importar Produtos'}
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-md">
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

      {/* Seção 2: Upload de Playbooks */}
      <Card>
        <CardHeader>
          <CardTitle>2. Importar Playbooks</CardTitle>
          <CardDescription>
            Faça upload dos 7 playbooks (um para cada tipo de produto)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {PRODUCT_TYPES.map(type => (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{type}</CardTitle>
                    {playbookStatus[type] === 'uploaded' ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Importado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pendente
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input
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
                    {uploadingPlaybook === type ? 'Importando...' : 'Importar'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
