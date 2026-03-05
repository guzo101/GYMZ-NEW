/* @ts-nocheck */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserX, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface DeletedAccountRecord {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  unique_id: string | null;
  gym_id: string | null;
  access_mode: string | null;
  deleted_at: string;
  gym_name?: string | null;
}

export default function DeletedAccounts() {
  const { user } = useAuth();
  const [records, setRecords] = useState<DeletedAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchDeletedAccounts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("deleted_accounts")
        .select("id, user_id, email, name, unique_id, gym_id, access_mode, deleted_at")
        .order("deleted_at", { ascending: false })
        .limit(200);

      if (error) {
        toast.error("Failed to load deleted accounts");
        console.error(error);
        setRecords([]);
        return;
      }

      // Fetch gym names for gym_ids
      const gymIds = [...new Set((data || []).map((r: any) => r.gym_id).filter(Boolean))];
      const gymMap: Record<string, string> = {};
      if (gymIds.length > 0) {
        const { data: gyms } = await supabase
          .from("gyms")
          .select("id, name")
          .in("id", gymIds);
        (gyms || []).forEach((g: any) => { gymMap[g.id] = g.name; });
      }

      const mapped = (data || []).map((r: any) => ({
        ...r,
        gym_name: r.gym_id ? gymMap[r.gym_id] ?? null : null,
      }));
      setRecords(mapped);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load deleted accounts");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedAccounts();
  }, [user?.id]);

  const filtered = records.filter(
    (r) =>
      !searchTerm ||
      (r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (r.unique_id?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <UserX className="h-8 w-8 text-muted-foreground" />
          Deleted Accounts
        </h1>
        <p className="text-muted-foreground">
          Members who have deleted their accounts. This record is kept for admin visibility.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Deleted Account Records</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchDeletedAccounts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {records.length === 0
                ? "No deleted accounts on record."
                : "No matches for your search."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Gym</TableHead>
                  <TableHead>Deleted At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name ?? "—"}</TableCell>
                    <TableCell>{r.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.unique_id ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.access_mode ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>{r.gym_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(r.deleted_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
