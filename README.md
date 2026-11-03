# Barbearia Jean Rodrigues — sistema de gestão

Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage, Realtime), hospedado na Vercel.

## Estrutura

```
supabase/
  migrations/0001_schema.sql            tabelas
  migrations/0002_triggers.sql          totais, baixa automática de estoque, alertas, novo usuário
  migrations/0003_rls.sql               segurança por papel (dono x barbeiro)
  migrations/0004_funcoes.sql           check-in público, fila da TV, resumo mensal
  migrations/0005_storage_realtime.sql  bucket de fotos e realtime da fila
  migrations/0006_atendimento.sql       chamar da fila e finalizar atendimento (atômico)
  migrations/0007_estoque.sql           entrada (gera despesa) e ajuste por contagem
  migrations/0008_seguranca.sql         limite de tentativas no check-in, novos usuários sem acesso,
                                        barbeiro só lê os próprios atendimentos, anon sem acesso a tabelas
  seed.sql                              dados iniciais (preços e produtos de EXEMPLO)
  setup.sql                             tudo acima num arquivo só (gerado por scripts/gerar-setup.sh)
src/
  app/login                             login da equipe
  app/app                               painel (protegido)
  app/app/clientes                      lista, busca, ficha, fotos, histórico
  app/app/atendimento/[id]              finalizar atendimento (itens, desconto, pagamento)
  app/app/config                        barbearia + QR code, serviços, equipe e logins
  app/app/estoque                       produtos, entrada, ajuste, histórico, fichas de insumo
  app/app/despesas                      lançamentos do mês, fixas recorrentes
  app/app/resumo                        indicadores do mês (barbeiro vê só quantidades)
  app/app/exportar/[tipo]               planilhas Excel de clientes e estoque (só dono)
  app/checkin                           check-in público (tablet: /checkin, QR: /checkin?origem=qr)
  app/fila/[id]                         posição do cliente no celular
  app/tv                                fila para a TV
  lib/                                  supabase, auth, formatação
```

## Colocar no ar (primeira vez)

> **Logins:** crie a equipe pelo painel (Configurações → Equipe). Usuários criados direto no
> Supabase (depois do primeiro) nascem **bloqueados** e precisam ser reativados nessa tela.

### 1. Banco (Supabase)
1. **SQL Editor → New query**: cole o conteúdo de `supabase/setup.sql` e clique em **Run**.
2. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**. Só o Jean cria contas.
3. **Authentication → Users → Add user → Create new user**: e-mail e senha do Jean, com **Auto Confirm User** marcado.
   O **primeiro usuário criado vira dono** automaticamente; os seguintes viram barbeiros.
4. Ajuste o nome do Jean (por padrão é a parte antes do @ do e-mail):
   ```sql
   update usuarios set nome = 'Jean Rodrigues' where papel = 'dono';
   ```

### 2. Vercel
1. Suba este projeto para um repositório no GitHub e importe na Vercel (**Add New → Project**).
2. Em **Environment Variables**, cadastre:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xsvmsjyabadbywenilcs.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a *Publishable key* (`sb_publishable_...`)
   - `SUPABASE_SERVICE_ROLE_KEY` = a *Secret key* (será usada no dia 2 para criar usuários dos barbeiros)
3. **Deploy**.
4. De volta ao Supabase, em **Authentication → URL Configuration**, coloque a URL da Vercel (`https://....vercel.app`) em **Site URL**.

### Rodar localmente
```bash
cp .env.example .env.local   # preencha URL e publishable key
npm install
npm run dev
```

## Atualizar um banco que já existe
Quando sair uma migration nova, rode **só o arquivo novo** no SQL Editor (ex.: `0006_atendimento.sql`).
O `setup.sql` é só para instalação do zero.

## Regras que ficam no banco
- **Estoque:** cada item de produto vendido gera saída automática; cada serviço consome os insumos da sua ficha técnica (`servico_insumos`). Apagar o item devolve o estoque.
- **Alerta:** quando um produto chega no estoque mínimo, cria um alerta para o dono; some sozinho quando o estoque é reposto.
- **Totais:** subtotal do atendimento = soma dos itens; total = subtotal − desconto.
- **Permissões:** barbeiro vê e edita clientes, fila e atendimentos; estoque (escrita), despesas e valores do resumo são só do dono. No resumo, o barbeiro vê apenas a quantidade de atendimentos.
- **Público (totem/QR/TV):** não lê tabelas; usa só as funções `checkin_*`, `fila_status` e `fila_publica`, que devolvem o mínimo (primeiro nome e posição).
- Dinheiro sempre em **centavos** (inteiro). Datas do dia no fuso de São Paulo.
