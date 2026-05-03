'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, type Paginated } from '@/lib/api';
import { Button, Card, Input, Table, Td, Th } from '@/components/ui';

type Student = {
  id: string;
  studentId: string;
  name: string;
  email?: string;
  faculty?: string;
  year?: number;
  sectionId?: string;
};

export default function StudentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const q = useQuery({
    queryKey: ['students', page, search],
    queryFn: () =>
      unwrap<Paginated<Student>>(api.get('/students', { params: { page, pageSize: 25, search } })),
  });

  const importMu = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/students/import', fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground">Manage enrolled students.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const r = await api.get('/students/import/template', { responseType: 'blob' });
              const url = URL.createObjectURL(new Blob([r.data]));
              const a = document.createElement('a');
              a.href = url;
              a.download = 'students-template.xlsx';
              a.click();
            }}
          >
            Download template
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              hidden
              accept=".xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importMu.mutate(f);
              }}
            />
            <span className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Import Excel
            </span>
          </label>
        </div>
      </div>
      <Card className="p-4">
        <Input
          placeholder="Search by name, email, student ID…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </Card>
      <Table>
        <thead>
          <tr>
            <Th>Student ID</Th>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Faculty</Th>
            <Th>Year</Th>
          </tr>
        </thead>
        <tbody>
          {q.data?.items.map((s) => (
            <tr key={s.id}>
              <Td>{s.studentId}</Td>
              <Td>{s.name}</Td>
              <Td>{s.email ?? '—'}</Td>
              <Td>{s.faculty ?? '—'}</Td>
              <Td>{s.year ?? '—'}</Td>
            </tr>
          ))}
          {q.isLoading && (
            <tr>
              <Td className="text-muted-foreground">Loading…</Td>
              <Td /><Td /><Td /><Td />
            </tr>
          )}
          {q.data && q.data.items.length === 0 && (
            <tr>
              <Td className="text-muted-foreground">No students yet — import an Excel file to get started.</Td>
              <Td /><Td /><Td /><Td />
            </tr>
          )}
        </tbody>
      </Table>
      {q.data && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{q.data.total} total</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page * q.data.pageSize >= q.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
