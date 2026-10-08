# Ensalamento

Protótipo funcional para alocação de horários de aulas e salas.

## Tecnologias

- Next.js com App Router e TypeScript
- Tailwind CSS
- shadcn/ui (preset Nova)
- PostgreSQL do Supabase via Prisma 6

## Configuração inicial

1. Copie `.env.example` para `.env`.
2. Preencha `DATABASE_URL` com a conexão direta PostgreSQL do projeto no Supabase.
3. Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

As migrations e o schema de domínio serão incluídos na próxima etapa.
