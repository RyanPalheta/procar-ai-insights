import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_db").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredLeads = leads?.filter((lead) =>
    lead.sales_person_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.channel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.sales_status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won":
      case "ganho":
        return "success";
      case "lost":
      case "perdido":
        return "destructive";
      case "in_progress":
      case "em_progresso":
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Leads</h2>
        <p className="text-muted-foreground">
          Gerencie e acompanhe todos os seus leads
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Leads</CardTitle>
          <Input
            placeholder="Buscar por vendedor, canal ou status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : filteredLeads && filteredLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Upsell</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.session_id}>
                      <TableCell className="font-medium">
                        {lead.sales_person_id || "N/A"}
                      </TableCell>
                      <TableCell>{lead.channel || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(lead.sales_status) as any}>
                          {lead.sales_status || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.lead_score || "N/A"}</TableCell>
                      <TableCell>{lead.service_desired || "N/A"}</TableCell>
                      <TableCell>{lead.upsell_opportunity || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lead encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
