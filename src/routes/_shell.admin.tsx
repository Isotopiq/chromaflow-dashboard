import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, AlertTriangle } from "lucide-react";
import { listAdminUsers, setUserRole } from "@/lib/lab.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/admin")({ component: Admin });

function Admin() {
  const list = useServerFn(listAdminUsers);
  const setRole = useServerFn(setUserRole);
  const qc = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list(),
  });

  const mut = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "developer" | "reviewer" }) =>
      setRole({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users & roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Role assignments are stored in <span className="font-mono">user_roles</span> and enforced by RLS.
        </p>
      </div>

      <Card className="flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <Shield className="h-4 w-4 text-primary" />
        <div className="text-xs">
          <div className="font-medium">Three roles supported</div>
          <p className="mt-0.5 text-muted-foreground">
            <span className="font-mono">admin</span> — full access including user management.{" "}
            <span className="font-mono">developer</span> — create/edit own methods, runs, columns.{" "}
            <span className="font-mono">reviewer</span> — read-all with annotation rights.
          </p>
        </div>
      </Card>

      {error && (
        <Card className="flex items-center gap-2 border-destructive/40 bg-destructive/5 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>Only admins can view this page. {(error as any)?.message ?? ""}</span>
        </Card>
      )}

      <Card className="border-border bg-card p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-[10px] uppercase tracking-wider">User</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Email</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {(users ?? []).map((u) => (
              <TableRow key={u.id} className="text-xs">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-semibold">
                      {u.avatar}
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      defaultValue={u.role}
                      onValueChange={(v) =>
                        mut.mutate({
                          userId: u.id,
                          role: v as "admin" | "developer" | "reviewer",
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {u.role}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
