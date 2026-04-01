import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getMetaCredentials, hasMetaCredentials } from "@/hooks/useMetaAdsData";

export function MetaAdsSettings() {
  const { toast } = useToast();
  const credentials = getMetaCredentials();
  const configured = hasMetaCredentials();

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; name?: string } | null>(null);

  const handleTest = async () => {
    if (!configured) {
      toast({ title: "Credenciais nao configuradas", description: "Configure VITE_META_ADS_TOKEN e VITE_META_ADS_ACCOUNT_ID no arquivo .env", variant: "destructive" });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const accountPath = `act_${credentials.adAccountId}`;
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${accountPath}?fields=name,account_id,currency&access_token=${credentials.accessToken}`
      );
      const data = await res.json();

      if (data.error) {
        setTestResult({ success: false });
        toast({ title: "Erro na conexao", description: data.error.message, variant: "destructive" });
      } else {
        setTestResult({ success: true, name: data.name });
        toast({ title: "Conexao bem-sucedida!", description: `Conta: ${data.name} (${data.currency})` });
      }
    } catch (err: any) {
      setTestResult({ success: false });
      toast({ title: "Erro de rede", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Meta Ads
        </CardTitle>
        <CardDescription>
          Credenciais configuradas via variáveis de ambiente (.env). Para alterar, edite o arquivo .env e reinicie o servidor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="meta-token">Access Token (System User)</Label>
          <Input
            id="meta-token"
            type="password"
            value={credentials.accessToken ? "••••••••••••••••••••" : ""}
            readOnly
            className="bg-muted cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">
            Variável: <code className="bg-muted px-1 rounded">VITE_META_ADS_TOKEN</code>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta-account">Ad Account ID</Label>
          <Input
            id="meta-account"
            value={credentials.adAccountId || ""}
            readOnly
            className="bg-muted cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">
            Variável: <code className="bg-muted px-1 rounded">VITE_META_ADS_ACCOUNT_ID</code>
          </p>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            As credenciais ficam salvas no arquivo <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">.env</code> do projeto. Nunca são perdidas ao limpar cache ou trocar de computador (desde que o projeto esteja no repositório).
          </p>
        </div>

        {configured ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Configurado
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Nao configurado — preencha as variáveis no .env
          </Badge>
        )}

        {testResult && (
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Conectado{testResult.name ? `: ${testResult.name}` : ""}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Falha na conexao
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleTest} disabled={testing || !configured}>
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Testar Conexao
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
