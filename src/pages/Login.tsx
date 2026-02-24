import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast.error("Credenciais inválidas. Verifique seu email e senha.");
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="flex flex-col items-center gap-4 pb-2 pt-8">
          <img src={logo} alt="PROCAR Logo" className="h-16 w-16 object-contain" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">PROCAR</h1>
            <p className="text-sm text-muted-foreground">Faça login para acessar o painel</p>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
