import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaybookManager } from "@/components/settings/PlaybookManager";
import { ProductManager } from "@/components/settings/ProductManager";
import { AlertsManager } from "@/components/settings/AlertsManager";
import { SellerGoalsManager } from "@/components/settings/SellerGoalsManager";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">
          Gerencie regras de IA e configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="ai-settings" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="ai-settings">Configurações de IA</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="seller-goals">Metas Vendedores</TabsTrigger>
          <TabsTrigger value="audit">Auditoria IA</TabsTrigger>
        </TabsList>

        {/* Tab 1: AI Settings (existing content) */}
        <TabsContent value="ai-settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de IA</CardTitle>
              <CardDescription>
                Pesos e parâmetros das regras de análise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Versão da IA</p>
                  <p className="text-sm text-muted-foreground">Versão atual em uso</p>
                </div>
                <Badge variant="secondary">v2.1.0</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Score Mínimo</p>
                  <p className="text-sm text-muted-foreground">
                    Pontuação mínima para qualificação
                  </p>
                </div>
                <Badge>7.0</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Peso ICP</p>
                  <p className="text-sm text-muted-foreground">
                    Importância do perfil ideal de cliente
                  </p>
                </div>
                <Badge>80%</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Análise Automática</p>
                  <p className="text-sm text-muted-foreground">
                    Processamento em tempo real
                  </p>
                </div>
                <Badge variant="success">Ativo</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regras de Pontuação</CardTitle>
              <CardDescription>
                Critérios utilizados no cálculo do lead score
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Engajamento</span>
                  <span className="text-sm text-muted-foreground">30%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Orçamento</span>
                  <span className="text-sm text-muted-foreground">25%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tempo de Resposta</span>
                  <span className="text-sm text-muted-foreground">20%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Canal de Origem</span>
                  <span className="text-sm text-muted-foreground">15%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Histórico</span>
                  <span className="text-sm text-muted-foreground">10%</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* Tab 2: Alerts */}
        <TabsContent value="alerts" className="space-y-6">
          <AlertsManager />
        </TabsContent>

        {/* Tab 3: Seller Goals */}
        <TabsContent value="seller-goals" className="space-y-6">
          <SellerGoalsManager />
        </TabsContent>

        {/* Tab 4: AI Audit */}
        <TabsContent value="audit" className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-2">Gerenciamento de Playbooks</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure os playbooks de vendas utilizados pela análise de IA
            </p>
            <PlaybookManager />
          </div>

          <Separator className="my-8" />

          <div>
            <h3 className="text-xl font-semibold mb-2">Gerenciamento de Produtos</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure os produtos e seus tipos para mapeamento de playbooks
            </p>
            <ProductManager />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
